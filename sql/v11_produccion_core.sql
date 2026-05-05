-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v11: Producción Core
-- Corre esto en Supabase → SQL Editor
-- Incluye: anti-overbooking, pagos, comisiones, eventos, analytics
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. ANTI-OVERBOOKING ─────────────────────────────────────────────
-- Necesita la extensión btree_gist para EXCLUDE sobre rangos
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Constraint: mismo profesional no puede tener dos citas con rangos solapados
-- Excluye citas canceladas y no_asistio (esas no bloquean el slot)
ALTER TABLE citas DROP CONSTRAINT IF EXISTS no_solapamiento_profesional;
ALTER TABLE citas ADD CONSTRAINT no_solapamiento_profesional
  EXCLUDE USING gist (
    profesional_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (estado NOT IN ('cancelada', 'no_asistio'));

-- ── 2. TABLA PAGOS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cita_id      UUID NOT NULL REFERENCES citas(id)   ON DELETE CASCADE,
  monto        NUMERIC(10,2) NOT NULL,
  metodo       TEXT NOT NULL DEFAULT 'efectivo'
                 CHECK (metodo IN ('efectivo','nequi','daviplata','transferencia','tarjeta','wompi')),
  estado       TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','pagado','reembolsado')),
  referencia   TEXT,    -- número de transacción / voucher
  notas        TEXT,
  creado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_cita   ON pagos(cita_id);
CREATE INDEX IF NOT EXISTS idx_pagos_tenant ON pagos(tenant_id, created_at DESC);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagos_tenant"    ON pagos;
DROP POLICY IF EXISTS "pagos_dev_write" ON pagos;
CREATE POLICY "pagos_tenant"    ON pagos FOR ALL USING (tenant_id = mi_tenant_id());
CREATE POLICY "pagos_dev_write" ON pagos FOR ALL USING (
  tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

GRANT SELECT, INSERT, UPDATE ON pagos TO anon;
GRANT SELECT, INSERT, UPDATE ON pagos TO authenticated;

-- ── 3. COMISIONES ───────────────────────────────────────────────────
-- Regla por profesional (porcentaje que se lleva del servicio)
CREATE TABLE IF NOT EXISTS commission_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  porcentaje     NUMERIC(5,2) NOT NULL DEFAULT 40.00
                   CHECK (porcentaje BETWEEN 0 AND 100),
  activo         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profesional_id)
);

-- Comisión calculada por cita pagada
CREATE TABLE IF NOT EXISTS comisiones (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cita_id        UUID NOT NULL REFERENCES citas(id),
  pago_id        UUID REFERENCES pagos(id),
  profesional_id UUID NOT NULL REFERENCES profesionales(id),
  monto_servicio NUMERIC(10,2) NOT NULL,
  porcentaje     NUMERIC(5,2) NOT NULL,
  monto_comision NUMERIC(10,2) NOT NULL,  -- = monto_servicio * porcentaje / 100
  liquidado      BOOLEAN DEFAULT false,
  fecha_liquidacion DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comisiones_prof  ON comisiones(profesional_id, liquidado);
CREATE INDEX IF NOT EXISTS idx_comisiones_tenant ON comisiones(tenant_id, created_at DESC);

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones       ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_tenant" ON commission_rules;
DROP POLICY IF EXISTS "cr_dev"    ON commission_rules;
DROP POLICY IF EXISTS "co_tenant" ON comisiones;
DROP POLICY IF EXISTS "co_dev"    ON comisiones;
CREATE POLICY "cr_tenant" ON commission_rules FOR ALL USING (tenant_id = mi_tenant_id());
CREATE POLICY "cr_dev"    ON commission_rules FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));
CREATE POLICY "co_tenant" ON comisiones       FOR ALL USING (tenant_id = mi_tenant_id());
CREATE POLICY "co_dev"    ON comisiones       FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));

GRANT SELECT, INSERT, UPDATE ON commission_rules TO anon;
GRANT SELECT, INSERT, UPDATE ON comisiones       TO anon;
GRANT ALL ON commission_rules TO authenticated;
GRANT ALL ON comisiones       TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Función: calcular y registrar comisión automáticamente al marcar pago
CREATE OR REPLACE FUNCTION calcular_comision_pago()
RETURNS TRIGGER AS $$
DECLARE
  v_cita       citas%ROWTYPE;
  v_servicio   servicios%ROWTYPE;
  v_rule       commission_rules%ROWTYPE;
  v_comision   NUMERIC(10,2);
BEGIN
  IF NEW.estado = 'pagado' AND OLD.estado <> 'pagado' THEN
    SELECT * INTO v_cita     FROM citas     WHERE id = NEW.cita_id;
    SELECT * INTO v_servicio FROM servicios WHERE id = v_cita.servicio_id;
    SELECT * INTO v_rule     FROM commission_rules
      WHERE profesional_id = v_cita.profesional_id AND activo = true;

    IF FOUND THEN
      v_comision := NEW.monto * v_rule.porcentaje / 100;
      INSERT INTO comisiones
        (tenant_id, cita_id, pago_id, profesional_id, monto_servicio, porcentaje, monto_comision)
      VALUES
        (NEW.tenant_id, NEW.cita_id, NEW.id, v_cita.profesional_id,
         NEW.monto, v_rule.porcentaje, v_comision);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comision_al_pagar ON pagos;
CREATE TRIGGER trg_comision_al_pagar
  AFTER UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION calcular_comision_pago();

-- ── 4. TABLA DE EVENTOS (event bus liviano) ─────────────────────────
-- Reemplaza pub/sub complejo. Un worker (n8n / edge function) consume
-- eventos no procesados y los acciona (recordatorios, webhooks, etc.)
CREATE TABLE IF NOT EXISTS eventos_agenda (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,   -- 'appointment.created' | 'appointment.cancelled' |
                                 -- 'appointment.completed' | 'payment.completed' |
                                 -- 'reminder.24h' | 'reminder.1h'
  payload      JSONB NOT NULL DEFAULT '{}',
  procesado    BOOLEAN DEFAULT false,
  procesado_at TIMESTAMPTZ,
  error_msg    TEXT,
  intentos     INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_pendientes
  ON eventos_agenda(procesado, created_at) WHERE procesado = false;
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_agenda(tipo, tenant_id);

ALTER TABLE eventos_agenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ev_tenant" ON eventos_agenda;
DROP POLICY IF EXISTS "ev_dev"    ON eventos_agenda;
CREATE POLICY "ev_tenant" ON eventos_agenda FOR ALL USING (tenant_id = mi_tenant_id());
CREATE POLICY "ev_dev"    ON eventos_agenda FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));
GRANT SELECT, INSERT, UPDATE ON eventos_agenda TO anon;
GRANT ALL ON eventos_agenda TO authenticated;

-- Trigger: publicar evento al crear/actualizar cita
CREATE OR REPLACE FUNCTION publicar_evento_cita()
RETURNS TRIGGER AS $$
DECLARE v_tipo TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tipo := 'appointment.created';
  ELSIF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN
    v_tipo := 'appointment.cancelled';
  ELSIF NEW.estado = 'completada' AND OLD.estado <> 'completada' THEN
    v_tipo := 'appointment.completed';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO eventos_agenda (tenant_id, tipo, payload)
  VALUES (
    NEW.tenant_id,
    v_tipo,
    jsonb_build_object(
      'cita_id',        NEW.id,
      'cliente_id',     NEW.cliente_id,
      'profesional_id', NEW.profesional_id,
      'servicio_id',    NEW.servicio_id,
      'fecha_inicio',   NEW.fecha_inicio,
      'estado',         NEW.estado
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evento_cita ON citas;
CREATE TRIGGER trg_evento_cita
  AFTER INSERT OR UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION publicar_evento_cita();

-- Trigger: publicar evento al confirmar pago
CREATE OR REPLACE FUNCTION publicar_evento_pago()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'pagado' AND OLD.estado <> 'pagado' THEN
    INSERT INTO eventos_agenda (tenant_id, tipo, payload)
    VALUES (
      NEW.tenant_id,
      'payment.completed',
      jsonb_build_object(
        'pago_id',  NEW.id,
        'cita_id',  NEW.cita_id,
        'monto',    NEW.monto,
        'metodo',   NEW.metodo
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evento_pago ON pagos;
CREATE TRIGGER trg_evento_pago
  AFTER UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION publicar_evento_pago();

-- ── 5. RECORDATORIOS — función que genera eventos reminder ──────────
-- Llamar esta función desde n8n / pg_cron cada hora
CREATE OR REPLACE FUNCTION generar_recordatorios()
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_cita  RECORD;
BEGIN
  -- Recordatorios 24h
  FOR v_cita IN
    SELECT c.id, c.tenant_id, c.cliente_id, c.profesional_id,
           c.servicio_id, c.fecha_inicio
    FROM citas c
    WHERE c.estado IN ('pendiente','confirmada')
      AND c.recordatorio_24h_enviado = false
      AND c.fecha_inicio BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
  LOOP
    INSERT INTO eventos_agenda (tenant_id, tipo, payload)
    VALUES (
      v_cita.tenant_id,
      'reminder.24h',
      jsonb_build_object(
        'cita_id',        v_cita.id,
        'cliente_id',     v_cita.cliente_id,
        'profesional_id', v_cita.profesional_id,
        'fecha_inicio',   v_cita.fecha_inicio
      )
    );
    UPDATE citas SET recordatorio_24h_enviado = true WHERE id = v_cita.id;
    v_count := v_count + 1;
  END LOOP;

  -- Recordatorios 1h
  FOR v_cita IN
    SELECT c.id, c.tenant_id, c.cliente_id, c.servicio_id, c.fecha_inicio
    FROM citas c
    WHERE c.estado IN ('pendiente','confirmada')
      AND c.recordatorio_enviado = false
      AND c.fecha_inicio BETWEEN NOW() + INTERVAL '50 minutes' AND NOW() + INTERVAL '70 minutes'
  LOOP
    INSERT INTO eventos_agenda (tenant_id, tipo, payload)
    VALUES (
      v_cita.tenant_id,
      'reminder.1h',
      jsonb_build_object(
        'cita_id',    v_cita.id,
        'cliente_id', v_cita.cliente_id,
        'fecha_inicio', v_cita.fecha_inicio
      )
    );
    UPDATE citas SET recordatorio_enviado = true WHERE id = v_cita.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. ANALYTICS — vistas SQL ───────────────────────────────────────

-- Vista: KPIs mensuales por tenant
CREATE OR REPLACE VIEW v_kpis_mes AS
SELECT
  c.tenant_id,
  DATE_TRUNC('month', c.fecha_inicio)                            AS mes,
  COUNT(*)                                                       AS total_citas,
  COUNT(*) FILTER (WHERE c.estado = 'completada')                AS completadas,
  COUNT(*) FILTER (WHERE c.estado = 'no_asistio')                AS no_shows,
  COUNT(*) FILTER (WHERE c.estado = 'cancelada')                 AS canceladas,
  ROUND(
    COUNT(*) FILTER (WHERE c.estado = 'no_asistio') * 100.0
    / NULLIF(COUNT(*), 0), 1
  )                                                              AS no_show_rate,
  ROUND(AVG(s.precio) FILTER (WHERE c.estado = 'completada'), 0) AS avg_ticket,
  SUM(s.precio) FILTER (WHERE c.estado = 'completada')           AS ingresos_brutos
FROM citas c
JOIN servicios s ON c.servicio_id = s.id
GROUP BY c.tenant_id, DATE_TRUNC('month', c.fecha_inicio);

-- Vista: ingresos y comisiones por profesional (mes actual)
CREATE OR REPLACE VIEW v_revenue_staff AS
SELECT
  p.tenant_id,
  p.id                                                            AS profesional_id,
  p.nombre,
  COUNT(c.id) FILTER (WHERE c.estado = 'completada')             AS citas_completadas,
  SUM(s.precio) FILTER (WHERE c.estado = 'completada')           AS ingresos_brutos,
  COALESCE(SUM(co.monto_comision), 0)                            AS comisiones_ganadas,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.estado = 'no_asistio') * 100.0
    / NULLIF(COUNT(c.id), 0), 1
  )                                                              AS no_show_rate_prof
FROM profesionales p
LEFT JOIN citas c     ON c.profesional_id = p.id
  AND c.fecha_inicio >= DATE_TRUNC('month', NOW())
LEFT JOIN servicios s ON c.servicio_id = s.id
LEFT JOIN comisiones co ON co.profesional_id = p.id
  AND co.created_at >= DATE_TRUNC('month', NOW())
WHERE p.activo = true
GROUP BY p.tenant_id, p.id, p.nombre;

-- Vista: retention rate (últimos 90 días, por tenant)
CREATE OR REPLACE VIEW v_retention AS
SELECT
  tenant_id,
  COUNT(DISTINCT cliente_id)                                     AS clientes_activos,
  COUNT(DISTINCT cliente_id) FILTER (WHERE cnt_citas > 1)        AS clientes_recurrentes,
  ROUND(
    COUNT(DISTINCT cliente_id) FILTER (WHERE cnt_citas > 1) * 100.0
    / NULLIF(COUNT(DISTINCT cliente_id), 0), 1
  )                                                              AS retention_rate
FROM (
  SELECT tenant_id, cliente_id, COUNT(*) AS cnt_citas
  FROM citas
  WHERE estado = 'completada'
    AND fecha_inicio >= NOW() - INTERVAL '90 days'
  GROUP BY tenant_id, cliente_id
) sub
GROUP BY tenant_id;

-- Vista: utilization rate por profesional (semana actual)
CREATE OR REPLACE VIEW v_utilization AS
SELECT
  h.tenant_id,
  h.profesional_id,
  p.nombre,
  -- Horas disponibles en la semana (días activos * horas del día)
  SUM(
    EXTRACT(EPOCH FROM (h.hora_fin::time - h.hora_inicio::time)) / 3600
  ) * 5 AS horas_disponibles_semana,
  -- Horas con citas esta semana
  COALESCE((
    SELECT SUM(EXTRACT(EPOCH FROM (c.fecha_fin - c.fecha_inicio)) / 3600)
    FROM citas c
    WHERE c.profesional_id = h.profesional_id
      AND c.estado NOT IN ('cancelada','no_asistio')
      AND c.fecha_inicio >= DATE_TRUNC('week', NOW())
  ), 0) AS horas_ocupadas_semana,
  ROUND(
    COALESCE((
      SELECT SUM(EXTRACT(EPOCH FROM (c.fecha_fin - c.fecha_inicio)) / 3600)
      FROM citas c
      WHERE c.profesional_id = h.profesional_id
        AND c.estado NOT IN ('cancelada','no_asistio')
        AND c.fecha_inicio >= DATE_TRUNC('week', NOW())
    ), 0) * 100 /
    NULLIF(
      SUM(EXTRACT(EPOCH FROM (h.hora_fin::time - h.hora_inicio::time)) / 3600) * 5, 0
    ), 1
  ) AS utilization_rate
FROM horarios h
JOIN profesionales p ON p.id = h.profesional_id
WHERE h.activo = true
GROUP BY h.tenant_id, h.profesional_id, p.nombre;

-- Índices de soporte para analytics
CREATE INDEX IF NOT EXISTS idx_citas_estado_fecha ON citas(tenant_id, estado, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_citas_cliente       ON citas(cliente_id, estado);
