-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v33: Precios dinámicos por demanda (diferenciador único)
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reglas_precio_dinamico (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL DEFAULT 'Precio premium',
  -- Días: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  dias_semana   INT[] NOT NULL DEFAULT '{5,6}',
  hora_inicio   TIME NOT NULL DEFAULT '17:00',
  hora_fin      TIME NOT NULL DEFAULT '21:00',
  -- 1.2 = +20%, 1.5 = +50%
  multiplicador NUMERIC(4,2) NOT NULL DEFAULT 1.2
                CHECK (multiplicador > 0 AND multiplicador <= 5),
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reglas_precio_tenant
  ON reglas_precio_dinamico(tenant_id, activo);

ALTER TABLE reglas_precio_dinamico ENABLE ROW LEVEL SECURITY;

-- Authenticated: solo su tenant
DROP POLICY IF EXISTS "reglas_precio_admin" ON reglas_precio_dinamico;
CREATE POLICY "reglas_precio_admin" ON reglas_precio_dinamico
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Anon: solo lectura de reglas activas (portal de reservas público)
DROP POLICY IF EXISTS "reglas_precio_anon" ON reglas_precio_dinamico;
CREATE POLICY "reglas_precio_anon" ON reglas_precio_dinamico
  FOR SELECT TO anon
  USING (activo = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON reglas_precio_dinamico TO authenticated;
GRANT SELECT ON reglas_precio_dinamico TO anon;

-- Seed de ejemplo (se puede borrar)
-- INSERT INTO reglas_precio_dinamico (tenant_id, nombre, dias_semana, hora_inicio, hora_fin, multiplicador)
-- SELECT id, 'Fin de semana tarde', '{5,6}', '17:00', '21:00', 1.20 FROM tenants LIMIT 1;

DO $$ BEGIN
  RAISE NOTICE '✓ v33 aplicado: reglas_precio_dinamico con RLS + anon read';
END $$;
