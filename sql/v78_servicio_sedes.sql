-- v78: sedes_ids en servicios — permite asignar cada servicio a sedes específicas
-- null / array vacío = disponible en TODAS las sedes del negocio

ALTER TABLE servicios ADD COLUMN IF NOT EXISTS sedes_ids UUID[];

-- Índice para filtrar servicios por sede
CREATE INDEX IF NOT EXISTS idx_servicios_sedes ON servicios USING GIN(sedes_ids);

DO $$ BEGIN
  RAISE NOTICE '✓ v78: sedes_ids — servicios asignables a sedes específicas (null = todas)';
END $$;
