-- v89_consentimiento.sql
-- Consentimiento digital de clientes: tabla + RLS

CREATE TABLE IF NOT EXISTS consentimientos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL DEFAULT 'servicio'
                    CHECK (tipo IN ('servicio', 'datos', 'foto', 'general')),
  texto_version   TEXT,          -- snapshot del texto que el cliente aceptó
  nombre_firmante TEXT,          -- nombre como "firma" escrita
  aceptado_en     TIMESTAMPTZ,
  revocado_en     TIMESTAMPTZ,
  activo          BOOLEAN GENERATED ALWAYS AS (
                    aceptado_en IS NOT NULL AND revocado_en IS NULL
                  ) STORED,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consentimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consentimientos_tenant_all" ON consentimientos
  FOR ALL
  USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ))
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant
    WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE ON consentimientos TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_consentimientos_cliente ON consentimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_tenant  ON consentimientos(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consentimientos_cliente_tipo
  ON consentimientos(cliente_id, tipo);

-- Columna opcional en tenants para texto personalizado de consentimiento
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS texto_consentimiento TEXT DEFAULT NULL;
