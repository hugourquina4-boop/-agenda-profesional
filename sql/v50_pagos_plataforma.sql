-- v50_pagos_plataforma.sql
-- Historial de pagos de suscripción por negocio.
-- salon_admin_registrar_pago : registra pago + actualiza fecha_vencimiento
-- salon_admin_get_pagos      : historial de pagos (por tenant o global)

-- Columna fecha_vencimiento en tenants (idempotente)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- Tabla de pagos de suscripción
CREATE TABLE IF NOT EXISTS pagos_plataforma (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  monto       NUMERIC(12,2) NOT NULL,
  metodo      TEXT         DEFAULT 'transferencia'
              CHECK (metodo IN ('transferencia','efectivo','nequi','daviplata','tarjeta','otro')),
  plan_pagado TEXT,
  meses       INTEGER      NOT NULL DEFAULT 1,
  referencia  TEXT,
  notas       TEXT,
  fecha       DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE pagos_plataforma ENABLE ROW LEVEL SECURITY;

-- Acceso sólo mediante RPCs SECURITY DEFINER — bloqueado por RLS
CREATE POLICY "pagos_plataforma_deny_direct"
  ON pagos_plataforma FOR ALL USING (false);

GRANT SELECT, INSERT ON pagos_plataforma TO authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_pagos_plataforma_tenant ON pagos_plataforma(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pagos_plataforma_fecha  ON pagos_plataforma(fecha DESC);

-- ── RPC: registrar pago ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION salon_admin_registrar_pago(
  p_token      TEXT,
  p_tenant_id  UUID,
  p_monto      NUMERIC,
  p_metodo     TEXT    DEFAULT 'transferencia',
  p_meses      INTEGER DEFAULT 1,
  p_referencia TEXT    DEFAULT NULL,
  p_notas      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  ADMIN_HASH CONSTANT TEXT := 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91';
  v_plan  TEXT;
  v_vence DATE;
  v_nueva DATE;
BEGIN
  IF p_token <> ADMIN_HASH THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_meses < 1 OR p_meses > 24 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'meses_invalido');
  END IF;

  SELECT plan, fecha_vencimiento INTO v_plan, v_vence
  FROM tenants WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_not_found');
  END IF;

  -- Base = max(hoy, vencimiento actual); extiende N meses
  v_nueva := GREATEST(CURRENT_DATE, COALESCE(v_vence, CURRENT_DATE))
           + (p_meses || ' months')::INTERVAL;

  INSERT INTO pagos_plataforma (tenant_id, monto, metodo, plan_pagado, meses, referencia, notas)
  VALUES (p_tenant_id, p_monto, p_metodo, v_plan, p_meses, p_referencia, p_notas);

  UPDATE tenants
  SET fecha_vencimiento = v_nueva, activo = true
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'nueva_fecha', v_nueva,
    'plan', v_plan
  );
END;
$$;

-- ── RPC: obtener historial de pagos ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION salon_admin_get_pagos(
  p_token     TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  ADMIN_HASH CONSTANT TEXT := 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91';
  v_result JSONB;
BEGIN
  IF p_token <> ADMIN_HASH THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          pp.id,
        'monto',       pp.monto,
        'metodo',      pp.metodo,
        'plan_pagado', pp.plan_pagado,
        'meses',       pp.meses,
        'referencia',  pp.referencia,
        'notas',       pp.notas,
        'fecha',       pp.fecha
      ) ORDER BY pp.fecha DESC
    ), '[]'::JSONB)
    INTO v_result
    FROM pagos_plataforma pp
    WHERE pp.tenant_id = p_tenant_id;
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',            pp.id,
        'tenant_id',     pp.tenant_id,
        'tenant_nombre', t.nombre,
        'monto',         pp.monto,
        'metodo',        pp.metodo,
        'plan_pagado',   pp.plan_pagado,
        'meses',         pp.meses,
        'referencia',    pp.referencia,
        'notas',         pp.notas,
        'fecha',         pp.fecha
      ) ORDER BY pp.fecha DESC
    ), '[]'::JSONB)
    INTO v_result
    FROM pagos_plataforma pp
    JOIN tenants t ON t.id = pp.tenant_id
    LIMIT 200;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION salon_admin_registrar_pago TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salon_admin_get_pagos      TO anon, authenticated;
