-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v28: Órdenes en espera + Desempeño de profesionales
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. TABLA ORDENES EN ESPERA ──────────────────────────────────────
-- Flujo: profesional crea orden → admin la cobra → se registra en pagos
CREATE TABLE IF NOT EXISTS ordenes_espera (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id     UUID REFERENCES clientes_agenda(id) ON DELETE SET NULL,
  cliente_nombre TEXT,                     -- nombre libre si no hay cliente registrado
  profesional_id UUID REFERENCES profesionales(id) ON DELETE SET NULL,
  items          JSONB NOT NULL DEFAULT '[]',
  -- items: [{ servicio_id, nombre, precio, cantidad }]
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  notas          TEXT,
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','pagado','cancelado')),
  pago_id        UUID REFERENCES pagos(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_tenant ON ordenes_espera(tenant_id, estado, created_at DESC);

ALTER TABLE ordenes_espera ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordenes_tenant"    ON ordenes_espera;
DROP POLICY IF EXISTS "ordenes_dev_write" ON ordenes_espera;

CREATE POLICY "ordenes_tenant" ON ordenes_espera
  FOR ALL USING (tenant_id = mi_tenant_id());

CREATE POLICY "ordenes_dev_write" ON ordenes_espera
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));

GRANT SELECT, INSERT, UPDATE, DELETE ON ordenes_espera TO anon;
GRANT ALL ON ordenes_espera TO authenticated;

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ordenes_updated_at ON ordenes_espera;
CREATE TRIGGER trg_ordenes_updated_at
  BEFORE UPDATE ON ordenes_espera
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. VISTA DE DESEMPEÑO POR PROFESIONAL ──────────────────────────
-- Agrega: horas trabajadas, citas, ingresos cobrados, comisión, no-show rate
-- Filtrar desde el frontend por tenant_id y mes
CREATE OR REPLACE VIEW v_desempeno_prof AS
SELECT
  p.tenant_id,
  p.id                                                              AS profesional_id,
  p.nombre,
  p.especialidad,
  p.foto_url,
  DATE_TRUNC('month', c.fecha_inicio)                              AS mes,
  COUNT(c.id) FILTER (WHERE c.estado = 'completada')               AS citas_completadas,
  ROUND(COALESCE(
    SUM(EXTRACT(EPOCH FROM (c.fecha_fin - c.fecha_inicio)) / 3600)
    FILTER (WHERE c.estado = 'completada'), 0
  )::NUMERIC, 1)                                                   AS horas_trabajadas,
  COALESCE(SUM(pg.monto) FILTER (WHERE pg.estado = 'pagado'), 0)   AS ingresos_cobrados,
  COALESCE(SUM(co.monto_comision), 0)                              AS comision_ganada,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.estado = 'no_asistio') * 100.0
    / NULLIF(COUNT(c.id) FILTER (WHERE c.estado != 'cancelada'), 0), 1
  )                                                                AS no_show_rate
FROM profesionales p
LEFT JOIN citas c       ON c.profesional_id = p.id
LEFT JOIN pagos pg      ON pg.cita_id       = c.id AND pg.estado = 'pagado'
LEFT JOIN comisiones co ON co.cita_id       = c.id
WHERE p.activo = true
GROUP BY
  p.tenant_id, p.id, p.nombre, p.especialidad, p.foto_url,
  DATE_TRUNC('month', c.fecha_inicio);

GRANT SELECT ON v_desempeno_prof TO authenticated;
GRANT SELECT ON v_desempeno_prof TO anon;

-- ── 3. CAMPOS CONFIG_VERTICAL PARA OPERACIÓN GENERAL ───────────────
-- No requiere ALTER TABLE — config_vertical es JSONB, se agrega desde la app.
-- Campos que se usarán:
--   tipologia:            'salon' | 'barberia' | 'spa' | 'unas' | 'estetica'
--   hora_apertura:        '09:00'
--   hora_cierre:          '20:00'
--   duracion_slot_min:    30     (minutos mínimos por cita)
--   anticipacion_horas:   2      (horas mínimas para reservar online)
--   politica_cancelacion: texto libre

-- Mensaje de confirmación
DO $$ BEGIN
  RAISE NOTICE '✓ v28 aplicado correctamente: ordenes_espera, v_desempeno_prof, trigger updated_at';
END $$;
