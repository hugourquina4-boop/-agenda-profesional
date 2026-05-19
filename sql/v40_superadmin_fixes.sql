-- v40: Superadmin fixes
--
-- Problema 1: crear_negocio no insertaba al superadmin en usuarios_tenant del nuevo
--   tenant, por lo que RLS bloqueaba todo acceso de datos al gestionar ese negocio.
-- Problema 2: superadmin_tenants_info no retornaba admin_email.
-- Problema 3: tenants existentes (creados antes de este fix) tampoco tenían a Hugo
--   en usuarios_tenant — arreglado con el bloque final.

-- ── Fix: crear_negocio ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_negocio(
  p_nombre   TEXT,
  p_slug     TEXT,
  p_ciudad   TEXT DEFAULT NULL,
  p_vertical TEXT DEFAULT 'salon',
  p_plan     TEXT DEFAULT 'starter',
  p_color    TEXT DEFAULT '#f43f5e'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND rol = 'superadmin' AND activo = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo superadmin';
  END IF;

  -- Normalize slug
  p_slug := lower(trim(regexp_replace(p_slug, '[^a-z0-9-]', '-', 'g')));
  p_slug := regexp_replace(p_slug, '-+', '-', 'g');
  p_slug := trim(both '-' from p_slug);

  IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug ya en uso: %', p_slug;
  END IF;

  INSERT INTO tenants (nombre, slug, ciudad, vertical, plan, color_primario, activo)
  VALUES (p_nombre, p_slug, p_ciudad, p_vertical, p_plan, p_color, true)
  RETURNING id INTO v_id;

  -- Link calling superadmin to new tenant so RLS allows full data access
  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  VALUES (
    auth.uid(), v_id, 'superadmin', true,
    COALESCE((SELECT raw_user_meta_data->>'nombre' FROM auth.users WHERE id = auth.uid()), 'Superadmin'),
    (SELECT email::TEXT FROM auth.users WHERE id = auth.uid())
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET rol = 'superadmin', activo = true;

  -- Seed default role permissions for the new tenant
  PERFORM salon_seed_permisos(v_id);

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_negocio(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ── Fix: superadmin_tenants_info — incluir admin_email ────────────────────────
DROP FUNCTION IF EXISTS superadmin_tenants_info();
CREATE FUNCTION superadmin_tenants_info()
RETURNS TABLE (
  tenant_id           UUID,
  nombre              TEXT,
  slug                TEXT,
  ciudad              TEXT,
  vertical            TEXT,
  plan                TEXT,
  color_primario      TEXT,
  activo              BOOLEAN,
  admin_email         TEXT,
  created_at          TIMESTAMPTZ,
  citas_mes           BIGINT,
  ingresos_mes        NUMERIC,
  total_profesionales BIGINT,
  total_clientes      BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND rol = 'superadmin' AND activo = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo superadmin';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.nombre,
    t.slug,
    t.ciudad,
    t.vertical,
    COALESCE(t.plan, 'starter')::TEXT,
    COALESCE(t.color_primario, '#f43f5e')::TEXT,
    COALESCE(t.activo, true),
    t.admin_email,
    t.created_at,
    COUNT(DISTINCT c.id)
      FILTER (WHERE c.created_at >= date_trunc('month', NOW()))::BIGINT,
    COALESCE(SUM(p.monto)
      FILTER (WHERE p.created_at >= date_trunc('month', NOW())
              AND p.estado = 'pagado'), 0)::NUMERIC,
    COUNT(DISTINCT prof.id)::BIGINT,
    COUNT(DISTINCT cli.id)::BIGINT
  FROM tenants t
  LEFT JOIN citas          c    ON c.tenant_id    = t.id
  LEFT JOIN pagos          p    ON p.tenant_id    = t.id
  LEFT JOIN profesionales  prof ON prof.tenant_id = t.id AND prof.activo = true
  LEFT JOIN clientes_agenda cli ON cli.tenant_id  = t.id AND cli.activo  = true
  GROUP BY t.id
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION superadmin_tenants_info() TO authenticated;


-- ── Fix: vincular Hugo a TODOS los tenants existentes ────────────────────────
DO $$
DECLARE
  v_admin_id UUID;
  v_nombre   TEXT;
  v_email    TEXT;
BEGIN
  SELECT id, email::TEXT
  INTO v_admin_id, v_email
  FROM auth.users WHERE email = 'hugourquina@gmail.com' LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'hugourquina@gmail.com no encontrado — omitiendo';
    RETURN;
  END IF;

  v_nombre := COALESCE(
    (SELECT raw_user_meta_data->>'nombre' FROM auth.users WHERE id = v_admin_id),
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_admin_id),
    'Hugo Urquina'
  );

  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  SELECT v_admin_id, t.id, 'superadmin', true, v_nombre, v_email
  FROM tenants t
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET rol = 'superadmin', activo = true;

  RAISE NOTICE 'Hugo vinculado como superadmin en todos los tenants';
END $$;

-- Seed permisos para tenants que no los tienen aún
INSERT INTO permisos_tenant (tenant_id, rol, modulo, activo)
SELECT
  t.id,
  r.rol,
  m.modulo,
  m.default_activo
FROM tenants t
CROSS JOIN (VALUES
  ('contable',    'hoy',        true),
  ('contable',    'caja',       true),
  ('contable',    'comisiones', true),
  ('contable',    'inventario', true),
  ('contable',    'analytics',  true),
  ('contable',    'agenda',     false),
  ('contable',    'clientes',   false),
  ('contable',    'servicios',  false),
  ('contable',    'ordenes',    false),
  ('contable',    'equipo',     false),
  ('contable',    'accesos',    false),
  ('contable',    'config',     false),
  ('recepcion',   'hoy',        true),
  ('recepcion',   'agenda',     true),
  ('recepcion',   'clientes',   true),
  ('recepcion',   'servicios',  true),
  ('recepcion',   'ordenes',    true),
  ('recepcion',   'caja',       false),
  ('recepcion',   'comisiones', false),
  ('recepcion',   'inventario', false),
  ('recepcion',   'analytics',  false),
  ('recepcion',   'equipo',     false),
  ('recepcion',   'accesos',    false),
  ('recepcion',   'config',     false),
  ('profesional', 'hoy',        true),
  ('profesional', 'agenda',     true),
  ('profesional', 'clientes',   true),
  ('profesional', 'servicios',  true),
  ('profesional', 'ordenes',    true),
  ('profesional', 'caja',       false),
  ('profesional', 'comisiones', false),
  ('profesional', 'inventario', false),
  ('profesional', 'analytics',  false),
  ('profesional', 'equipo',     false),
  ('profesional', 'accesos',    false),
  ('profesional', 'config',     false)
) AS r(rol, modulo, default_activo), LATERAL (VALUES (r.modulo, r.default_activo)) AS m(modulo, default_activo)
ON CONFLICT (tenant_id, rol, modulo) DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE '✓ v40 aplicado: crear_negocio + superadmin_tenants_info + Hugo vinculado a todos los tenants';
END $$;
