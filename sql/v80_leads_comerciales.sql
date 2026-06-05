-- v80_leads_comerciales.sql
-- Pipeline de ventas para Salón Pro
-- Guarda leads capturados por el agente de WhatsApp

CREATE TABLE IF NOT EXISTS leads_comerciales (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT,
  telefono      TEXT,
  negocio       TEXT,
  ciudad        TEXT,
  estado        TEXT DEFAULT 'nuevo'
                CHECK (estado IN ('nuevo','contactado','demo','trial','pagando','perdido')),
  fuente        TEXT DEFAULT 'whatsapp',          -- whatsapp | landing | referido
  notas         TEXT,
  creado_en     TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda rápida por estado y fecha
CREATE INDEX IF NOT EXISTS leads_estado_idx ON leads_comerciales(estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS leads_telefono_idx ON leads_comerciales(telefono);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_leads_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS leads_updated_at ON leads_comerciales;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads_comerciales
  FOR EACH ROW EXECUTE FUNCTION update_leads_timestamp();

-- RLS: solo superadmin accede (no es tabla de negocio)
ALTER TABLE leads_comerciales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_solo_superadmin" ON leads_comerciales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios_tenant
      WHERE user_id = auth.uid() AND rol = 'superadmin' AND activo = true
    )
  );

-- RPC para insertar lead desde n8n (anon key, sin auth)
-- n8n llama a esta función desde el workflow de ventas
CREATE OR REPLACE FUNCTION insertar_lead_comercial(
  p_nombre   TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL,
  p_negocio  TEXT DEFAULT NULL,
  p_ciudad   TEXT DEFAULT NULL,
  p_fuente   TEXT DEFAULT 'whatsapp',
  p_notas    TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  -- Evitar duplicados por teléfono en las últimas 24h
  SELECT id INTO v_id
  FROM leads_comerciales
  WHERE telefono = p_telefono
    AND creado_en > now() - interval '24 hours'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Actualizar notas en lead existente
    UPDATE leads_comerciales
    SET notas = COALESCE(notas,'') || E'\n[' || to_char(now(),'HH24:MI') || '] ' || COALESCE(p_notas,'')
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO leads_comerciales(nombre, telefono, negocio, ciudad, fuente, notas)
  VALUES (p_nombre, p_telefono, p_negocio, p_ciudad, p_fuente, p_notas)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grant para que n8n pueda llamarlo con anon key
GRANT EXECUTE ON FUNCTION insertar_lead_comercial TO anon;

COMMENT ON TABLE leads_comerciales IS 'Pipeline CRM de leads de ventas para Salón Pro SaaS';
COMMENT ON FUNCTION insertar_lead_comercial IS 'Inserta o actualiza un lead; llamada desde el agente WA en n8n';
