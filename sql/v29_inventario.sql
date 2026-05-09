-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v29: Inventario de productos
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS productos_salon (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  categoria    TEXT NOT NULL DEFAULT 'retail'
               CHECK (categoria IN ('capilar','color','tratamiento','retail','herramienta','otro')),
  precio_venta NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_costo NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock        INT NOT NULL DEFAULT 0,
  stock_minimo INT NOT NULL DEFAULT 0,
  unidad       TEXT NOT NULL DEFAULT 'unidad',
  foto_url     TEXT,
  activo       BOOLEAN DEFAULT true,
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_tenant ON productos_salon(tenant_id, categoria, activo);

ALTER TABLE productos_salon ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "productos_tenant" ON productos_salon;
CREATE POLICY "productos_tenant" ON productos_salon
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON productos_salon TO authenticated;

DROP TRIGGER IF EXISTS trg_productos_updated_at ON productos_salon;
CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos_salon
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DO $$ BEGIN
  RAISE NOTICE '✓ v29 aplicado: productos_salon con RLS, trigger updated_at';
END $$;
