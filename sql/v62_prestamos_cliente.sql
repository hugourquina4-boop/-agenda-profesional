-- v62: préstamos a clientes (saldo deudor, abonos, historial)

CREATE TABLE IF NOT EXISTS prestamos_cliente (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id   UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL DEFAULT 'prestamo'
                 CHECK (tipo IN ('prestamo','abono')),
  monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  concepto     TEXT,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prestamos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prestamos_tenant" ON prestamos_cliente FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));

GRANT SELECT, INSERT, UPDATE, DELETE ON prestamos_cliente TO authenticated;
