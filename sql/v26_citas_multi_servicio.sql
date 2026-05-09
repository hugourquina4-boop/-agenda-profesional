-- v26: Soporte multi-servicio en citas
-- servicios_ids almacena todos los UUIDs de servicios seleccionados.
-- servicio_id (existente) mantiene el servicio principal para compatibilidad.

ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS servicios_ids UUID[];

COMMENT ON COLUMN citas.servicios_ids IS 'IDs de todos los servicios incluidos en la cita (multi-servicio)';
