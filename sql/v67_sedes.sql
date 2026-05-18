-- v67: multi-sede — negocios con varias sucursales
-- Permite que un tenant gestione múltiples locales.
-- Profesionales se asignan a una sede; citas opcionalmente también.

CREATE TABLE IF NOT EXISTS sedes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  direccion  TEXT,
  ciudad     TEXT,
  telefono   TEXT,
  activo     BOOLEAN     NOT NULL DEFAULT true,
  principal  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sedes_select" ON sedes
  FOR SELECT USING (tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true));

CREATE POLICY "sedes_insert" ON sedes
  FOR INSERT WITH CHECK (tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true));

CREATE POLICY "sedes_update" ON sedes
  FOR UPDATE USING (tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true));

CREATE POLICY "sedes_delete" ON sedes
  FOR DELETE USING (tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true));

GRANT SELECT, INSERT, UPDATE, DELETE ON sedes TO authenticated;

-- Profesional puede pertenecer a una sede específica (nullable = trabaja en todas)
ALTER TABLE profesionales ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL;

-- Citas también pueden estar asociadas a una sede
ALTER TABLE citas ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL;

DO $$ BEGIN
  RAISE NOTICE '✓ v67: sedes — multi-sede con asignación de profesionales y citas';
END $$;
