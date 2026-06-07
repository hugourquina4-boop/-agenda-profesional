-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v94: Registro de envíos WhatsApp automáticos
--
-- Registra cada mensaje WA automático enviado por las Edge Functions
-- (confirmación de cita, recordatorios 24h/1h, cumpleaños) para alimentar
-- el dashboard de métricas del módulo Mensajería.
--
-- Seguridad: solo service_role escribe (las EFs). El dueño lee sus propios
-- registros vía RLS por tenant. Sin acceso para anon.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wa_envios_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,   -- confirmacion | recordatorio_24h | recordatorio_1h | cumpleanos | campana | agente
  telefono    TEXT,
  cita_id     UUID,            -- referencia suave (sin FK) a citas
  exito       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_envios_log ENABLE ROW LEVEL SECURITY;

-- Lectura: solo el tenant dueño (dashboard de métricas)
DROP POLICY IF EXISTS "wa_log_tenant_select" ON wa_envios_log;
CREATE POLICY "wa_log_tenant_select" ON wa_envios_log FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
);

-- Escritura: exclusiva de service_role (las Edge Functions). authenticated NO inserta.
REVOKE INSERT, UPDATE, DELETE ON wa_envios_log FROM anon, authenticated;
GRANT SELECT ON wa_envios_log TO authenticated;
GRANT SELECT, INSERT, DELETE ON wa_envios_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_wa_log_tenant_fecha ON wa_envios_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_log_tenant_tipo  ON wa_envios_log(tenant_id, tipo);

DO $$ BEGIN
  RAISE NOTICE '✓ v94 aplicado: wa_envios_log (métricas de WhatsApp automático)';
END $$;
