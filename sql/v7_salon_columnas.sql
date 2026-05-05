-- ═══════════════════════════════════════════════════════════════
-- v7: Columnas faltantes para el módulo Salón Pro
-- Ejecutar PRIMERO en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Teléfono del profesional (para SalonEquipo)
ALTER TABLE profesionales
  ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Puntos de fidelización del cliente (para SalonClientes)
ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS puntos_fidelizacion INT DEFAULT 0;

-- ── Políticas de lectura pública para el panel del salón ─────────────────
-- Permite leer datos de tenants activos sin estar autenticado.
-- Necesario para el bypass de desarrollo (?tenant=slug).
-- Las políticas de escritura siguen requiriendo autenticación.

ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesionales    ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_agenda  ENABLE ROW LEVEL SECURITY;

-- Tenants: lectura pública de activos
DROP POLICY IF EXISTS "tenants_public_read" ON tenants;
CREATE POLICY "tenants_public_read" ON tenants
  FOR SELECT USING (activo = true);

-- Profesionales: lectura pública para tenants activos
DROP POLICY IF EXISTS "profesionales_tenant_read" ON profesionales;
CREATE POLICY "profesionales_tenant_read" ON profesionales
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- Servicios: lectura pública para tenants activos
DROP POLICY IF EXISTS "servicios_tenant_read" ON servicios;
CREATE POLICY "servicios_tenant_read" ON servicios
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- Citas: lectura pública para tenants activos (panel interno)
DROP POLICY IF EXISTS "citas_tenant_read" ON citas;
CREATE POLICY "citas_tenant_read" ON citas
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- Clientes: lectura pública para tenants activos (panel interno)
DROP POLICY IF EXISTS "clientes_agenda_tenant_read" ON clientes_agenda;
CREATE POLICY "clientes_agenda_tenant_read" ON clientes_agenda
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- ═══ Verificar que todo quedó bien ══════════════════════════════
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profesionales' AND column_name = 'telefono';
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'clientes_agenda' AND column_name = 'puntos_fidelizacion';
