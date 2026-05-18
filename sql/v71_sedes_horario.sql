-- v71: horario de atención por sede
-- Permite definir hora_apertura/hora_cierre por local.
-- Se muestra en el portal como "Horario de atención" y puede filtrar
-- profesionales disponibles según el horario de su sede.

ALTER TABLE sedes ADD COLUMN IF NOT EXISTS hora_apertura TIME DEFAULT '09:00';
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS hora_cierre   TIME DEFAULT '20:00';
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS dias_activos  INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6];

COMMENT ON COLUMN sedes.hora_apertura IS 'Hora de apertura de la sede (HH:MM)';
COMMENT ON COLUMN sedes.hora_cierre   IS 'Hora de cierre de la sede (HH:MM)';
COMMENT ON COLUMN sedes.dias_activos  IS 'Días de la semana activos: 0=Dom,1=Lun…6=Sáb';

DO $$ BEGIN
  RAISE NOTICE '✓ v71: sedes — hora_apertura, hora_cierre, dias_activos añadidos';
END $$;
