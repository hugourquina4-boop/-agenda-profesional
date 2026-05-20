-- v80: boveda_accesos — gestor de contraseñas cifrado AES-GCM
-- El cifrado ocurre COMPLETAMENTE en el browser con la Web Crypto API.
-- Supabase NUNCA recibe texto claro. Solo guarda blobs cifrados.
-- La clave maestra vive solo en memoria de la sesión del usuario.

CREATE TABLE IF NOT EXISTS boveda_accesos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  nombre_enc    text        NOT NULL,  -- nombre del acceso, cifrado
  datos_enc     text        NOT NULL,  -- JSON cifrado: {usuario, clave, url, nota}
  iv            text        NOT NULL,  -- base64 del IV usado para AES-GCM
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boveda_user   ON boveda_accesos(user_id);
CREATE INDEX IF NOT EXISTS idx_boveda_tenant ON boveda_accesos(tenant_id);

ALTER TABLE boveda_accesos ENABLE ROW LEVEL SECURITY;

-- Solo el propio usuario accede a sus entradas
CREATE POLICY "boveda_own_select" ON boveda_accesos
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "boveda_own_insert" ON boveda_accesos
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "boveda_own_update" ON boveda_accesos
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "boveda_own_delete" ON boveda_accesos
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON boveda_accesos TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v80: boveda_accesos — vault AES-GCM, solo el usuario ve sus propios datos';
END $$;
