-- v14: Paquetes prepagados por cliente
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS paquetes_cliente (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id       UUID          NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  servicio_id      UUID          REFERENCES servicios(id),
  nombre           TEXT          NOT NULL,
  sesiones_total   INT           NOT NULL DEFAULT 1 CHECK (sesiones_total >= 1),
  sesiones_usadas  INT           NOT NULL DEFAULT 0 CHECK (sesiones_usadas >= 0),
  precio_total     NUMERIC(12,2),
  vencimiento      DATE,
  notas            TEXT,
  activo           BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE paquetes_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paquetes_cliente_sel" ON paquetes_cliente
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

CREATE POLICY "paquetes_cliente_ins" ON paquetes_cliente
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

CREATE POLICY "paquetes_cliente_upd" ON paquetes_cliente
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

CREATE POLICY "paquetes_cliente_del" ON paquetes_cliente
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON paquetes_cliente TO authenticated;
