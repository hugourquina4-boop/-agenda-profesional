-- v58_servicio_insumos.sql
-- Insumos por servicio: qué productos del inventario se consumen al realizar un servicio
-- y en qué cantidad. Complementa servicios.productos_ids (que guarda solo los IDs).
--
-- Uso futuro: decrementar stock automáticamente al completar una cita.

CREATE TABLE IF NOT EXISTS servicio_insumos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  servicio_id uuid NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos_salon(id) ON DELETE CASCADE,
  cantidad    numeric NOT NULL DEFAULT 1,
  UNIQUE (servicio_id, producto_id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE servicio_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "servicio_insumos_tenant" ON servicio_insumos
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON servicio_insumos TO authenticated;
