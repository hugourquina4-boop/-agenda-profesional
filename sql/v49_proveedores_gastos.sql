-- v49_proveedores_gastos.sql
-- Módulo de proveedores y registro de gastos operativos del negocio

-- ── Tabla proveedores ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  contacto    TEXT,
  telefono    TEXT,
  email       TEXT,
  notas       TEXT,
  activo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_tenant_select" ON proveedores
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "proveedores_tenant_insert" ON proveedores
  FOR INSERT WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "proveedores_tenant_update" ON proveedores
  FOR UPDATE USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "proveedores_tenant_delete" ON proveedores
  FOR DELETE USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON proveedores TO authenticated;
CREATE INDEX IF NOT EXISTS idx_proveedores_tenant ON proveedores(tenant_id);

-- ── Tabla gastos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proveedor_id UUID        REFERENCES proveedores(id) ON DELETE SET NULL,
  concepto     TEXT        NOT NULL,
  monto        NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago  TEXT        NOT NULL DEFAULT 'efectivo',
  categoria    TEXT        NOT NULL DEFAULT 'Otros',
  fecha        DATE        NOT NULL DEFAULT CURRENT_DATE,
  notas        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gastos_tenant_select" ON gastos
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "gastos_tenant_insert" ON gastos
  FOR INSERT WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "gastos_tenant_update" ON gastos
  FOR UPDATE USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "gastos_tenant_delete" ON gastos
  FOR DELETE USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON gastos TO authenticated;
CREATE INDEX IF NOT EXISTS idx_gastos_tenant     ON gastos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha      ON gastos(tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor  ON gastos(proveedor_id);
