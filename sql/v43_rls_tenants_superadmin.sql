-- v43-pre: RLS SELECT policies en tenants para que superadmin vea todos
-- IDEMPOTENTE — puede re-ejecutarse sin daño
-- APLICAR EN: Supabase → SQL Editor

-- Superadmin ve TODOS los tenants (necesario para el panel React)
DROP POLICY IF EXISTS "superadmin_ve_todos_tenants" ON tenants;
CREATE POLICY "superadmin_ve_todos_tenants" ON tenants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_tenant
      WHERE user_id = auth.uid()
        AND rol = 'superadmin'
        AND activo = true
    )
  );

-- Usuario normal solo ve su propio tenant
DROP POLICY IF EXISTS "usuario_ve_su_tenant" ON tenants;
CREATE POLICY "usuario_ve_su_tenant" ON tenants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_tenant
      WHERE user_id = auth.uid()
        AND tenant_id = tenants.id
        AND activo = true
    )
  );

DO $$ BEGIN
  RAISE NOTICE '✓ v43-pre: RLS SELECT policies en tenants aplicadas';
END $$;
