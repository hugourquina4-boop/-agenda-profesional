-- v82_marketing: campañas, sellos, membresías y automatizaciones de marketing
-- Todas las tablas con RLS + aislamiento por tenant_id

-- ─────────────────────────────────────────
-- 1. Campañas de marketing
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campanas_marketing (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  nombre             TEXT NOT NULL,
  tipo               TEXT NOT NULL CHECK (tipo IN ('flash','pack_cumpleanos','recuperacion','doble_asistencia','temporada','lanzamiento')),
  activo             BOOLEAN DEFAULT true,
  fecha_inicio       DATE,
  fecha_fin          DATE,
  tipo_descuento     TEXT DEFAULT 'porcentaje' CHECK (tipo_descuento IN ('porcentaje','monto_fijo','sin_costo')),
  descuento_valor    NUMERIC DEFAULT 0,
  servicios_ids      UUID[] DEFAULT '{}',
  segmento           TEXT DEFAULT 'todos' CHECK (segmento IN ('todos','sin_visita','con_tag','cumpleanos_mes')),
  segmento_dias      INT DEFAULT 90,
  segmento_tag       TEXT,
  mensaje_wa         TEXT NOT NULL DEFAULT '',
  hora_envio         TIME DEFAULT '10:00:00',
  visible_portal     BOOLEAN DEFAULT false,
  contador_activo    BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE campanas_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanas_select" ON campanas_marketing FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
CREATE POLICY "campanas_insert" ON campanas_marketing FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
CREATE POLICY "campanas_update" ON campanas_marketing FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
CREATE POLICY "campanas_delete" ON campanas_marketing FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
GRANT SELECT, INSERT, UPDATE, DELETE ON campanas_marketing TO authenticated;

-- ─────────────────────────────────────────
-- 2. Configuración de tarjeta de sellos (1 por tenant)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sellos_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL UNIQUE,
  activo                   BOOLEAN DEFAULT true,
  nombre                   TEXT DEFAULT 'Tarjeta de sellos',
  sellos_requeridos        INT DEFAULT 8,
  recompensa_tipo          TEXT DEFAULT 'descuento' CHECK (recompensa_tipo IN ('servicio','descuento','producto')),
  recompensa_servicio_id   UUID,
  recompensa_descuento_pct NUMERIC DEFAULT 100,
  recompensa_descripcion   TEXT DEFAULT '1 servicio gratis',
  descuento_qr_bienvenida  NUMERIC DEFAULT 10,
  mensaje_bienvenida_qr    TEXT DEFAULT '¡Bienvenido/a {{nombre}}! Por registrarte hoy tienes un {{descuento}}% de descuento en tu próxima visita 🎉',
  created_at               TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sellos_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sellos_config_select" ON sellos_config FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
CREATE POLICY "sellos_config_insert" ON sellos_config FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
CREATE POLICY "sellos_config_update" ON sellos_config FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
GRANT SELECT, INSERT, UPDATE ON sellos_config TO authenticated;

-- ─────────────────────────────────────────
-- 3. Progreso de sellos por cliente
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sellos_cliente (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  cliente_id            UUID NOT NULL,
  sellos_actuales       INT DEFAULT 0,
  tarjetas_completadas  INT DEFAULT 0,
  ultima_actualizacion  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cliente_id)
);
ALTER TABLE sellos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sellos_cliente_all" ON sellos_cliente FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
GRANT SELECT, INSERT, UPDATE ON sellos_cliente TO authenticated;

-- ─────────────────────────────────────────
-- 4. Planes de membresía
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membresias_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  precio_mensual  NUMERIC NOT NULL,
  max_usos_mes    INT,
  servicios_ids   UUID[] DEFAULT '{}',
  activo          BOOLEAN DEFAULT true,
  color           TEXT DEFAULT '#6366f1',
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE membresias_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membresias_config_all" ON membresias_config FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
GRANT SELECT, INSERT, UPDATE, DELETE ON membresias_config TO authenticated;

-- ─────────────────────────────────────────
-- 5. Membresías asignadas a clientes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membresias_cliente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  cliente_id        UUID NOT NULL,
  membresia_id      UUID NOT NULL REFERENCES membresias_config(id) ON DELETE RESTRICT,
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  usos_este_mes     INT DEFAULT 0,
  estado            TEXT DEFAULT 'activo' CHECK (estado IN ('activo','pausado','vencido','cancelado')),
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE membresias_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membresias_cliente_all" ON membresias_cliente FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
GRANT SELECT, INSERT, UPDATE ON membresias_cliente TO authenticated;

-- ─────────────────────────────────────────
-- 6. Automatizaciones de marketing
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automatizaciones_marketing (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('resena_post_visita','te_extranamos','cumpleanos_pack','recordatorio_servicio')),
  activo               BOOLEAN DEFAULT false,
  horas_despues_cita   INT DEFAULT 2,
  dias_sin_visita      INT DEFAULT 90,
  hora_envio           TIME DEFAULT '10:00:00',
  descuento_porcentaje NUMERIC DEFAULT 0,
  mensaje_wa           TEXT NOT NULL DEFAULT '',
  pack_descripcion     TEXT,
  dias_recordatorio    INT DEFAULT 30,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tipo)
);
ALTER TABLE automatizaciones_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automatizaciones_all" ON automatizaciones_marketing FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1));
GRANT SELECT, INSERT, UPDATE ON automatizaciones_marketing TO authenticated;
