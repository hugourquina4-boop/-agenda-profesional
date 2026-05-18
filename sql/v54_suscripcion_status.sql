-- v54_suscripcion_status.sql
-- Permite que tenants lean su propia suscripción desde el frontend
-- para mostrar el conteo de días y bloquear cuando vence.

-- Suscripciones: cada tenant solo ve la suya
ALTER TABLE suscripciones_negocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suscripcion_tenant_select" ON suscripciones_negocio
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

GRANT SELECT ON suscripciones_negocio TO authenticated;
-- INSERT/UPDATE/DELETE siguen siendo solo via service_role (superadmin.html / Edge Functions)
