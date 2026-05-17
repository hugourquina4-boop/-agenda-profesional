-- v51: Columna notas en pagos (para motivo de anulación)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS notas TEXT;
