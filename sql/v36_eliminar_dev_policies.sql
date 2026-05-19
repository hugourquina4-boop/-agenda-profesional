-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v36: Eliminar políticas dev_* (SEGURIDAD — EJECUTAR ANTES DE CLIENTES REALES)
-- Las políticas dev_* de v9 y v11 permiten que CUALQUIER usuario
-- autenticado escriba en datos de CUALQUIER tenant activo.
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── Políticas de v9_dev_permisos.sql ─────────────────────────────
DROP POLICY IF EXISTS "dev_citas_ins"      ON citas;
DROP POLICY IF EXISTS "dev_citas_upd"      ON citas;
DROP POLICY IF EXISTS "dev_clientes_ins"   ON clientes_agenda;
DROP POLICY IF EXISTS "dev_clientes_upd"   ON clientes_agenda;
DROP POLICY IF EXISTS "dev_horarios_ins"   ON horarios;
DROP POLICY IF EXISTS "dev_horarios_upd"   ON horarios;
DROP POLICY IF EXISTS "dev_profs_ins"      ON profesionales;
DROP POLICY IF EXISTS "dev_profs_upd"      ON profesionales;
DROP POLICY IF EXISTS "dev_servs_ins"      ON servicios;
DROP POLICY IF EXISTS "dev_servs_upd"      ON servicios;

-- ── Políticas de v11_produccion_core.sql ─────────────────────────
DROP POLICY IF EXISTS "pagos_dev_write"    ON pagos;
DROP POLICY IF EXISTS "cr_dev"             ON commission_rules;
DROP POLICY IF EXISTS "co_dev"             ON comisiones;
DROP POLICY IF EXISTS "ev_dev"             ON eventos_agenda;

-- ── Políticas de v28 ─────────────────────────────────────────────
DROP POLICY IF EXISTS "ordenes_dev_write"  ON ordenes_espera;

-- Verificar que las políticas de tenant siguen activas:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

DO $$ BEGIN
  RAISE NOTICE '✓ v36 aplicado: políticas dev_* eliminadas — aislamiento multi-tenant reforzado';
END $$;
