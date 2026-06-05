-- v85: Tiquetera virtual de lealtad por cliente
-- Config en tenants + tabla de premios canjeados

-- Configuración del programa por negocio
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiquetera_activa      BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiquetera_meta         INT     DEFAULT 10;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiquetera_premio       TEXT    DEFAULT 'Servicio gratis a elegir';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiquetera_lat          NUMERIC(10,7);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiquetera_lng          NUMERIC(10,7);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiquetera_radio_m      INT     DEFAULT 300;

-- Registro de premios canjeados (cada vez que llegan a la meta y se marca el canje)
CREATE TABLE IF NOT EXISTS tiquetera_premios (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id),
  cliente_id   UUID        NOT NULL REFERENCES clientes_agenda(id),
  visitas_base INT         NOT NULL,  -- cuántas visitas acumuladas tenía al canjear
  premio       TEXT,
  cita_id      UUID        REFERENCES citas(id),
  canjeado_por UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tiquetera_premios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiquetera_premios_tenant" ON tiquetera_premios
  FOR ALL USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "tiquetera_premios_insert_tenant" ON tiquetera_premios
  FOR INSERT WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT ON tiquetera_premios TO authenticated;
GRANT SELECT ON tiquetera_premios TO anon;

-- Índice para consultas rápidas por cliente
CREATE INDEX IF NOT EXISTS idx_tiquetera_premios_cliente
  ON tiquetera_premios(tenant_id, cliente_id);

-- RPC: datos completos de tiquetera para un cliente (accesible anon para el portal)
CREATE OR REPLACE FUNCTION public.tiquetera_cliente(
  p_tenant_id  UUID,
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meta       INT;
  v_activa     BOOLEAN;
  v_premio     TEXT;
  v_total      INT;
  v_canjeados  INT;
  v_ciclo      INT;
  v_progreso   INT;
BEGIN
  SELECT tiquetera_activa, tiquetera_meta, tiquetera_premio
    INTO v_activa, v_meta, v_premio
    FROM tenants WHERE id = p_tenant_id;

  IF NOT FOUND OR NOT v_activa THEN
    RETURN jsonb_build_object('activa', false);
  END IF;

  -- Total visitas completadas (citas con estado completada)
  SELECT COUNT(*) INTO v_total
    FROM citas
    WHERE tenant_id = p_tenant_id
      AND cliente_id = p_cliente_id
      AND estado = 'completada';

  -- Total premios ya canjeados
  SELECT COUNT(*) INTO v_canjeados
    FROM tiquetera_premios
    WHERE tenant_id = p_tenant_id
      AND cliente_id = p_cliente_id;

  -- Visitas del ciclo actual (descontando los ya canjeados)
  v_ciclo    := v_canjeados * v_meta;
  v_progreso := GREATEST(0, v_total - v_ciclo);

  RETURN jsonb_build_object(
    'activa',       true,
    'meta',         v_meta,
    'premio',       v_premio,
    'total',        v_total,
    'canjeados',    v_canjeados,
    'progreso',     LEAST(v_progreso, v_meta),
    'listo',        v_progreso >= v_meta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tiquetera_cliente(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.tiquetera_cliente(UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v85: tiquetera virtual — tabla premios + config tenants + RPC tiquetera_cliente';
END $$;
