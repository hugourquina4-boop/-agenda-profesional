-- v61: paquetes de servicios (combos con precio especial, reservables desde portal)

CREATE TABLE IF NOT EXISTS paquetes_salon (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  descripcion    TEXT,
  precio_normal  NUMERIC(12,2) NOT NULL DEFAULT 0,  -- suma de servicios individuales
  precio_paquete NUMERIC(12,2) NOT NULL DEFAULT 0,  -- precio con descuento
  duracion_min   INTEGER DEFAULT 0,                  -- duración total estimada
  activo         BOOLEAN DEFAULT true,
  visible_portal BOOLEAN DEFAULT true,               -- visible en portal de reservas
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paquetes_servicios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id  UUID NOT NULL REFERENCES paquetes_salon(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  orden       INTEGER DEFAULT 0
);

ALTER TABLE paquetes_salon    ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquetes_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paquetes_tenant" ON paquetes_salon FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));

CREATE POLICY "paquetes_servicios_tenant" ON paquetes_servicios FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));

-- Anon puede ver paquetes activos (para portal público)
CREATE POLICY "paquetes_anon_select" ON paquetes_salon FOR SELECT TO anon
  USING (activo = true AND visible_portal = true);
CREATE POLICY "paquetes_svcs_anon_select" ON paquetes_servicios FOR SELECT TO anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON paquetes_salon    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON paquetes_servicios TO authenticated;
GRANT SELECT ON paquetes_salon    TO anon;
GRANT SELECT ON paquetes_servicios TO anon;
