-- v60: tabla pedidos_proveedor con estados y líneas de ítems

CREATE TABLE IF NOT EXISTS pedidos_proveedor (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proveedor_id  UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  numero        TEXT,                        -- número/referencia interno
  estado        TEXT NOT NULL DEFAULT 'abierto'
                  CHECK (estado IN ('abierto','cotizaciones','aceptado','entregado','pagado','cancelado')),
  fecha_pedido  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega DATE,
  total_estimado NUMERIC(12,2) DEFAULT 0,
  total_real     NUMERIC(12,2) DEFAULT 0,
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedidos_proveedor_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID NOT NULL REFERENCES pedidos_proveedor(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL,
  descripcion  TEXT NOT NULL,
  cantidad     NUMERIC(10,2) DEFAULT 1,
  unidad       TEXT,
  precio_unit  NUMERIC(12,2) DEFAULT 0,
  total        NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unit) STORED
);

ALTER TABLE pedidos_proveedor       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_proveedor_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_tenant" ON pedidos_proveedor FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));

CREATE POLICY "pedidos_items_tenant" ON pedidos_proveedor_items FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));

GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_proveedor       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_proveedor_items TO authenticated;
