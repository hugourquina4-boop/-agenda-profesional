-- v46: servicios enhanced — precio_oferta, recordatorio, profesionales_ids
-- Aplica: Supabase Dashboard → SQL Editor → Run

ALTER TABLE servicios ADD COLUMN IF NOT EXISTS precio_oferta NUMERIC;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS recordatorio_texto TEXT;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS profesionales_ids UUID[] DEFAULT '{}';

-- Allow authenticated users to read/write these new columns (RLS ya cubre por tenant_id)
-- No new policies needed — existing servicios policies cubren todas las columnas de la tabla

COMMENT ON COLUMN servicios.precio_oferta IS 'Precio especial/oferta. NULL = sin oferta activa.';
COMMENT ON COLUMN servicios.recordatorio_texto IS 'Plantilla WA de recordatorio. Soporta {{nombre_cliente}}, {{hora}}, {{servicio}}.';
COMMENT ON COLUMN servicios.profesionales_ids IS 'UUID[] de profesionales habilitados para este servicio. [] = todos.';
