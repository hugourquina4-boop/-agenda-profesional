-- v15: Bloqueos de profesional (puntual o recurrente semanal)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bloqueos_profesional (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id  UUID          NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  titulo          TEXT          NOT NULL DEFAULT 'Bloqueado',
  fecha_inicio    DATE          NOT NULL,
  fecha_fin       DATE,                          -- NULL = solo fecha_inicio
  hora_inicio     TIME,                          -- NULL = todo el día
  hora_fin        TIME,
  todo_el_dia     BOOLEAN       NOT NULL DEFAULT true,
  recurrente      BOOLEAN       NOT NULL DEFAULT false,
  dia_semana      SMALLINT      CHECK (dia_semana BETWEEN 0 AND 6),  -- 0=Dom … 6=Sáb; solo si recurrente
  activo          BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE bloqueos_profesional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloqueos_sel" ON bloqueos_profesional
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

CREATE POLICY "bloqueos_ins" ON bloqueos_profesional
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

CREATE POLICY "bloqueos_upd" ON bloqueos_profesional
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

CREATE POLICY "bloqueos_del" ON bloqueos_profesional
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON bloqueos_profesional TO authenticated;
