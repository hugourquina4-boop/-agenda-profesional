-- =====================================================================
-- v16 — FASE 2 del plan SaaS Salon Pro
-- Tabla `eventos` (event-sourcing) + columnas LTV/segmentación en clientes_agenda
-- NOTA: `logs_actividad` ya existe desde schema_v1 — se reutiliza, no se duplica.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla `eventos` — registro inmutable de eventos del dominio
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,                       -- 'cita.creada', 'cita.cancelada', 'cliente.inactivo'…
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  procesado     BOOLEAN NOT NULL DEFAULT false,
  procesado_en  TIMESTAMPTZ,
  intentos      INT NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial — el dispatcher solo lee no-procesados, debe ser O(1)
CREATE INDEX IF NOT EXISTS idx_eventos_pendientes
  ON eventos (tipo, created_at) WHERE procesado = false;

CREATE INDEX IF NOT EXISTS idx_eventos_tenant_fecha
  ON eventos (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eventos_tipo
  ON eventos (tipo);

-- ---------------------------------------------------------------------
-- 2. RLS — eventos solo visibles a su tenant; dispatcher usa service_role (bypass)
-- ---------------------------------------------------------------------
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_superadmin"     ON eventos;
DROP POLICY IF EXISTS "eventos_tenant_read"    ON eventos;
DROP POLICY IF EXISTS "eventos_tenant_insert"  ON eventos;

CREATE POLICY "eventos_superadmin" ON eventos
  FOR ALL
  USING (es_superadmin())
  WITH CHECK (es_superadmin());

CREATE POLICY "eventos_tenant_read" ON eventos
  FOR SELECT
  USING (tenant_id = mi_tenant_id());

CREATE POLICY "eventos_tenant_insert" ON eventos
  FOR INSERT
  WITH CHECK (tenant_id = mi_tenant_id());

-- Permisos mínimos: el front nunca actualiza/borra eventos
GRANT SELECT, INSERT ON eventos TO authenticated;
REVOKE UPDATE, DELETE ON eventos FROM authenticated;

-- ---------------------------------------------------------------------
-- 3. Helper `emitir_evento(tenant, tipo, payload)`
--    SECURITY DEFINER para que cualquier RPC interno pueda emitir
--    sin tocar la sesión del usuario.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION emitir_evento(
  p_tenant_id UUID,
  p_tipo      TEXT,
  p_payload   JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO eventos (tenant_id, tipo, payload)
  VALUES (p_tenant_id, p_tipo, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION emitir_evento(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION emitir_evento(UUID, TEXT, JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Columnas LTV / segmentación en clientes_agenda
-- ---------------------------------------------------------------------
ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS num_visitas           INT           NOT NULL DEFAULT 0;

ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS total_gastado         NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS ultima_visita         TIMESTAMPTZ;

ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS segmento              TEXT
    CHECK (segmento IS NULL OR segmento IN ('nuevo','recurrente','vip','en_riesgo','inactivo'));

ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS segmento_actualizado  TIMESTAMPTZ;

-- ticket_promedio = LTV simple (gastado / visitas) — columna generada, sin mantenimiento manual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes_agenda' AND column_name = 'ticket_promedio'
  ) THEN
    ALTER TABLE clientes_agenda
      ADD COLUMN ticket_promedio NUMERIC(12,2)
      GENERATED ALWAYS AS (
        CASE WHEN num_visitas > 0 THEN total_gastado / num_visitas ELSE 0 END
      ) STORED;
  END IF;
END$$;

-- Índices para queries de inteligencia (dashboards, campañas, segmentación)
CREATE INDEX IF NOT EXISTS idx_clientes_segmento
  ON clientes_agenda (tenant_id, segmento) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_clientes_ultima_visita
  ON clientes_agenda (tenant_id, ultima_visita DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_clientes_ltv
  ON clientes_agenda (tenant_id, ticket_promedio DESC) WHERE activo = true;

-- ---------------------------------------------------------------------
-- 5. Diagnóstico — solo aborta ante errores críticos (tabla o columnas).
--    Los conteos de índices son informativos: si faltó alguno, lo muestra
--    pero deja la migración aplicada para no rollbackear el resto.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_cols     INT;
  v_idx_list TEXT;
BEGIN
  -- Crítico: tabla eventos debe existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'eventos'
  ) THEN
    RAISE EXCEPTION 'v16: tabla eventos no se creó';
  END IF;

  -- Crítico: las 6 columnas LTV deben existir
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'clientes_agenda'
    AND column_name IN (
      'num_visitas','total_gastado','ultima_visita',
      'segmento','segmento_actualizado','ticket_promedio'
    );

  IF v_cols <> 6 THEN
    RAISE EXCEPTION 'v16: faltaron columnas LTV en clientes_agenda (esperadas 6, encontradas %)', v_cols;
  END IF;

  -- Diagnóstico (no bloqueante): listar índices reales de eventos
  SELECT string_agg(indexname, ', ' ORDER BY indexname) INTO v_idx_list
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'eventos';

  RAISE NOTICE 'v16 OK — eventos + 6 cols LTV aplicadas. Índices en eventos: %', COALESCE(v_idx_list, '(ninguno)');
END$$;
