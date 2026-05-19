-- v73: Historial de movimientos de stock por producto
-- Permite auditar entradas y salidas de inventario
-- APLICAR EN: Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES productos_salon(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
  cantidad      NUMERIC(10,2) NOT NULL,
  stock_antes   NUMERIC(10,2),
  stock_despues NUMERIC(10,2),
  motivo        TEXT,        -- descripción libre: 'Compra', 'Venta cita #123', 'Ajuste inventario'
  referencia_id UUID,        -- cita_id o pago_id si aplica
  usuario_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_stock_tenant_sel" ON movimientos_stock
  FOR SELECT TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "mov_stock_tenant_ins" ON movimientos_stock
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT ON movimientos_stock TO authenticated;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_mov_stock_producto ON movimientos_stock(producto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_stock_tenant   ON movimientos_stock(tenant_id, created_at DESC);
