-- v83_cliente_barrio: segmentación geográfica básica por barrio/zona
ALTER TABLE clientes_agenda ADD COLUMN IF NOT EXISTS barrio TEXT;

-- Índice para filtros rápidos por barrio en campañas
CREATE INDEX IF NOT EXISTS idx_clientes_barrio ON clientes_agenda(tenant_id, barrio) WHERE barrio IS NOT NULL;

-- Columna de segmento barrio en campañas (complementa segmento = 'por_barrio')
ALTER TABLE campanas_marketing ADD COLUMN IF NOT EXISTS segmento_barrio TEXT;

-- Ampliar CHECK de segmento para incluir 'por_barrio'
ALTER TABLE campanas_marketing DROP CONSTRAINT IF EXISTS campanas_marketing_segmento_check;
ALTER TABLE campanas_marketing ADD CONSTRAINT campanas_marketing_segmento_check
  CHECK (segmento IN ('todos','sin_visita','con_tag','cumpleanos_mes','por_barrio'));
