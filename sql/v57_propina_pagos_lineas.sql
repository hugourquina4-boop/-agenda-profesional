-- v57_propina_pagos_lineas.sql
-- Propina en pagos + tabla de líneas de cobro (productos vendidos junto a la cita).
--
-- pagos.propina: monto de propina recibido (se separa del servicio para analytics)
-- pagos_lineas:  cada producto vendido al cobrar una cita (precio, cantidad, subtotal)

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS propina NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS pagos_lineas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  pago_id        uuid NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  producto_id    uuid REFERENCES productos_salon(id),
  nombre         text NOT NULL,
  cantidad       numeric NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE pagos_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_lineas_tenant" ON pagos_lineas
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

GRANT SELECT, INSERT, DELETE ON pagos_lineas TO authenticated;
