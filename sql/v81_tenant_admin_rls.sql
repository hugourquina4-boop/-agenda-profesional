-- v81: Fix UPDATE policy en tenants + DB-level subscription enforcement
-- PROBLEMA: tenants solo tenía SELECT policies para admins no-superadmin
--           → SalonConfig.jsx guardaba sin error pero no actualizaba nada
-- SOLUCIÓN:
--   1. UPDATE policy para admins de su propio tenant
--   2. mi_tenant_id() ahora verifica activo=true y fecha_vencimiento
--      → si el tenant está suspendido o vencido, mi_tenant_id() retorna NULL
--      → TODAS las políticas que usan mi_tenant_id() bloquean automáticamente
--      → el bloqueo es a nivel de BD, no solo en el frontend

-- ── 1. UPDATE mi_tenant_id() con verificación de suscripción ────────────
-- Antes: solo verificaba usuarios_tenant.activo
-- Ahora: también verifica tenants.activo y fecha_vencimiento (1 día de gracia)
CREATE OR REPLACE FUNCTION mi_tenant_id() RETURNS UUID AS $$
  SELECT ut.tenant_id
  FROM usuarios_tenant ut
  INNER JOIN tenants t ON t.id = ut.tenant_id
  WHERE ut.user_id = auth.uid()
    AND ut.activo  = true
    AND t.activo   = true
    AND (
      t.fecha_vencimiento IS NULL
      OR t.fecha_vencimiento >= CURRENT_DATE - INTERVAL '1 day'
    )
  ORDER BY ut.created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 2. UPDATE policy en tenants para admins del negocio ─────────────────
-- Permite que admin/superadmin actualicen su propio tenant (Config.jsx)
-- USING: verifica acceso al registro ANTES de modificar
-- WITH CHECK: verifica que el UPDATE resultante también cumple la condición
DROP POLICY IF EXISTS "t_admin_update" ON tenants;
CREATE POLICY "t_admin_update" ON tenants
  FOR UPDATE TO authenticated
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM usuarios_tenant
      WHERE user_id  = auth.uid()
        AND tenant_id = tenants.id
        AND activo   = true
        AND rol IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_tenant
      WHERE user_id  = auth.uid()
        AND tenant_id = tenants.id
        AND activo   = true
        AND rol IN ('admin', 'superadmin')
    )
  );

-- ── 3. GRANT explícito de UPDATE en tenants (ya cubierto por ALL,
--        pero se explicita por claridad de auditoría) ───────────────────
GRANT SELECT, UPDATE ON tenants TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v81: UPDATE policy tenants + mi_tenant_id() con activo+vencimiento. Config.jsx ya puede guardar.';
END $$;
