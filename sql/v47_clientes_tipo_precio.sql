-- v47: clientes tipo_precio (normal | mayorista) + tags libres
-- Aplica: Supabase Dashboard → SQL Editor → Run

ALTER TABLE clientes_agenda ADD COLUMN IF NOT EXISTS tipo_precio TEXT DEFAULT 'normal'
  CHECK (tipo_precio IN ('normal','mayorista'));

ALTER TABLE clientes_agenda ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN clientes_agenda.tipo_precio IS 'normal = precio lista, mayorista = precio especial de mayorista';
COMMENT ON COLUMN clientes_agenda.tags IS 'Etiquetas libres del negocio (ej: STAR, VIP, frecuente, referido)';
