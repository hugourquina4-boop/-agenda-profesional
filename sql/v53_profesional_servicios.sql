-- v53_profesional_servicios.sql
-- Relación muchos-a-muchos entre profesionales y servicios.
-- Sin FKs explícitas para evitar problemas con RLS en tablas referenciadas.
-- Si un profesional no tiene filas aquí → puede hacer TODOS los servicios (compatibilidad).

CREATE TABLE IF NOT EXISTS profesional_servicios (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID          NOT NULL,
  profesional_id   UUID          NOT NULL,
  servicio_id      UUID          NOT NULL,
  activo           BOOLEAN       NOT NULL DEFAULT TRUE,
  tipo_comision    TEXT          NOT NULL DEFAULT 'ninguna'
                                 CHECK (tipo_comision IN ('porcentaje','fijo','ninguna')),
  valor_comision   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, profesional_id, servicio_id)
);

ALTER TABLE profesional_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select" ON profesional_servicios
  FOR SELECT USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

CREATE POLICY "ps_insert" ON profesional_servicios
  FOR INSERT WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

CREATE POLICY "ps_update" ON profesional_servicios
  FOR UPDATE USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

CREATE POLICY "ps_delete" ON profesional_servicios
  FOR DELETE USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true LIMIT 1
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON profesional_servicios TO authenticated;
