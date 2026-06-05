-- v88_bloqueo_recurrente.sql
-- Adds repeat_rule column to horarios_excepcion for recurring blocked/modified days

ALTER TABLE horarios_excepcion
  ADD COLUMN IF NOT EXISTS repeat_rule TEXT DEFAULT NULL
  CHECK (repeat_rule IN ('weekly', 'monthly'));

COMMENT ON COLUMN horarios_excepcion.repeat_rule IS
  'Recurrence marker: weekly = created as part of a weekly series, monthly = monthly series. NULL = one-off.';
