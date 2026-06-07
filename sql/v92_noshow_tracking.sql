-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v92: No-show tracking en clientes_agenda
-- ═══════════════════════════════════════════════════════════════════

-- Contador de inasistencias y flag de bloqueo por negocio
ALTER TABLE clientes_agenda
  ADD COLUMN IF NOT EXISTS contador_noshow  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_noshow BOOLEAN DEFAULT false;

-- Índice para consultas rápidas en portal público (bloqueo de reserva)
CREATE INDEX IF NOT EXISTS idx_clientes_noshow
  ON clientes_agenda (tenant_id, bloqueado_noshow)
  WHERE bloqueado_noshow = true;

-- Umbral de no-shows configurable por tenant (se guarda en tenants.noshow_umbral)
-- Default 3: al 3er no-show se activa bloqueado_noshow = true
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS noshow_umbral INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS noshow_bloqueo_activo BOOLEAN DEFAULT false;

DO $$ BEGIN
  RAISE NOTICE '✓ v92 aplicado: contador_noshow + bloqueado_noshow en clientes_agenda';
  RAISE NOTICE '   tenants.noshow_umbral (default 3) + noshow_bloqueo_activo (default false)';
END $$;
