-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v34: Tracking de recordatorios WhatsApp
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Columnas de tracking en citas
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS recordatorio_24h_enviado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_1h_enviado  BOOLEAN DEFAULT false;

-- Índice para que la Edge Function consulte rápido los pendientes
CREATE INDEX IF NOT EXISTS idx_citas_recordatorios
  ON citas (tenant_id, fecha_inicio, recordatorio_24h_enviado, recordatorio_1h_enviado)
  WHERE estado IN ('confirmada', 'pendiente');

-- Vista: citas pendientes de recordatorio
-- La Edge Function consulta esta vista en vez de calcular rangos manualmente
CREATE OR REPLACE VIEW v_citas_recordatorio AS
SELECT
  c.id,
  c.tenant_id,
  c.fecha_inicio,
  c.estado,
  c.recordatorio_24h_enviado,
  c.recordatorio_1h_enviado,
  cl.nombre    AS cliente_nombre,
  cl.telefono  AS cliente_telefono,
  p.nombre     AS profesional_nombre,
  s.nombre     AS servicio_nombre,
  t.nombre     AS salon_nombre
FROM citas c
JOIN clientes_agenda cl ON cl.id = c.cliente_id
JOIN tenants          t  ON t.id  = c.tenant_id
LEFT JOIN profesionales p ON p.id = c.profesional_id
LEFT JOIN servicios     s ON s.id = c.servicio_id
WHERE c.estado IN ('confirmada', 'pendiente');

-- RLS: solo autenticados con acceso al tenant
ALTER VIEW v_citas_recordatorio OWNER TO postgres;

-- La Edge Function usa service_role key → bypassa RLS, no necesita política

DO $$ BEGIN
  RAISE NOTICE '✓ v34 aplicado: recordatorio_24h_enviado + recordatorio_1h_enviado en citas + view v_citas_recordatorio';
END $$;
