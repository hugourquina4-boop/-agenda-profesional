-- ═══════════════════════════════════════════════════════════════
-- v24: Plataforma de accesos, credenciales y pagos por negocio
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Columnas de acceso en la tabla tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_email       text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_clave_temp  text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_clave_fecha timestamptz;

-- Sincronizar admin_email desde usuarios_tenant (datos existentes)
UPDATE tenants t
SET admin_email = ut.email
FROM usuarios_tenant ut
WHERE ut.tenant_id = t.id
  AND ut.rol = 'admin'
  AND ut.activo = true
  AND t.admin_email IS NULL;

-- Sincronizar con columna email si ya existía
UPDATE tenants SET admin_email = email
WHERE admin_email IS NULL AND email IS NOT NULL;

-- 2. Tabla de pagos y suscripciones por negocio
CREATE TABLE IF NOT EXISTS pagos_negocio (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  monto         numeric(12,2) NOT NULL DEFAULT 0,
  plan          text,
  metodo_pago   text DEFAULT 'efectivo',
  periodo_desde date,
  periodo_hasta date,
  referencia    text,
  notas         text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE pagos_negocio ENABLE ROW LEVEL SECURITY;

-- Panel superadmin usa anon key — acceso controlado por contraseña del panel
CREATE POLICY "pagos_anon_all" ON pagos_negocio
  FOR ALL TO anon        USING (true) WITH CHECK (true);
CREATE POLICY "pagos_auth_all" ON pagos_negocio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON pagos_negocio TO anon, authenticated;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_pagos_tenant ON pagos_negocio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha  ON pagos_negocio(periodo_hasta);

-- ═══════════════════════════════════════════════════════════════
-- INSTRUCCIONES DEPLOY
-- 1. Ejecuta este SQL en Supabase Dashboard → SQL Editor
-- 2. Despliega la Edge Function admin-reset-password:
--    supabase functions deploy admin-reset-password
-- 3. Configura el secret:
--    supabase secrets set ADMIN_SECRET=salonpro2026
-- ═══════════════════════════════════════════════════════════════
