-- v77: Portal self-service cancellation
-- Adds fuente column to track where a booking came from,
-- and an anon-callable RPC to cancel portal bookings securely.

-- 1. fuente column on citas
ALTER TABLE citas ADD COLUMN IF NOT EXISTS fuente TEXT DEFAULT 'manual';

-- 2. Cancellation RPC callable by anon (no direct write to citas table needed)
CREATE OR REPLACE FUNCTION cancelar_cita_portal(
  p_cita_id  UUID,
  p_tenant_id UUID,
  p_telefono  TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_horas_cancel INT;
  v_fecha_inicio TIMESTAMPTZ;
  v_cli_tel      TEXT;
BEGIN
  -- Read tenant cancellation window (default 2h)
  SELECT COALESCE((config_vertical->>'horas_cancelacion')::INT, 2)
  INTO   v_horas_cancel
  FROM   tenants
  WHERE  id = p_tenant_id AND activo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Negocio no encontrado');
  END IF;

  -- Retrieve the cita + client phone
  SELECT c.fecha_inicio, ca.telefono
  INTO   v_fecha_inicio, v_cli_tel
  FROM   citas c
  JOIN   clientes_agenda ca ON ca.id = c.cliente_id
  WHERE  c.id = p_cita_id
    AND  c.tenant_id = p_tenant_id
    AND  c.estado NOT IN ('cancelada', 'no_asistio');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cita no encontrada');
  END IF;

  -- Verify phone (last 8 digits, digits only)
  IF RIGHT(REGEXP_REPLACE(COALESCE(v_cli_tel,''), '\D', '', 'g'), 8)
     != RIGHT(REGEXP_REPLACE(p_telefono, '\D', '', 'g'), 8) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No encontramos una cita con ese número');
  END IF;

  -- Enforce cancellation window
  IF v_fecha_inicio < NOW() + (v_horas_cancel || ' hours')::INTERVAL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Solo puedes cancelar con al menos ' || v_horas_cancel || ' hora(s) de anticipación'
    );
  END IF;

  -- Cancel
  UPDATE citas SET estado = 'cancelada' WHERE id = p_cita_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION cancelar_cita_portal(UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION cancelar_cita_portal(UUID, UUID, TEXT) TO authenticated;
