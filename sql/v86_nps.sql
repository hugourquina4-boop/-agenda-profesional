-- v86: NPS post-visita — encuesta automática de satisfacción por WhatsApp
-- Flujo: cita completada → Edge Function envía link WA 2-6h después →
--        cliente abre /nps/{token} → vota 1-5 → se guarda en nps_respuestas

-- Columnas en citas para control de envío NPS
ALTER TABLE citas ADD COLUMN IF NOT EXISTS nps_enviado  BOOLEAN DEFAULT false;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS nps_token    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_citas_nps_token ON citas(nps_token)
  WHERE nps_token IS NOT NULL;

-- Tabla de respuestas NPS
CREATE TABLE IF NOT EXISTS nps_respuestas (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id),
  cliente_id   UUID        REFERENCES clientes_agenda(id),
  cita_id      UUID        REFERENCES citas(id),
  puntuacion   INT         NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nps_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nps_respuestas_tenant_select" ON nps_respuestas
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

-- anon puede insertar desde la página pública del NPS
CREATE POLICY "nps_respuestas_anon_insert" ON nps_respuestas
  FOR INSERT WITH CHECK (true);

GRANT SELECT ON nps_respuestas TO authenticated;
GRANT INSERT  ON nps_respuestas TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_nps_respuestas_tenant
  ON nps_respuestas(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nps_respuestas_cita
  ON nps_respuestas(cita_id);

-- RPC: info pública para la página de NPS (accesible por anon)
CREATE OR REPLACE FUNCTION public.nps_info_por_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cita RECORD;
  v_ya   BOOLEAN;
BEGIN
  SELECT
    c.id, c.tenant_id, c.cliente_id,
    ca.nombre  AS cliente_nombre,
    p.nombre   AS prof_nombre,
    s.nombre   AS serv_nombre,
    t.nombre   AS salon_nombre,
    t.color_primario AS color
  INTO v_cita
  FROM citas c
  LEFT JOIN clientes_agenda ca ON ca.id = c.cliente_id
  LEFT JOIN profesionales   p  ON p.id  = c.profesional_id
  LEFT JOIN servicios       s  ON s.id  = c.servicio_id
  LEFT JOIN tenants         t  ON t.id  = c.tenant_id
  WHERE c.nps_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM nps_respuestas WHERE cita_id = v_cita.id
  ) INTO v_ya;

  RETURN jsonb_build_object(
    'ok',           true,
    'cita_id',      v_cita.id,
    'tenant_id',    v_cita.tenant_id,
    'cliente_id',   v_cita.cliente_id,
    'cliente',      COALESCE(v_cita.cliente_nombre, 'Cliente'),
    'profesional',  COALESCE(v_cita.prof_nombre, ''),
    'servicio',     COALESCE(v_cita.serv_nombre, ''),
    'salon',        COALESCE(v_cita.salon_nombre, 'el salón'),
    'color',        COALESCE(v_cita.color, '#f43f5e'),
    'ya_respondio', v_ya
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nps_info_por_token(TEXT) TO anon, authenticated;

-- RPC: registrar respuesta (accesible por anon)
CREATE OR REPLACE FUNCTION public.nps_registrar(
  p_token      TEXT,
  p_puntuacion INT,
  p_comentario TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cita RECORD;
BEGIN
  IF p_puntuacion < 1 OR p_puntuacion > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'puntuacion_invalida');
  END IF;

  SELECT id, tenant_id, cliente_id INTO v_cita
  FROM citas WHERE nps_token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  IF EXISTS(SELECT 1 FROM nps_respuestas WHERE cita_id = v_cita.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ya_respondio');
  END IF;

  INSERT INTO nps_respuestas(tenant_id, cliente_id, cita_id, puntuacion, comentario)
  VALUES (
    v_cita.tenant_id,
    v_cita.cliente_id,
    v_cita.id,
    p_puntuacion,
    NULLIF(TRIM(COALESCE(p_comentario, '')), '')
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.nps_registrar(TEXT, INT, TEXT) TO anon, authenticated;

-- pg_cron: NPS cada 30 minutos (citas completadas hace 2-6h)
-- REQUISITO: pg_cron + pg_net habilitados, edge function deployada
SELECT cron.schedule(
  'nps-post-visita',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://unpxoamfyushsbyyziyn.supabase.co/functions/v1/nps-post-visita',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

DO $$ BEGIN
  RAISE NOTICE '✓ v86: NPS post-visita — citas.nps_enviado/nps_token + tabla nps_respuestas + RPCs nps_info_por_token/nps_registrar + cron cada 30min';
END $$;
