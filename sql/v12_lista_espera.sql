-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v12: Lista de espera
-- ═══════════════════════════════════════════════════════════════════

-- ── Tabla lista de espera ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lista_espera (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id   UUID REFERENCES profesionales(id) ON DELETE SET NULL,
  servicio_id      UUID REFERENCES servicios(id) ON DELETE SET NULL,
  cliente_id       UUID REFERENCES clientes_agenda(id) ON DELETE SET NULL,

  -- Para clientes que llegan del portal sin cuenta aún
  nombre_temporal  TEXT,
  telefono_temporal TEXT,

  fecha_preferida  DATE,    -- día específico que intentó reservar
  rango_horario    TEXT DEFAULT 'cualquier'
                     CHECK (rango_horario IN ('manana','tarde','cualquier')),

  notificado       BOOLEAN DEFAULT false,
  notificado_at    TIMESTAMPTZ,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espera_tenant   ON lista_espera(tenant_id, activo);
CREATE INDEX IF NOT EXISTS idx_espera_prof_serv ON lista_espera(profesional_id, servicio_id, activo);
CREATE INDEX IF NOT EXISTS idx_espera_fecha    ON lista_espera(fecha_preferida, activo);

ALTER TABLE lista_espera ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le_tenant" ON lista_espera FOR ALL USING (tenant_id = mi_tenant_id());
CREATE POLICY "le_dev"    ON lista_espera FOR ALL USING (
  tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

GRANT SELECT, INSERT, UPDATE ON lista_espera TO anon;
GRANT ALL ON lista_espera TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ── Trigger: al cancelar una cita → buscar matches en lista de espera ─
CREATE OR REPLACE FUNCTION notificar_espera_al_cancelar()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
  v_fecha DATE;
BEGIN
  -- Solo actuar cuando se cancela (antes no estaba cancelada)
  IF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN
    v_fecha := DATE(NEW.fecha_inicio AT TIME ZONE 'America/Bogota');

    -- Contar personas en espera para esta combinación profesional+servicio (o solo servicio)
    SELECT COUNT(*) INTO v_count
    FROM lista_espera
    WHERE tenant_id = NEW.tenant_id
      AND activo = true
      AND notificado = false
      AND (profesional_id = NEW.profesional_id OR profesional_id IS NULL)
      AND (servicio_id    = NEW.servicio_id    OR servicio_id IS NULL)
      AND (fecha_preferida = v_fecha OR fecha_preferida IS NULL);

    IF v_count > 0 THEN
      INSERT INTO eventos_agenda (tenant_id, tipo, payload)
      VALUES (
        NEW.tenant_id,
        'waitlist.slot_available',
        jsonb_build_object(
          'cita_id',        NEW.id,
          'profesional_id', NEW.profesional_id,
          'servicio_id',    NEW.servicio_id,
          'fecha_inicio',   NEW.fecha_inicio,
          'fecha_fin',      NEW.fecha_fin,
          'fecha',          v_fecha,
          'waitlist_count', v_count
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_espera_al_cancelar ON citas;
CREATE TRIGGER trg_espera_al_cancelar
  AFTER UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION notificar_espera_al_cancelar();

-- ── Vista: lista de espera con datos completos (para admin y n8n) ────
CREATE OR REPLACE VIEW v_lista_espera AS
SELECT
  le.id,
  le.tenant_id,
  le.created_at,
  le.fecha_preferida,
  le.rango_horario,
  le.notificado,
  le.activo,
  -- Profesional
  p.nombre  AS profesional_nombre,
  -- Servicio
  s.nombre  AS servicio_nombre,
  s.precio  AS servicio_precio,
  -- Cliente (si ya existe) o datos temporales
  COALESCE(c.nombre,   le.nombre_temporal)   AS nombre_cliente,
  COALESCE(c.telefono, le.telefono_temporal) AS telefono_cliente,
  COALESCE(c.whatsapp, le.telefono_temporal) AS whatsapp_cliente
FROM lista_espera le
LEFT JOIN profesionales  p ON p.id = le.profesional_id
LEFT JOIN servicios      s ON s.id = le.servicio_id
LEFT JOIN clientes_agenda c ON c.id = le.cliente_id
WHERE le.activo = true;
