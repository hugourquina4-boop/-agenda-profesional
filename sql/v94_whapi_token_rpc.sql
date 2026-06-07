-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v94: whapi_configurado + RPC segura para guardar token
-- ═══════════════════════════════════════════════════════════════════

-- Columna de flag (el token nunca viaja al cliente)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS whapi_configurado BOOLEAN DEFAULT false;

-- Marcar como configurado si ya tenían token antes de esta migration
UPDATE tenants SET whapi_configurado = true WHERE whapi_token IS NOT NULL AND whapi_token <> '';

-- RPC SECURITY DEFINER: único canal para escribir el token.
-- El admin guarda el token → nunca lo recibe de vuelta.
CREATE OR REPLACE FUNCTION salon_set_whapi_token(p_tenant_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el llamante es miembro activo de este tenant
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND activo = true
  ) THEN
    RETURN jsonb_build_object('error', 'sin_acceso');
  END IF;

  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'token_vacio');
  END IF;

  UPDATE tenants
     SET whapi_token       = trim(p_token),
         whapi_configurado = true
   WHERE id = p_tenant_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION salon_set_whapi_token(UUID, TEXT) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v94 aplicado: whapi_configurado + salon_set_whapi_token';
END $$;
