-- v66: plantillas de mensajería editables por tenant
-- Permite que cada negocio personalice sus mensajes WA sin tocar código.
-- Si no tiene plantillas propias, el frontend usa las TEMPLATES hardcodeadas como fallback.

CREATE TABLE IF NOT EXISTS plantillas_mensajeria (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo     TEXT        NOT NULL,
  emoji      TEXT        NOT NULL DEFAULT '💬',
  texto      TEXT        NOT NULL,
  orden      INT         NOT NULL DEFAULT 0,
  activo     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plantillas_mensajeria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantillas_select" ON plantillas_mensajeria
  FOR SELECT USING (
    tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true)
  );

CREATE POLICY "plantillas_insert" ON plantillas_mensajeria
  FOR INSERT WITH CHECK (
    tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true)
  );

CREATE POLICY "plantillas_update" ON plantillas_mensajeria
  FOR UPDATE USING (
    tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true)
  );

CREATE POLICY "plantillas_delete" ON plantillas_mensajeria
  FOR DELETE USING (
    tenant_id = ANY(SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON plantillas_mensajeria TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v66: plantillas_mensajeria — plantillas WA editables por tenant';
END $$;
