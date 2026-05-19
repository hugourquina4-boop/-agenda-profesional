-- v39: Flexible schedule exceptions per professional
-- Allows date-specific overrides on top of the weekly base schedule.
-- A row here fully replaces the weekly horario for that professional on that date.
-- If activo=false, the professional is absent that day (vacation, sick leave, etc.)

CREATE TABLE IF NOT EXISTS horarios_excepcion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,   -- false = no trabaja ese día
  hora_inicio    TIME,                             -- null if activo=false
  hora_fin       TIME,                             -- null if activo=false
  nota           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profesional_id, fecha)
);

ALTER TABLE horarios_excepcion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hex_tenant_sel" ON horarios_excepcion FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true
  ));

CREATE POLICY "hex_tenant_ins" ON horarios_excepcion FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true
  ));

CREATE POLICY "hex_tenant_upd" ON horarios_excepcion FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true
  ));

CREATE POLICY "hex_tenant_del" ON horarios_excepcion FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON horarios_excepcion TO authenticated;

-- ── RPC: get_disponibilidad_dia ──────────────────────────────────────────────
-- Returns the effective schedule for a professional on a specific date.
-- Priority: horarios_excepcion > horarios (weekly base)
-- Returns: { activo, hora_inicio, hora_fin, es_excepcion }

CREATE OR REPLACE FUNCTION get_disponibilidad_dia(
  p_profesional_id UUID,
  p_fecha          DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id    UUID;
  v_dia_semana   TEXT;
  v_excepcion    horarios_excepcion%ROWTYPE;
  v_base         horarios%ROWTYPE;
BEGIN
  -- Verify caller belongs to the same tenant as this professional
  SELECT tenant_id INTO v_tenant_id
  FROM profesionales WHERE id = p_profesional_id;

  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND tenant_id = v_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Check for a date-specific exception first
  SELECT * INTO v_excepcion
  FROM horarios_excepcion
  WHERE profesional_id = p_profesional_id AND fecha = p_fecha;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'activo',        v_excepcion.activo,
      'hora_inicio',   v_excepcion.hora_inicio,
      'hora_fin',      v_excepcion.hora_fin,
      'es_excepcion',  true,
      'nota',          v_excepcion.nota
    );
  END IF;

  -- Fall back to weekly base schedule
  v_dia_semana := lower(trim(to_char(p_fecha, 'Day')));
  -- Normalize Spanish day names to match the 'dia' column values
  v_dia_semana := CASE v_dia_semana
    WHEN 'monday'    THEN 'lunes'
    WHEN 'tuesday'   THEN 'martes'
    WHEN 'wednesday' THEN 'miercoles'
    WHEN 'thursday'  THEN 'jueves'
    WHEN 'friday'    THEN 'viernes'
    WHEN 'saturday'  THEN 'sabado'
    WHEN 'sunday'    THEN 'domingo'
    ELSE v_dia_semana
  END;

  SELECT * INTO v_base
  FROM horarios
  WHERE profesional_id = p_profesional_id AND dia = v_dia_semana;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'activo',        v_base.activo,
      'hora_inicio',   v_base.hora_inicio,
      'hora_fin',      v_base.hora_fin,
      'es_excepcion',  false,
      'nota',          null
    );
  END IF;

  -- No schedule found — professional not available
  RETURN jsonb_build_object(
    'activo',       false,
    'hora_inicio',  null,
    'hora_fin',     null,
    'es_excepcion', false,
    'nota',         null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_disponibilidad_dia(UUID, DATE) TO authenticated;

-- ── RPC: get_excepciones_mes ─────────────────────────────────────────────────
-- Returns all exceptions for a professional within a calendar month.
-- Useful for rendering a monthly calendar view with override markers.

CREATE OR REPLACE FUNCTION get_excepciones_mes(
  p_profesional_id UUID,
  p_year           INT,
  p_month          INT
)
RETURNS TABLE (
  fecha       DATE,
  activo      BOOLEAN,
  hora_inicio TIME,
  hora_fin    TIME,
  nota        TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profesionales WHERE id = p_profesional_id;

  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND tenant_id = v_tenant_id AND activo = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT he.fecha, he.activo, he.hora_inicio, he.hora_fin, he.nota
    FROM horarios_excepcion he
    WHERE he.profesional_id = p_profesional_id
      AND EXTRACT(YEAR  FROM he.fecha) = p_year
      AND EXTRACT(MONTH FROM he.fecha) = p_month
    ORDER BY he.fecha;
END;
$$;

GRANT EXECUTE ON FUNCTION get_excepciones_mes(UUID, INT, INT) TO authenticated;
