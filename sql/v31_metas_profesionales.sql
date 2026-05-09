-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v31: Meta mensual por profesional
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Agrega columna meta_mensual a commission_rules si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_rules' AND column_name = 'meta_mensual'
  ) THEN
    ALTER TABLE commission_rules ADD COLUMN meta_mensual NUMERIC(10,2) DEFAULT NULL;
    RAISE NOTICE '✓ Columna meta_mensual agregada a commission_rules';
  ELSE
    RAISE NOTICE 'ℹ Columna meta_mensual ya existe';
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE '✓ v31 aplicado: meta_mensual en commission_rules';
END $$;
