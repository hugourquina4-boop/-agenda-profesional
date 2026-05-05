-- ═══════════════════════════════════════════════════════════════
-- v9 — Permisos anon para desarrollo sin auth
-- Ejecuta esto en Supabase → SQL Editor
-- NOTA: estas políticas permiten writes sin sesión autenticada.
--       Se reemplazarán cuando implementemos login (paso C).
-- ═══════════════════════════════════════════════════════════════

-- GRANTs: el rol anon necesita INSERT/UPDATE además de SELECT
GRANT INSERT, UPDATE ON citas            TO anon;
GRANT INSERT, UPDATE ON clientes_agenda  TO anon;
GRANT INSERT, UPDATE ON horarios         TO anon;
GRANT INSERT, UPDATE ON profesionales    TO anon;
GRANT INSERT, UPDATE ON servicios        TO anon;
GRANT USAGE, SELECT   ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ── Citas ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dev_citas_ins" ON citas;
DROP POLICY IF EXISTS "dev_citas_upd" ON citas;

CREATE POLICY "dev_citas_ins" ON citas
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

CREATE POLICY "dev_citas_upd" ON citas
  FOR UPDATE USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  ) WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- ── Clientes ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dev_clientes_ins" ON clientes_agenda;
DROP POLICY IF EXISTS "dev_clientes_upd" ON clientes_agenda;

CREATE POLICY "dev_clientes_ins" ON clientes_agenda
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

CREATE POLICY "dev_clientes_upd" ON clientes_agenda
  FOR UPDATE USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- ── Horarios ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dev_horarios_ins" ON horarios;
DROP POLICY IF EXISTS "dev_horarios_upd" ON horarios;

CREATE POLICY "dev_horarios_ins" ON horarios
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

CREATE POLICY "dev_horarios_upd" ON horarios
  FOR UPDATE USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  ) WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- ── Profesionales ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "dev_profs_ins" ON profesionales;
DROP POLICY IF EXISTS "dev_profs_upd" ON profesionales;

CREATE POLICY "dev_profs_ins" ON profesionales
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

CREATE POLICY "dev_profs_upd" ON profesionales
  FOR UPDATE USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- ── Servicios ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dev_servs_ins" ON servicios;
DROP POLICY IF EXISTS "dev_servs_upd" ON servicios;

CREATE POLICY "dev_servs_ins" ON servicios
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

CREATE POLICY "dev_servs_upd" ON servicios
  FOR UPDATE USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- ═══ Verificar ═══════════════════════════════════════════════════
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_name IN ('citas','clientes_agenda','horarios','profesionales','servicios')
ORDER BY table_name, privilege_type;
