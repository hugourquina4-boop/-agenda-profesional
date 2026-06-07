-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v93: Agente IA WhatsApp (Whapi.cloud)
-- ═══════════════════════════════════════════════════════════════════

-- Configuración del agente por tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS wa_agente_activo  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whapi_token       TEXT,
  ADD COLUMN IF NOT EXISTS wa_agente_nombre  TEXT DEFAULT 'Asistente',
  ADD COLUMN IF NOT EXISTS wa_agente_saludo  TEXT;

-- Historial de conversaciones del agente
CREATE TABLE IF NOT EXISTS wa_conversaciones (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_telefono    TEXT NOT NULL,
  cliente_nombre      TEXT,
  mensajes            JSONB DEFAULT '[]',
  ultima_actividad    TIMESTAMPTZ DEFAULT now(),
  handoff_humano      BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cliente_telefono)
);

ALTER TABLE wa_conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_conv_tenant_select" ON wa_conversaciones FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
);
CREATE POLICY "wa_conv_tenant_update" ON wa_conversaciones FOR UPDATE USING (
  tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
);

GRANT SELECT, UPDATE ON wa_conversaciones TO authenticated;

CREATE INDEX IF NOT EXISTS idx_wa_conv_tenant_tel ON wa_conversaciones(tenant_id, cliente_telefono);
CREATE INDEX IF NOT EXISTS idx_wa_conv_actividad  ON wa_conversaciones(tenant_id, ultima_actividad DESC);

DO $$ BEGIN
  RAISE NOTICE '✓ v93 aplicado: agente WA en tenants + tabla wa_conversaciones';
END $$;
