-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v32: Funciones superadmin (dashboard + onboarding)
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── Info completa de todos los negocios (solo superadmin) ─────────
CREATE OR REPLACE FUNCTION superadmin_tenants_info()
RETURNS TABLE (
  tenant_id           UUID,
  nombre              TEXT,
  slug                TEXT,
  ciudad              TEXT,
  vertical            TEXT,
  plan                TEXT,
  color_primario      TEXT,
  activo              BOOLEAN,
  created_at          TIMESTAMPTZ,
  citas_mes           BIGINT,
  ingresos_mes        NUMERIC,
  total_profesionales BIGINT,
  total_clientes      BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
END; $$;

GRANT EXECUTE ON FUNCTION superadmin_tenants_info() TO authenticated;

-- ── Crear nuevo negocio (solo superadmin) ────────────────────────
CREATE OR REPLACE FUNCTION crear_negocio(
  p_nombre   TEXT,
  p_slug     TEXT,
  p_ciudad   TEXT    DEFAULT NULL,
  p_vertical TEXT    DEFAULT 'salon',
  p_plan     TEXT    DEFAULT 'starter',
  p_color    TEXT    DEFAULT '#f43f5e'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND rol = 'superadmin' AND activo = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo superadmin';
  END IF;

  -- Normalizar slug: lowercase, sin tildes, solo alfanumérico y guiones
  p_slug := lower(trim(regexp_replace(p_slug, '[^a-z0-9-]', '-', 'g')));
  p_slug := regexp_replace(p_slug, '-+', '-', 'g');
  p_slug := trim(both '-' from p_slug);

  IF EXISTS (SELECT 1 FROM tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug ya en uso: %', p_slug;
  END IF;

  INSERT INTO tenants (nombre, slug, ciudad, vertical, plan, color_primario, activo)
  VALUES (p_nombre, p_slug, p_ciudad, p_vertical, p_plan, p_color, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION crear_negocio(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v32 aplicado: superadmin_tenants_info + crear_negocio';
END $$;
