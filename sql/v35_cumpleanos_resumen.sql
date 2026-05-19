-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v35: Cumpleaños automáticos + resumen diario
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Tracking de mensajes de cumpleaños enviados (evita duplicados en el año)
ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS cumpleanos_ultimo_envio DATE;

-- Vista: clientes con cumpleaños hoy (sin envío este año)
CREATE OR REPLACE VIEW v_cumpleanos_hoy AS
SELECT
  ca.id,
  ca.nombre,
  ca.telefono,
  ca.tenant_id,
  ca.puntos_fidelizacion,
  t.nombre AS salon_nombre,
  t.whatsapp AS salon_whatsapp,
  t.color_primario
FROM clientes_agenda ca
JOIN tenants t ON t.id = ca.tenant_id
WHERE
  ca.telefono IS NOT NULL
  AND ca.fecha_nacimiento IS NOT NULL
  AND EXTRACT(month FROM ca.fecha_nacimiento) = EXTRACT(month FROM CURRENT_DATE AT TIME ZONE 'America/Bogota')
  AND EXTRACT(day   FROM ca.fecha_nacimiento) = EXTRACT(day   FROM CURRENT_DATE AT TIME ZONE 'America/Bogota')
  AND (
    ca.cumpleanos_ultimo_envio IS NULL
    OR EXTRACT(year FROM ca.cumpleanos_ultimo_envio) < EXTRACT(year FROM CURRENT_DATE AT TIME ZONE 'America/Bogota')
  );

-- Vista: resumen del día por tenant (para notificación vespertina al dueño)
CREATE OR REPLACE VIEW v_resumen_dia AS
SELECT
  t.id AS tenant_id,
  t.nombre AS salon_nombre,
  t.whatsapp AS salon_whatsapp,
  COUNT(c.id) FILTER (WHERE c.estado = 'completada') AS citas_completadas,
  COUNT(c.id) FILTER (WHERE c.estado = 'no_asistio') AS no_shows,
  COUNT(c.id) FILTER (WHERE c.estado IN ('pendiente','confirmada')) AS citas_manana,
  COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'pagado'), 0) AS ingresos_hoy
FROM tenants t
LEFT JOIN citas c ON c.tenant_id = t.id
  AND (c.fecha_inicio AT TIME ZONE 'America/Bogota')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
LEFT JOIN pagos p ON p.tenant_id = t.id
  AND (p.created_at AT TIME ZONE 'America/Bogota')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
WHERE t.whatsapp IS NOT NULL AND t.whatsapp <> ''
GROUP BY t.id, t.nombre, t.whatsapp;

-- Vista: citas de mañana por tenant (para incluir en resumen diario)
CREATE OR REPLACE VIEW v_citas_manana_count AS
SELECT
  tenant_id,
  COUNT(*) AS total
FROM citas
WHERE
  (fecha_inicio AT TIME ZONE 'America/Bogota')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date + 1
  AND estado IN ('confirmada', 'pendiente')
GROUP BY tenant_id;

DO $$ BEGIN
  RAISE NOTICE '✓ v35 aplicado: cumpleanos_ultimo_envio + vistas v_cumpleanos_hoy + v_resumen_dia + v_citas_manana_count';
END $$;
