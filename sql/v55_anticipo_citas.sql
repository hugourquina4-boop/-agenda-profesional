-- v55_anticipo_citas.sql
-- Añade campo anticipo a citas para registrar abonos/anticipos sobre la reserva.
-- La columna acumula el total abonado (se suma cada vez que el cliente abona).

ALTER TABLE citas ADD COLUMN IF NOT EXISTS anticipo NUMERIC DEFAULT 0;

-- No requiere nueva política RLS — citas ya tiene RLS con políticas tenant_id vigentes.
-- El campo es accesible a través de las queries existentes.
