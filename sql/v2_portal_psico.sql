-- ═══════════════════════════════════════════════════════════════
-- v2: Portal psicología — nuevos campos en citas + RPCs
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Nuevos campos en citas
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS modalidad    TEXT DEFAULT 'Presencial',
  ADD COLUMN IF NOT EXISTS edad         TEXT,
  ADD COLUMN IF NOT EXISTS motivo       TEXT,
  ADD COLUMN IF NOT EXISTS quien_asiste TEXT,
  ADD COLUMN IF NOT EXISTS notas        TEXT;

-- 2. Campo direccion en tenants (opcional pero útil para presencial)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS direccion TEXT;

-- 3. RPC: slots ocupados para el portal público (sin exponer datos del paciente)
CREATE OR REPLACE FUNCTION get_slots_ocupados(
  p_profesional_id UUID,
  p_fecha          DATE
)
RETURNS TABLE (hora_inicio TIME, hora_fin TIME)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (c.fecha_inicio AT TIME ZONE 'America/Bogota')::TIME,
    (c.fecha_fin    AT TIME ZONE 'America/Bogota')::TIME
  FROM citas c
  WHERE c.profesional_id = p_profesional_id
    AND DATE(c.fecha_inicio AT TIME ZONE 'America/Bogota') = p_fecha
    AND c.estado NOT IN ('cancelada', 'cancelado', 'no_asistio');
END;
$$;

GRANT EXECUTE ON FUNCTION get_slots_ocupados TO anon;

-- 4. RPC actualizada: crear_cita_publica con campos extendidos
CREATE OR REPLACE FUNCTION crear_cita_publica(
  p_tenant_id        UUID,
  p_profesional_id   UUID,
  p_servicio_id      UUID,
  p_fecha_inicio     TIMESTAMPTZ,
  p_fecha_fin        TIMESTAMPTZ,
  p_cliente_nombre   TEXT,
  p_cliente_telefono TEXT        DEFAULT NULL,
  p_cliente_email    TEXT        DEFAULT NULL,
  p_modalidad        TEXT        DEFAULT 'Presencial',
  p_edad             TEXT        DEFAULT NULL,
  p_motivo           TEXT        DEFAULT NULL,
  p_quien_asiste     TEXT        DEFAULT NULL,
  p_notas            TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_cita_id    UUID;
BEGIN
  -- Buscar cliente existente por teléfono dentro del tenant
  IF p_cliente_telefono IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM clientes_agenda
    WHERE tenant_id = p_tenant_id AND telefono = p_cliente_telefono LIMIT 1;
  END IF;

  -- Si no existe, crear
  IF v_cliente_id IS NULL THEN
    INSERT INTO clientes_agenda (tenant_id, nombre, telefono, email)
    VALUES (p_tenant_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- Insertar cita
  INSERT INTO citas (
    tenant_id, profesional_id, servicio_id, cliente_id,
    fecha_inicio, fecha_fin, estado,
    modalidad, edad, motivo, quien_asiste, notas
  )
  VALUES (
    p_tenant_id, p_profesional_id, p_servicio_id, v_cliente_id,
    p_fecha_inicio, p_fecha_fin, 'pendiente',
    p_modalidad, p_edad, p_motivo, p_quien_asiste, p_notas
  )
  RETURNING id INTO v_cita_id;

  RETURN jsonb_build_object('ok', true, 'cita_id', v_cita_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
