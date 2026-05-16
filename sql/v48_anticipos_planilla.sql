-- v48: anticipos y deducciones para planilla de pagos de profesionales
-- Aplica: Supabase Dashboard → SQL Editor → Run

CREATE TABLE IF NOT EXISTS anticipos_profesional (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id  UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  concepto        TEXT,
  tipo            TEXT NOT NULL DEFAULT 'anticipo' CHECK (tipo IN ('anticipo','deduccion')),
  liquidado       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE anticipos_profesional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anticipos_tenant_select" ON anticipos_profesional
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "anticipos_tenant_insert" ON anticipos_profesional
  FOR INSERT WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "anticipos_tenant_update" ON anticipos_profesional
  FOR UPDATE USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "anticipos_tenant_delete" ON anticipos_profesional
  FOR DELETE USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON anticipos_profesional TO authenticated;
CREATE INDEX IF NOT EXISTS idx_anticipos_tenant_prof ON anticipos_profesional(tenant_id, profesional_id);
