-- v59_fixes_portal_anticipos.sql
-- 1. Arregla RLS de anticipos_profesional (INSERT policy puede estar faltando)
-- 2. Agrega SELECT anon a profesional_servicios para que el portal público funcione

-- ── 1. Anticipos: drop+recreate todas las políticas ────────────────
DROP POLICY IF EXISTS "anticipos_tenant_select" ON anticipos_profesional;
DROP POLICY IF EXISTS "anticipos_tenant_insert" ON anticipos_profesional;
DROP POLICY IF EXISTS "anticipos_tenant_update" ON anticipos_profesional;
DROP POLICY IF EXISTS "anticipos_tenant_delete" ON anticipos_profesional;
DROP POLICY IF EXISTS "anticipos_tenant"        ON anticipos_profesional;

CREATE POLICY "anticipos_tenant" ON anticipos_profesional
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON anticipos_profesional TO authenticated;

-- ── 2. profesional_servicios: acceso anon para el portal público ──
DROP POLICY IF EXISTS "ps_anon_select" ON profesional_servicios;

CREATE POLICY "ps_anon_select" ON profesional_servicios
  FOR SELECT TO anon
  USING (activo = true);

GRANT SELECT ON profesional_servicios TO anon;

DO $$ BEGIN
  RAISE NOTICE 'v59 OK — anticipos RLS unified + profesional_servicios anon SELECT';
END $$;
