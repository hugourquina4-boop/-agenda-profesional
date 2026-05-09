-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v30: Galería de fotos antes/después por cliente
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fotos_cliente (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  foto_url   TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'resultado'
             CHECK (tipo IN ('antes','despues','resultado')),
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fotos_cliente ON fotos_cliente(tenant_id, cliente_id, created_at DESC);

ALTER TABLE fotos_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fotos_tenant" ON fotos_cliente;
CREATE POLICY "fotos_tenant" ON fotos_cliente
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON fotos_cliente TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v30 aplicado: fotos_cliente con RLS';
END $$;
