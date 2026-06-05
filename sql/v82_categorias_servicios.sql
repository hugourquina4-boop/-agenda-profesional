-- v82_categorias_servicios.sql
-- Tabla de categorías de servicios con color, orden y seed automático por vertical

-- ── Tabla ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_servicio (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  color      TEXT        DEFAULT '#6366f1',
  orden      INT         DEFAULT 0,
  activo     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_catserv_tenant ON categorias_servicio(tenant_id, orden);

ALTER TABLE categorias_servicio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catserv_select" ON categorias_servicio
  FOR SELECT USING (tenant_id = mi_tenant_id());

CREATE POLICY "catserv_insert" ON categorias_servicio
  FOR INSERT WITH CHECK (tenant_id = mi_tenant_id());

CREATE POLICY "catserv_update" ON categorias_servicio
  FOR UPDATE USING (tenant_id = mi_tenant_id());

CREATE POLICY "catserv_delete" ON categorias_servicio
  FOR DELETE USING (tenant_id = mi_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON categorias_servicio TO authenticated;

-- ── Columnas en servicios ──────────────────────────────────────────────────
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_servicio(id) ON DELETE SET NULL;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS subcategoria TEXT;

-- ── Función seed por vertical ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_categorias_negocio(
  p_tenant_id UUID,
  p_vertical  TEXT DEFAULT 'peluqueria'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insertar categorías predeterminadas según vertical (ignora si ya existen)
  IF p_vertical IN ('peluqueria', 'salon', 'estetica', 'barberia', 'spa', NULL) THEN
    INSERT INTO categorias_servicio (tenant_id, nombre, color, orden)
    VALUES
      (p_tenant_id, 'Cabello',   '#8b5cf6', 1),
      (p_tenant_id, 'Uñas',      '#ec4899', 2),
      (p_tenant_id, 'Estética',  '#06b6d4', 3),
      (p_tenant_id, 'Barbería',  '#f59e0b', 4),
      (p_tenant_id, 'Otro',      '#6b7280', 5)
    ON CONFLICT (tenant_id, nombre) DO NOTHING;
  ELSIF p_vertical IN ('fisioterapia', 'medicina', 'psicologia', 'salud') THEN
    INSERT INTO categorias_servicio (tenant_id, nombre, color, orden)
    VALUES
      (p_tenant_id, 'Consulta',     '#3b82f6', 1),
      (p_tenant_id, 'Terapia',      '#22c55e', 2),
      (p_tenant_id, 'Diagnóstico',  '#f59e0b', 3),
      (p_tenant_id, 'Procedimiento','#ef4444', 4),
      (p_tenant_id, 'Otro',         '#6b7280', 5)
    ON CONFLICT (tenant_id, nombre) DO NOTHING;
  ELSE
    INSERT INTO categorias_servicio (tenant_id, nombre, color, orden)
    VALUES
      (p_tenant_id, 'General', '#6366f1', 1),
      (p_tenant_id, 'Otro',    '#6b7280', 2)
    ON CONFLICT (tenant_id, nombre) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION seed_categorias_negocio TO authenticated, service_role;

-- ── Migrar servicios existentes al nuevo categoria_id ─────────────────────
-- (correr DESPUÉS de que los tenants ya tengan sus categorías seeded)
-- UPDATE servicios s
-- SET categoria_id = cs.id
-- FROM categorias_servicio cs
-- WHERE cs.tenant_id = s.tenant_id
--   AND cs.nombre = s.categoria
--   AND s.categoria_id IS NULL;
