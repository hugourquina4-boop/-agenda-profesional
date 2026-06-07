-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v93: Agente IA WhatsApp (Whapi.cloud) — diseño seguro
--
-- Seguridad: el whapi_token es una credencial de tercero (WhatsApp) y
-- NUNCA debe llegar al frontend. TenantContext hace tenants.select('*'),
-- así que el token NO puede vivir en `tenants`. Se guarda en una tabla
-- aparte `wa_config` sin acceso para anon/authenticated (solo service_role,
-- que es quien lo usa desde la Edge Function). El admin lo escribe vía RPC
-- SECURITY DEFINER; el frontend solo conoce el booleano `whapi_configurado`.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Config NO sensible del agente (segura de exponer vía select('*'))
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS wa_agente_activo   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_agente_nombre   TEXT DEFAULT 'Asistente',
  ADD COLUMN IF NOT EXISTS wa_agente_saludo   TEXT,
  ADD COLUMN IF NOT EXISTS whapi_configurado  BOOLEAN DEFAULT false;

-- 2. Almacén del secreto — solo service_role lo toca
CREATE TABLE IF NOT EXISTS wa_config (
  tenant_id    UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  whapi_token  TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_config ENABLE ROW LEVEL SECURITY;
-- Sin políticas para anon/authenticated → sin acceso. service_role bypassa RLS.
REVOKE ALL ON wa_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wa_config TO service_role;

-- 3. Migración defensiva: si un borrador anterior dejó whapi_token en
--    tenants (filtrable por el cliente), lo movemos a wa_config y lo
--    eliminamos de tenants.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'whapi_token'
  ) THEN
    EXECUTE $mig$
      INSERT INTO wa_config (tenant_id, whapi_token)
      SELECT id, whapi_token FROM tenants WHERE whapi_token IS NOT NULL
      ON CONFLICT (tenant_id) DO UPDATE SET whapi_token = EXCLUDED.whapi_token
    $mig$;
    EXECUTE 'UPDATE tenants SET whapi_configurado = true WHERE whapi_token IS NOT NULL';
    EXECUTE 'ALTER TABLE tenants DROP COLUMN whapi_token';
    RAISE NOTICE '✓ whapi_token migrado de tenants a wa_config y eliminado de tenants';
  END IF;
END $$;

-- 4. RPC para fijar el token (solo admin/superadmin del tenant, solo-escritura)
CREATE OR REPLACE FUNCTION salon_set_whapi_token(p_tenant_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rol TEXT;
BEGIN
  SELECT rol INTO v_rol
  FROM usuarios_tenant
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND activo = true
  LIMIT 1;

  IF v_rol IS NULL OR v_rol NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object('error', 'no_autorizado');
  END IF;

  -- Token vacío → limpiar configuración
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    DELETE FROM wa_config WHERE tenant_id = p_tenant_id;
    UPDATE tenants SET whapi_configurado = false WHERE id = p_tenant_id;
    RETURN jsonb_build_object('ok', true, 'configurado', false);
  END IF;

  INSERT INTO wa_config (tenant_id, whapi_token, updated_at)
  VALUES (p_tenant_id, trim(p_token), now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET whapi_token = EXCLUDED.whapi_token, updated_at = now();

  UPDATE tenants SET whapi_configurado = true WHERE id = p_tenant_id;
  RETURN jsonb_build_object('ok', true, 'configurado', true);
END;
$$;

GRANT EXECUTE ON FUNCTION salon_set_whapi_token(UUID, TEXT) TO authenticated;

-- 5. Historial de conversaciones del agente
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

DROP POLICY IF EXISTS "wa_conv_tenant_select" ON wa_conversaciones;
CREATE POLICY "wa_conv_tenant_select" ON wa_conversaciones FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
);

DROP POLICY IF EXISTS "wa_conv_tenant_update" ON wa_conversaciones;
CREATE POLICY "wa_conv_tenant_update" ON wa_conversaciones FOR UPDATE USING (
  tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
);

GRANT SELECT, UPDATE ON wa_conversaciones TO authenticated;

CREATE INDEX IF NOT EXISTS idx_wa_conv_tenant_tel ON wa_conversaciones(tenant_id, cliente_telefono);
CREATE INDEX IF NOT EXISTS idx_wa_conv_actividad  ON wa_conversaciones(tenant_id, ultima_actividad DESC);

DO $$ BEGIN
  RAISE NOTICE '✓ v93 aplicado: agente WA seguro (wa_config + RPC) + wa_conversaciones';
END $$;
