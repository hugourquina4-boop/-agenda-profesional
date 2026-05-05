-- =====================================================================
-- AGENDAS PROFESIONALES SaaS — Schema v1.0  (idempotente)
-- Supabase (PostgreSQL 15+) | Multi-tenant con RLS
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- ENUMS  (seguros para re-ejecutar)
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE vertical_tipo AS ENUM ('psicologo', 'peluqueria', 'sso', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_tipo AS ENUM ('free', 'basico', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE suscripcion_estado AS ENUM ('trial', 'activa', 'vencida', 'suspendida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cita_estado AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dia_semana AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- TABLA 0: SUPERADMINS
-- =====================================================================

CREATE TABLE IF NOT EXISTS superadmins (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- TABLA 1: PLANES
-- =====================================================================

CREATE TABLE IF NOT EXISTS planes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,
  tipo                 plan_tipo NOT NULL UNIQUE,
  precio_mes           NUMERIC(10,2) DEFAULT 0,
  max_citas_mes        INT DEFAULT 30,
  max_profesionales    INT DEFAULT 1,
  tiene_recordatorios  BOOLEAN DEFAULT false,
  tiene_whatsapp       BOOLEAN DEFAULT false,
  tiene_reportes       BOOLEAN DEFAULT false,
  tiene_multisede      BOOLEAN DEFAULT false,
  descripcion          TEXT,
  activo               BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO planes (nombre, tipo, precio_mes, max_citas_mes, max_profesionales,
                    tiene_recordatorios, tiene_whatsapp, tiene_reportes, descripcion)
VALUES
  ('Gratuito',   'free',          0,     30,    1, false, false, false, 'Para probar la plataforma'),
  ('Básico',     'basico',    49000,    150,    2, true,  false, true,  'Consultorio pequeño'),
  ('Pro',        'pro',       99000,    500,    5, true,  true,  true,  'Negocio en crecimiento'),
  ('Enterprise', 'enterprise',199000,  NULL, NULL, true,  true,  true,  'Sin límites — multi-sede')
ON CONFLICT (tipo) DO NOTHING;

-- =====================================================================
-- TABLA 2: TENANTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug             TEXT UNIQUE NOT NULL,
  nombre           TEXT NOT NULL,
  vertical         vertical_tipo NOT NULL DEFAULT 'otro',
  email            TEXT,
  whatsapp         TEXT,
  telefono         TEXT,
  ciudad           TEXT DEFAULT 'Cali',
  direccion        TEXT,
  logo_url         TEXT,
  color_primario   TEXT DEFAULT '#3b82f6',
  descripcion      TEXT,
  config_vertical  JSONB DEFAULT '{}'::jsonb,
  activo           BOOLEAN DEFAULT true,
  verificado       BOOLEAN DEFAULT false,
  owner_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug     ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON tenants(vertical);
CREATE INDEX IF NOT EXISTS idx_tenants_owner    ON tenants(owner_id);

-- =====================================================================
-- TABLA 3: SUSCRIPCIONES
-- =====================================================================

CREATE TABLE IF NOT EXISTS suscripciones (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES planes(id),
  estado             suscripcion_estado DEFAULT 'trial',
  fecha_inicio       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE,
  fecha_cancelacion  DATE,
  monto_cobrado      NUMERIC(10,2),
  metodo_pago        TEXT,
  referencia_pago    TEXT,
  notas_pago         TEXT,
  citas_usadas_mes   INT DEFAULT 0,
  mes_referencia     TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suscripciones_tenant      ON suscripciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_vencimiento ON suscripciones(fecha_vencimiento)
  WHERE estado = 'activa';

-- =====================================================================
-- TABLA 4: USUARIOS TENANT
-- =====================================================================

CREATE TABLE IF NOT EXISTS usuarios_tenant (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        TEXT DEFAULT 'admin' CHECK (rol IN ('admin', 'profesional', 'recepcion')),
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  activo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_tenant ON usuarios_tenant(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_user   ON usuarios_tenant(user_id);

-- =====================================================================
-- TABLA 5: PROFESIONALES
-- =====================================================================

CREATE TABLE IF NOT EXISTS profesionales (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre        TEXT NOT NULL,
  especialidad  TEXT,
  foto_url      TEXT,
  color         TEXT DEFAULT '#3b82f6',
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profesionales_tenant ON profesionales(tenant_id);

-- =====================================================================
-- TABLA 6: SERVICIOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS servicios (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  descripcion          TEXT,
  duracion_min         INT NOT NULL DEFAULT 30,
  precio               NUMERIC(10,2) DEFAULT 0,
  color                TEXT DEFAULT '#3b82f6',
  activo               BOOLEAN DEFAULT true,
  orden                INT DEFAULT 0,
  requiere_formulario  BOOLEAN DEFAULT false,
  formulario_config    JSONB DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicios_tenant ON servicios(tenant_id);

CREATE TABLE IF NOT EXISTS profesional_servicios (
  profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id    UUID REFERENCES servicios(id) ON DELETE CASCADE,
  PRIMARY KEY (profesional_id, servicio_id)
);

-- =====================================================================
-- TABLA 7: HORARIOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS horarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id  UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  dia             dia_semana NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  activo          BOOLEAN DEFAULT true,
  UNIQUE (profesional_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_horarios_profesional ON horarios(profesional_id);

CREATE TABLE IF NOT EXISTS bloqueos_agenda (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id  UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  fecha_inicio    TIMESTAMPTZ NOT NULL,
  fecha_fin       TIMESTAMPTZ NOT NULL,
  motivo          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_prof_fecha ON bloqueos_agenda(profesional_id, fecha_inicio);

-- =====================================================================
-- TABLA 8: CLIENTES AGENDA
-- =====================================================================

CREATE TABLE IF NOT EXISTS clientes_agenda (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  email            TEXT,
  telefono         TEXT,
  whatsapp         TEXT,
  fecha_nacimiento DATE,
  notas            TEXT,
  datos_vertical   JSONB DEFAULT '{}'::jsonb,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes_agenda(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes_agenda
  USING gin (to_tsvector('spanish', nombre));

-- =====================================================================
-- TABLA 9: CITAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS citas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id       UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  profesional_id   UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id      UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  fecha_inicio     TIMESTAMPTZ NOT NULL,
  fecha_fin        TIMESTAMPTZ NOT NULL,
  estado           cita_estado DEFAULT 'pendiente',
  recordatorio_enviado      BOOLEAN DEFAULT false,
  recordatorio_24h_enviado  BOOLEAN DEFAULT false,
  canal_notificacion        TEXT DEFAULT 'whatsapp',
  notas_profesional         TEXT,
  motivo_cancelacion        TEXT,
  respuestas_formulario     JSONB DEFAULT '{}'::jsonb,
  precio_cobrado            NUMERIC(10,2),
  pago_estado     TEXT DEFAULT 'pendiente' CHECK (pago_estado IN ('pendiente','pagado','exento')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citas_tenant      ON citas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_citas_prof_fecha  ON citas(profesional_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_citas_cliente     ON citas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_citas_estado      ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_citas_fecha       ON citas(fecha_inicio) WHERE estado != 'cancelada';

-- =====================================================================
-- TABLA 10: LOGS DE ACTIVIDAD
-- =====================================================================

CREATE TABLE IF NOT EXISTS logs_actividad (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  evento     TEXT NOT NULL,
  detalle    JSONB DEFAULT '{}'::jsonb,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_tenant_fecha ON logs_actividad(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_evento       ON logs_actividad(evento);

-- =====================================================================
-- TABLA 11: WEBHOOKS
-- =====================================================================

CREATE TABLE IF NOT EXISTS webhooks_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento          TEXT NOT NULL,
  url_webhook     TEXT NOT NULL,
  activo          BOOLEAN DEFAULT true,
  ultimo_trigger  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, evento)
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks_config(tenant_id);

-- =====================================================================
-- TRIGGER updated_at
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'planes','tenants','suscripciones','profesionales',
    'servicios','clientes_agenda','citas'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'set_updated_at'
        AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()', t
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- FUNCIONES HELPER
-- =====================================================================

CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM superadmins WHERE id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION mi_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM usuarios_tenant
  WHERE user_id = auth.uid() AND activo = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE planes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscripciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_tenant       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesionales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesional_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_agenda       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_agenda       ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_actividad        ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks_config       ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- POLÍTICAS  (DROP IF EXISTS antes de crear, para que sea re-ejecutable)
-- =====================================================================

-- Planes
DROP POLICY IF EXISTS "planes_read"       ON planes;
DROP POLICY IF EXISTS "planes_superadmin" ON planes;
CREATE POLICY "planes_read"       ON planes FOR SELECT USING (true);
CREATE POLICY "planes_superadmin" ON planes FOR ALL    USING (es_superadmin());

-- Tenants
DROP POLICY IF EXISTS "tenants_superadmin" ON tenants;
DROP POLICY IF EXISTS "tenants_owner"      ON tenants;
DROP POLICY IF EXISTS "tenants_usuario"    ON tenants;
DROP POLICY IF EXISTS "tenants_public_read" ON tenants;
CREATE POLICY "tenants_superadmin"  ON tenants FOR ALL    USING (es_superadmin());
CREATE POLICY "tenants_owner"       ON tenants FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "tenants_usuario"     ON tenants FOR SELECT USING (id = mi_tenant_id());
CREATE POLICY "tenants_public_read" ON tenants FOR SELECT USING (activo = true);

-- Suscripciones
DROP POLICY IF EXISTS "suscr_superadmin"  ON suscripciones;
DROP POLICY IF EXISTS "suscr_tenant_read" ON suscripciones;
CREATE POLICY "suscr_superadmin"  ON suscripciones FOR ALL    USING (es_superadmin());
CREATE POLICY "suscr_tenant_read" ON suscripciones FOR SELECT USING (tenant_id = mi_tenant_id());

-- Usuarios tenant
DROP POLICY IF EXISTS "ut_superadmin" ON usuarios_tenant;
DROP POLICY IF EXISTS "ut_propio"     ON usuarios_tenant;
CREATE POLICY "ut_superadmin" ON usuarios_tenant FOR ALL USING (es_superadmin());
CREATE POLICY "ut_propio"     ON usuarios_tenant FOR ALL USING (tenant_id = mi_tenant_id());

-- Profesionales
DROP POLICY IF EXISTS "prof_superadmin"  ON profesionales;
DROP POLICY IF EXISTS "prof_tenant"      ON profesionales;
DROP POLICY IF EXISTS "prof_public_read" ON profesionales;
CREATE POLICY "prof_superadmin"  ON profesionales FOR ALL    USING (es_superadmin());
CREATE POLICY "prof_tenant"      ON profesionales FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "prof_public_read" ON profesionales FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

-- Servicios
DROP POLICY IF EXISTS "serv_superadmin"  ON servicios;
DROP POLICY IF EXISTS "serv_tenant"      ON servicios;
DROP POLICY IF EXISTS "serv_public_read" ON servicios;
CREATE POLICY "serv_superadmin"  ON servicios FOR ALL    USING (es_superadmin());
CREATE POLICY "serv_tenant"      ON servicios FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "serv_public_read" ON servicios FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

-- Profesional servicios
DROP POLICY IF EXISTS "ps_superadmin"  ON profesional_servicios;
DROP POLICY IF EXISTS "ps_tenant"      ON profesional_servicios;
DROP POLICY IF EXISTS "ps_public_read" ON profesional_servicios;
CREATE POLICY "ps_superadmin"  ON profesional_servicios FOR ALL USING (es_superadmin());
CREATE POLICY "ps_tenant"      ON profesional_servicios FOR ALL
  USING (profesional_id IN (SELECT id FROM profesionales WHERE tenant_id = mi_tenant_id()));
CREATE POLICY "ps_public_read" ON profesional_servicios FOR SELECT USING (true);

-- Horarios
DROP POLICY IF EXISTS "hor_superadmin"  ON horarios;
DROP POLICY IF EXISTS "hor_tenant"      ON horarios;
DROP POLICY IF EXISTS "hor_public_read" ON horarios;
CREATE POLICY "hor_superadmin"  ON horarios FOR ALL    USING (es_superadmin());
CREATE POLICY "hor_tenant"      ON horarios FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "hor_public_read" ON horarios FOR SELECT USING (activo = true);

-- Bloqueos
DROP POLICY IF EXISTS "bloq_superadmin"  ON bloqueos_agenda;
DROP POLICY IF EXISTS "bloq_tenant"      ON bloqueos_agenda;
DROP POLICY IF EXISTS "bloq_public_read" ON bloqueos_agenda;
CREATE POLICY "bloq_superadmin"  ON bloqueos_agenda FOR ALL    USING (es_superadmin());
CREATE POLICY "bloq_tenant"      ON bloqueos_agenda FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "bloq_public_read" ON bloqueos_agenda FOR SELECT USING (true);

-- Clientes agenda
DROP POLICY IF EXISTS "cli_superadmin" ON clientes_agenda;
DROP POLICY IF EXISTS "cli_tenant"     ON clientes_agenda;
DROP POLICY IF EXISTS "clientes_agenda_tenant_read" ON clientes_agenda;
CREATE POLICY "cli_superadmin" ON clientes_agenda FOR ALL    USING (es_superadmin());
CREATE POLICY "cli_tenant"     ON clientes_agenda FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "clientes_agenda_tenant_read" ON clientes_agenda FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

-- Citas
DROP POLICY IF EXISTS "citas_superadmin"   ON citas;
DROP POLICY IF EXISTS "citas_tenant"       ON citas;
DROP POLICY IF EXISTS "citas_tenant_read"  ON citas;
CREATE POLICY "citas_superadmin"  ON citas FOR ALL    USING (es_superadmin());
CREATE POLICY "citas_tenant"      ON citas FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "citas_tenant_read" ON citas FOR SELECT USING (
  tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

-- Logs
DROP POLICY IF EXISTS "logs_superadmin"    ON logs_actividad;
DROP POLICY IF EXISTS "logs_tenant_read"   ON logs_actividad;
DROP POLICY IF EXISTS "logs_tenant_insert" ON logs_actividad;
CREATE POLICY "logs_superadmin"    ON logs_actividad FOR ALL    USING (es_superadmin());
CREATE POLICY "logs_tenant_read"   ON logs_actividad FOR SELECT USING (tenant_id = mi_tenant_id());
CREATE POLICY "logs_tenant_insert" ON logs_actividad FOR INSERT WITH CHECK (tenant_id = mi_tenant_id());

-- Webhooks
DROP POLICY IF EXISTS "wh_superadmin" ON webhooks_config;
DROP POLICY IF EXISTS "wh_tenant"     ON webhooks_config;
CREATE POLICY "wh_superadmin" ON webhooks_config FOR ALL USING (es_superadmin());
CREATE POLICY "wh_tenant"     ON webhooks_config FOR ALL USING (tenant_id = mi_tenant_id());

-- =====================================================================
-- FIN schema_v1.0
-- Después de ejecutar, inserta tu superadmin:
--   INSERT INTO superadmins (id, nombre, email)
--   VALUES ('<tu-auth-uid>', 'Hugo Urquiña', 'hugourquina@gmail.com')
--   ON CONFLICT DO NOTHING;
-- =====================================================================
