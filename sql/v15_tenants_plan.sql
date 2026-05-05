-- v15: columnas plan y fecha_vencimiento directo en tenants (gestión simple superadmin)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'profesional'
  CHECK (plan IN ('basico','profesional','premium'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
