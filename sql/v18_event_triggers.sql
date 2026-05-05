-- =====================================================================
-- v18 — FASE 4 del plan SaaS Salon Pro
-- Triggers en `citas` que emiten eventos al dominio via emitir_evento().
-- Make.com sigue leyendo webhooks de Supabase como antes — no se toca.
-- Los eventos quedan en la tabla `eventos` como fuente de verdad auditada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Función que construye el payload del evento (reutilizada por ambos triggers)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _payload_cita(c citas)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cita_id',        c.id,
    'tenant_id',      c.tenant_id,
    'cliente_id',     c.cliente_id,
    'profesional_id', c.profesional_id,
    'servicio_id',    c.servicio_id,
    'estado',         c.estado,
    'fecha_inicio',   c.fecha_inicio,
    'precio_cobrado', c.precio_cobrado,
    'pago_estado',    c.pago_estado
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Función trigger para INSERT (cita creada)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tr_fn_cita_creada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM emitir_evento(NEW.tenant_id, 'cita.creada', _payload_cita(NEW));
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Función trigger para UPDATE (cambio de estado)
--    Solo emite si el estado realmente cambió — evita spam por otros campos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tr_fn_cita_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    PERFORM emitir_evento(
      NEW.tenant_id,
      'cita.' || NEW.estado,          -- ej: 'cita.confirmada', 'cita.completada', 'cita.cancelada'
      _payload_cita(NEW) || jsonb_build_object('estado_anterior', OLD.estado)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Registrar los triggers (idempotente: DROP IF EXISTS antes de crear)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_cita_creada       ON citas;
DROP TRIGGER IF EXISTS tr_cita_estado_cambio ON citas;

CREATE TRIGGER tr_cita_creada
  AFTER INSERT ON citas
  FOR EACH ROW
  EXECUTE FUNCTION tr_fn_cita_creada();

CREATE TRIGGER tr_cita_estado_cambio
  AFTER UPDATE ON citas
  FOR EACH ROW
  EXECUTE FUNCTION tr_fn_cita_estado();

-- ---------------------------------------------------------------------
-- 5. Función helper para que la app consulte eventos recientes del tenant
--    (útil para el dashboard y para Make si quiere alternativa a webhooks)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_eventos_recientes(
  p_tenant_id  uuid,
  p_tipo       text    DEFAULT NULL,
  p_limite     integer DEFAULT 50
)
RETURNS TABLE (
  id           uuid,
  tipo         text,
  payload      jsonb,
  procesado    boolean,
  created_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, tipo, payload, procesado, created_at
  FROM eventos
  WHERE tenant_id = p_tenant_id
    AND (p_tipo IS NULL OR tipo = p_tipo)
  ORDER BY created_at DESC
  LIMIT p_limite;
$$;

REVOKE ALL ON FUNCTION get_eventos_recientes(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_eventos_recientes(uuid, text, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Diagnóstico
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_triggers INT;
BEGIN
  SELECT COUNT(*) INTO v_triggers
  FROM information_schema.triggers
  WHERE event_object_table = 'citas'
    AND trigger_name IN ('tr_cita_creada', 'tr_cita_estado_cambio');

  IF v_triggers <> 2 THEN
    RAISE EXCEPTION 'v18: triggers no creados correctamente (encontrados %)', v_triggers;
  END IF;

  RAISE NOTICE 'v18 OK — triggers en citas activos. Eventos emitidos: cita.creada, cita.confirmada, cita.completada, cita.cancelada, cita.no_asistio';
END$$;
