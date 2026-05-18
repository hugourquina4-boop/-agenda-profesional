-- v63: fix RLS anticipos_profesional — usar ANY() para soportar superadmin multi-tenant

DROP POLICY IF EXISTS "anticipos_tenant" ON anticipos_profesional;

CREATE POLICY "anticipos_tenant" ON anticipos_profesional FOR ALL
  USING (
    tenant_id = ANY(
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  )
  WITH CHECK (
    tenant_id = ANY(
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Mismo fix para comisiones por consistencia
DROP POLICY IF EXISTS "comisiones_tenant" ON comisiones;
CREATE POLICY "comisiones_tenant" ON comisiones FOR ALL
  USING (
    tenant_id = ANY(
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  )
  WITH CHECK (
    tenant_id = ANY(
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Mismo fix para prestamos_cliente (creado en v62 con LIMIT 1)
DROP POLICY IF EXISTS "prestamos_tenant" ON prestamos_cliente;
CREATE POLICY "prestamos_tenant" ON prestamos_cliente FOR ALL
  USING (
    tenant_id = ANY(
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  )
  WITH CHECK (
    tenant_id = ANY(
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );
