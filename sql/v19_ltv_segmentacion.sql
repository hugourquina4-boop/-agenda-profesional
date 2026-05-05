-- =====================================================================
-- v19 — FASE 5 del plan SaaS Salon Pro
-- LTV y segmentación automática de clientes.
-- Cada vez que una cita se completa: recalcula stats + asigna segmento.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Recalcular stats de un cliente desde cero (idempotente)
--    Suma todas las citas completadas — sin riesgo de doble conteo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalcular_stats_cliente(
  p_cliente_id uuid,
  p_tenant_id  uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE clientes_agenda SET
    num_visitas   = (
      SELECT COUNT(*) FROM citas
      WHERE cliente_id = p_cliente_id AND tenant_id = p_tenant_id
        AND estado = 'completada'
    ),
    total_gastado = (
      SELECT COALESCE(SUM(precio_cobrado), 0) FROM citas
      WHERE cliente_id = p_cliente_id AND tenant_id = p_tenant_id
        AND estado = 'completada' AND precio_cobrado IS NOT NULL
    ),
    ultima_visita = (
      SELECT MAX(fecha_inicio) FROM citas
      WHERE cliente_id = p_cliente_id AND tenant_id = p_tenant_id
        AND estado = 'completada'
    )
  WHERE id = p_cliente_id AND tenant_id = p_tenant_id;
$$;

-- ---------------------------------------------------------------------
-- 2. Asignar segmento según reglas de negocio
--    Prioridad: vip > recurrente > en_riesgo > inactivo > nuevo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actualizar_segmento(
  p_cliente_id uuid,
  p_tenant_id  uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segmento text;
  c          clientes_agenda%ROWTYPE;
BEGIN
  SELECT * INTO c
  FROM clientes_agenda
  WHERE id = p_cliente_id AND tenant_id = p_tenant_id;

  IF c.num_visitas >= 8 OR c.total_gastado >= 300000 THEN
    v_segmento := 'vip';

  ELSIF c.num_visitas >= 3
    AND c.ultima_visita >= NOW() - INTERVAL '45 days' THEN
    v_segmento := 'recurrente';

  ELSIF c.ultima_visita IS NOT NULL
    AND c.ultima_visita < NOW() - INTERVAL '90 days' THEN
    v_segmento := 'inactivo';

  ELSIF c.ultima_visita IS NOT NULL
    AND c.ultima_visita < NOW() - INTERVAL '45 days' THEN
    v_segmento := 'en_riesgo';

  ELSE
    v_segmento := 'nuevo';
  END IF;

  UPDATE clientes_agenda SET
    segmento             = v_segmento,
    segmento_actualizado = NOW()
  WHERE id = p_cliente_id AND tenant_id = p_tenant_id;

  RETURN v_segmento;
END;
$$;

GRANT EXECUTE ON FUNCTION actualizar_segmento(uuid, uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION recalcular_stats_cliente(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Función trigger — se activa solo cuando estado → 'completada'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tr_fn_cita_completada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM recalcular_stats_cliente(NEW.cliente_id, NEW.tenant_id);
  PERFORM actualizar_segmento(NEW.cliente_id, NEW.tenant_id);
  RETURN NEW;
END;
$$;

-- Trigger con cláusula WHEN para máxima eficiencia (no evalúa la función si no aplica)
DROP TRIGGER IF EXISTS tr_cita_completada ON citas;

CREATE TRIGGER tr_cita_completada
  AFTER UPDATE ON citas
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'completada')
  EXECUTE FUNCTION tr_fn_cita_completada();

-- ---------------------------------------------------------------------
-- 4. Backfill: recalcular todos los clientes de un tenant
--    Útil al desplegar v19 si ya había citas completadas anteriormente.
--    Uso: SELECT recalcular_ltv_tenant('<tu-tenant-id>');
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalcular_ltv_tenant(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count      integer := 0;
  v_cliente_id uuid;
BEGIN
  FOR v_cliente_id IN
    SELECT DISTINCT cliente_id FROM citas
    WHERE tenant_id = p_tenant_id AND estado = 'completada'
  LOOP
    PERFORM recalcular_stats_cliente(v_cliente_id, p_tenant_id);
    PERFORM actualizar_segmento(v_cliente_id, p_tenant_id);
    v_count := v_count + 1;
  END LOOP;

  -- Marcar 'nuevo' a clientes activos que nunca tuvieron cita completada
  UPDATE clientes_agenda SET
    segmento             = 'nuevo',
    segmento_actualizado = NOW()
  WHERE tenant_id = p_tenant_id
    AND activo    = true
    AND segmento  IS NULL;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION recalcular_ltv_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recalcular_ltv_tenant(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Diagnóstico + backfill automático del tenant de demostración
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_trigger_existe boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'citas'
      AND trigger_name = 'tr_cita_completada'
  ) INTO v_trigger_existe;

  IF NOT v_trigger_existe THEN
    RAISE EXCEPTION 'v19: trigger tr_cita_completada no se creó';
  END IF;

  RAISE NOTICE 'v19 OK — LTV automático activo. Para cargar datos históricos ejecuta:';
  RAISE NOTICE '  SELECT recalcular_ltv_tenant(''<tu-tenant-id-uuid>'');';
END$$;
