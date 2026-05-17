-- v52: Vincular productos de inventario a servicios
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS productos_ids UUID[];
