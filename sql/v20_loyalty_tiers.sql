-- =====================================================================
-- v20 — FASE 7 del plan SaaS Salon Pro
-- Loyalty tiers (Bronce / Plata / Oro) sobre el sistema de puntos existente.
-- El tier se basa en total_ganado (nunca decrementa con canjes).
-- Los umbrales son configurables por tenant en config_puntos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Umbrales de tier configurables en config_puntos
-- ---------------------------------------------------------------------
ALTER TABLE config_puntos
  ADD COLUMN IF NOT EXISTS tier_config JSONB NOT NULL DEFAULT '{"bronce":0,"plata":100,"oro":300}'::jsonb;

-- ---------------------------------------------------------------------
-- 2. Columna tier en saldo_puntos
-- ---------------------------------------------------------------------
ALTER TABLE saldo_puntos
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'bronce'
    CHECK (tier IN ('bronce','plata','oro'));

-- ---------------------------------------------------------------------
-- 3. Función pura que calcula el tier según total ganado y config
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calcular_tier(
  p_total_ganado INT,
  p_config       JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cfg          JSONB;
  v_umbral_oro   INT;
  v_umbral_plata INT;
BEGIN
  v_cfg          := COALESCE(p_config, '{"bronce":0,"plata":100,"oro":300}'::jsonb);
  v_umbral_oro   := (v_cfg ->> 'oro')::int;
  v_umbral_plata := (v_cfg ->> 'plata')::int;

  IF p_total_ganado >= v_umbral_oro   THEN RETURN 'oro';
  ELSIF p_total_ganado >= v_umbral_plata THEN RETURN 'plata';
  ELSE RETURN 'bronce';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Trigger BEFORE en saldo_puntos — recalcula tier antes de guardar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tr_fn_tier_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT tier_config INTO v_config
  FROM config_puntos
  WHERE tenant_id = NEW.tenant_id AND activo = true;

  NEW.tier := calcular_tier(NEW.total_ganado, v_config);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_saldo_tier ON saldo_puntos;

CREATE TRIGGER tr_saldo_tier
  BEFORE INSERT OR UPDATE OF total_ganado ON saldo_puntos
  FOR EACH ROW
  EXECUTE FUNCTION tr_fn_tier_saldo();

-- ---------------------------------------------------------------------
-- 5. Actualizar get_puntos_cliente — ahora devuelve tier y total_ganado
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_puntos_cliente(
  p_tenant_id UUID,
  p_telefono  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_sp         saldo_puntos%ROWTYPE;
  v_config     config_puntos%ROWTYPE;
BEGIN
  SELECT id INTO v_cliente_id
  FROM clientes_agenda
  WHERE tenant_id = p_tenant_id AND telefono = p_telefono
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente no encontrado');
  END IF;

  SELECT * INTO v_sp
  FROM saldo_puntos
  WHERE tenant_id = p_tenant_id AND cliente_id = v_cliente_id;

  SELECT * INTO v_config
  FROM config_puntos
  WHERE tenant_id = p_tenant_id AND activo = true;

  RETURN jsonb_build_object(
    'ok',            true,
    'puntos',        COALESCE(v_sp.saldo, 0),
    'total_ganado',  COALESCE(v_sp.total_ganado, 0),
    'tier',          COALESCE(v_sp.tier, 'bronce'),
    'valor_cop',     COALESCE(v_sp.saldo, 0) * COALESCE(v_config.valor_punto_cop, 100),
    'minimo_canje',  COALESCE(v_config.minimo_canje, 50),
    'puede_canjear', COALESCE(v_sp.saldo, 0) >= COALESCE(v_config.minimo_canje, 50)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_puntos_cliente(UUID, TEXT) TO anon;

-- ---------------------------------------------------------------------
-- 6. Backfill — recalcular tiers de todos los saldos existentes
-- ---------------------------------------------------------------------
UPDATE saldo_puntos sp
SET    tier = calcular_tier(sp.total_ganado, cp.tier_config)
FROM   config_puntos cp
WHERE  cp.tenant_id = sp.tenant_id AND cp.activo = true;

-- Clientes con saldo pero sin config de puntos → tier según umbrales por defecto
UPDATE saldo_puntos
SET    tier = calcular_tier(total_ganado, NULL)
WHERE  tenant_id NOT IN (SELECT tenant_id FROM config_puntos WHERE activo = true);

-- ---------------------------------------------------------------------
-- 7. Diagnóstico
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_col  boolean;
  v_trig boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saldo_puntos' AND column_name = 'tier'
  ) INTO v_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'saldo_puntos' AND trigger_name = 'tr_saldo_tier'
  ) INTO v_trig;

  IF NOT v_col  THEN RAISE EXCEPTION 'v20: columna tier no se agregó a saldo_puntos'; END IF;
  IF NOT v_trig THEN RAISE EXCEPTION 'v20: trigger tr_saldo_tier no se creó'; END IF;

  RAISE NOTICE 'v20 OK — tiers activos. Distribución actual:';
END$$;

-- Ver distribución de tiers (informativo, no bloquea si está vacío)
SELECT tier, COUNT(*) AS clientes
FROM saldo_puntos
GROUP BY tier
ORDER BY tier;
