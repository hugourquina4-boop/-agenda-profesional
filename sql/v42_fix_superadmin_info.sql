-- v42: Fix superadmin_tenants_info + contacto del negocio + re-vincular Hugo
--
-- Cambios:
--   a) Nuevas columnas en tenants: nombre_representante, pagina_web, instagram
--      (telefono y direccion ya existían desde el schema base)
--   b) crear_negocio amplía parámetros para incluir todos los datos de contacto
--   c) superadmin_tenants_info añade admin_email + campos de contacto al retorno
--   d) Re-vincula Hugo como superadmin en todos los tenants (idempotente)
--
-- APLICAR EN: Supabase → SQL Editor
-- IDEMPOTENTE: sí, puede re-ejecutarse sin daño

-- ── 0. Nuevas columnas en tenants ────────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_email          TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nombre_representante TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS foto_representante   TEXT;   -- foto/avatar del dueño
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pagina_web           TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram            TEXT;
-- (telefono y direccion ya existen en el schema base)

-- ── 1. superadmin_tenants_info con admin_email + contacto ────────────────────
-- DROP obligatorio porque cambia el tipo de retorno (nuevas columnas)
DROP FUNCTION IF EXISTS superadmin_tenants_info();
CREATE FUNCTION superadmin_tenants_info()
RETURNS TABLE (
  tenant_id            UUID,
  nombre               TEXT,
  slug                 TEXT,
  ciudad               TEXT,
  vertical             TEXT,
  plan                 TEXT,
  color_primario       TEXT,
  activo               BOOLEAN,
  admin_email          TEXT,
  created_at           TIMESTAMPTZ,
  citas_mes            BIGINT,
  ingresos_mes         NUMERIC,
  total_profesionales  BIGINT,
  total_clientes       BIGINT,
  -- Datos de contacto
  nombre_representante TEXT,
  telefono             TEXT,
  direccion            TEXT,
  pagina_web           TEXT,
  instagram            TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND rol = 'superadmin' AND activo = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo superadmin (uid=%)', auth.uid();
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
    t.admin_email::TEXT,
    t.created_at,
    COUNT(DISTINCT c.id)
      FILTER (WHERE c.created_at >= date_trunc('month', NOW()))::BIGINT,
    COALESCE(SUM(p.monto)
      FILTER (WHERE p.created_at >= date_trunc('month', NOW())
              AND p.estado = 'pagado'), 0)::NUMERIC,
    COUNT(DISTINCT prof.id)::BIGINT,
    COUNT(DISTINCT cli.id)::BIGINT,
    t.nombre_representante::TEXT,
    t.telefono::TEXT,
    t.direccion::TEXT,
    t.pagina_web::TEXT,
    t.instagram::TEXT
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

-- ── 2. crear_negocio con campos de contacto ──────────────────────────────────
CREATE OR REPLACE FUNCTION crear_negocio(
  p_nombre              TEXT,
  p_slug                TEXT,
  p_ciudad              TEXT    DEFAULT NULL,
  p_vertical            TEXT    DEFAULT 'salon',
  p_plan                TEXT    DEFAULT 'starter',
  p_color               TEXT    DEFAULT '#f43f5e',
  p_representante       TEXT    DEFAULT NULL,
  p_telefono            TEXT    DEFAULT NULL,
  p_direccion           TEXT    DEFAULT NULL,
  p_web                 TEXT    DEFAULT NULL,
  p_instagram           TEXT    DEFAULT NULL
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

  p_slug := lower(trim(regexp_replace(p_slug, '[^a-z0-9-]', '-', 'g')));
  p_slug := regexp_replace(p_slug, '-+', '-', 'g');
  p_slug := trim(both '-' from p_slug);

  IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug ya en uso: %', p_slug;
  END IF;

  INSERT INTO tenants (
    nombre, slug, ciudad, vertical, plan, color_primario, activo,
    nombre_representante, telefono, direccion, pagina_web, instagram
  )
  VALUES (
    p_nombre, p_slug, p_ciudad, p_vertical, p_plan, p_color, true,
    p_representante, p_telefono, p_direccion, p_web, p_instagram
  )
  RETURNING id INTO v_id;

  -- Vincular al superadmin llamante para que RLS no bloquee acceso al nuevo tenant
  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  VALUES (
    auth.uid(), v_id, 'superadmin', true,
    COALESCE((SELECT raw_user_meta_data->>'nombre' FROM auth.users WHERE id = auth.uid()), 'Superadmin'),
    (SELECT email::TEXT FROM auth.users WHERE id = auth.uid())
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET rol = 'superadmin', activo = true;

  -- Seed permisos por defecto para roles
  PERFORM salon_seed_permisos(v_id);

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_negocio(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- ── 3. Re-vincular Hugo como superadmin en TODOS los tenants ─────────────────
DO $$
DECLARE
  v_admin_id UUID;
  v_nombre   TEXT;
  v_email    TEXT;
  v_count    INT;
BEGIN
  SELECT id, email::TEXT INTO v_admin_id, v_email
  FROM auth.users
  WHERE email = 'hugourquina@gmail.com'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'hugourquina@gmail.com no encontrado en auth.users — verifica la cuenta';
    RETURN;
  END IF;

  v_nombre := COALESCE(
    (SELECT raw_user_meta_data->>'nombre'    FROM auth.users WHERE id = v_admin_id),
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_admin_id),
    'Hugo Urquina'
  );

  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  SELECT v_admin_id, t.id, 'superadmin', true, v_nombre, v_email
  FROM tenants t
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET rol = 'superadmin', activo = true;

  SELECT COUNT(*) INTO v_count
  FROM usuarios_tenant
  WHERE user_id = v_admin_id AND rol = 'superadmin' AND activo = true;

  RAISE NOTICE '✓ Hugo (%) vinculado como superadmin en % tenant(s). UUID=%',
    v_email, v_count, v_admin_id;
END $$;

-- ── 4. Verificación diagnóstica ───────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE '── Tenants registrados ──';
  FOR r IN SELECT nombre, slug, nombre_representante, telefono FROM tenants ORDER BY nombre LOOP
    RAISE NOTICE '  % (%) — rep: % tel: %', r.nombre, r.slug, r.nombre_representante, r.telefono;
  END LOOP;
  RAISE NOTICE '── Total: % tenants ──', (SELECT COUNT(*) FROM tenants);
END $$;

DO $$ BEGIN
  RAISE NOTICE '✓ v42 aplicado: superadmin_tenants_info + crear_negocio + contacto + Hugo vinculado';
END $$;
