-- v74: Programa de puntos de fidelidad por cliente
-- Tabla puntos_cliente con movimientos de entrada/uso
-- APLICAR EN: Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS puntos_cliente (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id    UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('ganados','canjeados','ajuste')),
  puntos        INTEGER NOT NULL,          -- positivo = ganados, negativo = canjeados
  saldo         INTEGER NOT NULL DEFAULT 0, -- saldo acumulado DESPUÉS de este movimiento
  motivo        TEXT,                      -- 'Visita #123', 'Canje servicio', etc.
  referencia_id UUID,                      -- cita_id si aplica
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE puntos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "puntos_cliente_tenant_sel" ON puntos_cliente
  FOR SELECT TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "puntos_cliente_tenant_ins" ON puntos_cliente
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

CREATE POLICY "puntos_cliente_tenant_upd" ON puntos_cliente
  FOR UPDATE TO authenticated
  USING (tenant_id = (
    SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1
  ));

GRANT SELECT, INSERT, UPDATE ON puntos_cliente TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_puntos_cliente_cliente ON puntos_cliente(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_puntos_cliente_tenant  ON puntos_cliente(tenant_id, created_at DESC);

-- Columna puntos_acumulados en clientes_agenda para saldo rápido
ALTER TABLE clientes_agenda ADD COLUMN IF NOT EXISTS puntos_acumulados INTEGER DEFAULT 0;
