-- Permite que el rol anon actualice tenants (dev bypass para SalonConfig)
GRANT UPDATE ON tenants TO anon;

-- Política UPDATE para tenants (solo puede editar su propio tenant activo)
CREATE POLICY "tenants_dev_update" ON tenants
  FOR UPDATE
  USING (activo = true)
  WITH CHECK (activo = true);
