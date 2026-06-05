-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v91: Fecha de vencimiento en productos del inventario
-- ═══════════════════════════════════════════════════════════════════

-- Columna de vencimiento y lote para trazabilidad
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
ALTER TABLE productos_salon ADD COLUMN IF NOT EXISTS lote TEXT;

-- Índice para queries rápidas por vencimiento próximo
CREATE INDEX IF NOT EXISTS idx_productos_vencimiento
  ON productos_salon (tenant_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL AND activo = true;

DO $$ BEGIN
  RAISE NOTICE '✓ v91 aplicado: fecha_vencimiento + lote en productos_salon';
END $$;
