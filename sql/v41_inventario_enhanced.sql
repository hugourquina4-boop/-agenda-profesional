-- v41: Inventario mejorado
-- Agrega subcategoria, marca, codigo (SKU), contenido numérico, proveedor
-- Expande check de categoria para incluir unas e insumos
-- Agrega índice único (tenant_id, codigo) para upsert sin duplicados por SKU

-- ── Nuevas columnas ──────────────────────────────────────────────────────────
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS subcategoria TEXT;
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS marca       TEXT;
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS codigo      TEXT;
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS contenido   NUMERIC;
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS proveedor   TEXT;

-- ── Expandir check de categoría ──────────────────────────────────────────────
ALTER TABLE productos_salon DROP CONSTRAINT IF EXISTS productos_salon_categoria_check;
ALTER TABLE productos_salon ADD CONSTRAINT productos_salon_categoria_check
  CHECK (categoria IN (
    'capilar','color','tratamiento','retail','herramienta','unas','insumos','otro'
  ));

-- ── Índice único para upsert por SKU ─────────────────────────────────────────
-- Permite cargar CSV con códigos sin generar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS productos_salon_tenant_codigo_uq
  ON productos_salon (tenant_id, codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

DO $$ BEGIN
  RAISE NOTICE '✓ v41 aplicado: inventario mejorado con subcategoria, marca, codigo, contenido, proveedor';
END $$;
