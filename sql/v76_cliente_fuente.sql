-- v76: Campo "cómo nos conociste" en clientes_agenda
-- Fuente de captación del cliente para tracking de marketing
-- APLICAR EN: Supabase → SQL Editor

ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS fuente_captacion TEXT;

-- Valores esperados: 'instagram','referido','google','paso_por_aqui','tiktok','facebook','otro'
-- No se necesita CHECK constraint para flexibilidad
