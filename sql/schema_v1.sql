-- =====================================================================
-- AGENDAS PROFESIONALES SaaS — Schema v1.0
-- Supabase (PostgreSQL 15+) | Multi-tenant con RLS
-- Verticales: psicologo | peluqueria | sso | otro
-- =====================================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================

CREATE TYPE vertical_tipo      AS ENUM ('psicologo', 'peluqueria', 'sso', 'otro');
CREATE TYPE plan_tipo           AS ENUM ('free', 'basico', 'pro', 'enterprise');
CREATE TYPE suscripcion_estado  AS ENUM ('trial', 'activa', 'vencida', 'suspendida', 'cancelada');
CREATE TYPE cita_estado         AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio');
CREATE TYPE dia_semana          AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

-- =====================================================================
-- TABLA 0: SUPERADMINS (tú y quien delegues)
-- =====================================================================

CREATE TABLE superadmins (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- TABLA 1: PLANES
-- =====================================================================

CREATE TABLE planes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,
  tipo                 plan_tipo NOT NULL UNIQUE,
  precio_mes           NUMERIC(10,2) DEFAULT 0,
  max_citas_mes        INT DEFAULT 30,        -- NULL = ilimitado
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
  ('Gratuito',   'free',       0,      30,   1, false, false, false, 'Para probar la plataforma'),
  ('Básico',     'basico',  49000,    150,   2, true,  false, true,  'Consultorio pequeño'),
  ('Pro',        'pro',     99000,    500,   5, true,  true,  true,  'Negocio en crecimiento'),
  ('Enterprise', 'enterprise', 199000, NULL, NULL, true, true, true, 'Sin límites — multi-sede');

-- =====================================================================
-- TABLA 2: TENANTS (cada negocio suscrito)
-- =====================================================================

CREATE TABLE tenants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug             TEXT UNIQUE NOT NULL,     -- URL pública: /agenda/:slug
  nombre           TEXT NOT NULL,
  vertical         vertical_tipo NOT NULL DEFAULT 'otro',

  -- Contacto
  email            TEXT,
  whatsapp         TEXT,
  telefono         TEXT,
  ciudad           TEXT DEFAULT 'Cali',
  direccion        TEXT,

  -- Branding
  logo_url         TEXT,
  color_primario   TEXT DEFAULT '#3b82f6',
  descripcion      TEXT,                    -- bio visible en el portal público

  -- Config específica del vertical (JSONB flexible)
  -- Psicólogo:  {"titulo":"Ps.","especialidad":"neuropsicología","registro_prof":"T-12345"}
  -- Peluquería: {"tipo_salon":"mixto","acepta_walk_in":true}
  -- SSO:        {"empresa_cliente":"XYZ SA","arp":"Positiva"}
  config_vertical  JSONB DEFAULT '{}'::jsonb,

  -- Estado
  activo           BOOLEAN DEFAULT true,
  verificado       BOOLEAN DEFAULT false,   -- tú lo activas manualmente
  owner_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug     ON tenants(slug);
CREATE INDEX idx_tenants_vertical ON tenants(vertical);
CREATE INDEX idx_tenants_owner    ON tenants(owner_id);

-- =====================================================================
-- TABLA 3: SUSCRIPCIONES
-- =====================================================================

CREATE TABLE suscripciones (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES planes(id),
  estado             suscripcion_estado DEFAULT 'trial',

  fecha_inicio       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento  DATE,
  fecha_cancelacion  DATE,

  -- Control de cobro (tu registro manual por ahora)
  monto_cobrado      NUMERIC(10,2),
  metodo_pago        TEXT,                  -- 'nequi','transferencia','efectivo'
  referencia_pago    TEXT,
  notas_pago         TEXT,

  -- Contador de uso del mes actual
  citas_usadas_mes   INT DEFAULT 0,
  mes_referencia     TEXT,                  -- '2026-04' — para resetear el conteo

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suscripciones_tenant      ON suscripciones(tenant_id);
CREATE INDEX idx_suscripciones_vencimiento ON suscripciones(fecha_vencimiento)
  WHERE estado = 'activa';

-- =====================================================================
-- TABLA 4: USUARIOS DEL TENANT (staff: admin, profesional, recepción)
-- =====================================================================

CREATE TABLE usuarios_tenant (
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

CREATE INDEX idx_usuarios_tenant_tenant ON usuarios_tenant(tenant_id);
CREATE INDEX idx_usuarios_tenant_user   ON usuarios_tenant(user_id);

-- =====================================================================
-- TABLA 5: PROFESIONALES (quiénes atienden citas)
-- =====================================================================

CREATE TABLE profesionales (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- null si no tiene login
  nombre        TEXT NOT NULL,
  especialidad  TEXT,
  foto_url      TEXT,
  color         TEXT DEFAULT '#3b82f6',   -- color en el calendario
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profesionales_tenant ON profesionales(tenant_id);

-- =====================================================================
-- TABLA 6: SERVICIOS (catálogo de cada negocio)
-- =====================================================================

CREATE TABLE servicios (
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
  formulario_config    JSONB DEFAULT '[]'::jsonb,  -- preguntas pre-cita
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_servicios_tenant ON servicios(tenant_id);

-- Qué profesional ofrece qué servicio
CREATE TABLE profesional_servicios (
  profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id    UUID REFERENCES servicios(id) ON DELETE CASCADE,
  PRIMARY KEY (profesional_id, servicio_id)
);

-- =====================================================================
-- TABLA 7: HORARIOS (disponibilidad semanal por profesional)
-- =====================================================================

CREATE TABLE horarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id  UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  dia             dia_semana NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  activo          BOOLEAN DEFAULT true,
  UNIQUE (profesional_id, dia)
);

CREATE INDEX idx_horarios_profesional ON horarios(profesional_id);

-- Bloqueos puntuales (vacaciones, festivos, reuniones)
CREATE TABLE bloqueos_agenda (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id  UUID REFERENCES profesionales(id) ON DELETE CASCADE, -- null = todo el negocio
  fecha_inicio    TIMESTAMPTZ NOT NULL,
  fecha_fin       TIMESTAMPTZ NOT NULL,
  motivo          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bloqueos_prof_fecha ON bloqueos_agenda(profesional_id, fecha_inicio);

-- =====================================================================
-- TABLA 8: CLIENTES DE AGENDA (pacientes / clientes del negocio)
-- =====================================================================

CREATE TABLE clientes_agenda (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  email            TEXT,
  telefono         TEXT,
  whatsapp         TEXT,
  fecha_nacimiento DATE,
  notas            TEXT,
  -- Datos específicos del vertical sin columnas extra
  -- Psicólogo:  {"motivo_consulta":"TDAH","eps":"Sura","consentimiento":true}
  -- Peluquería: {"tipo_cabello":"rizado","alergias":"tinte"}
  -- SSO:        {"empresa":"XYZ","cargo":"Operario","examen_tipo":"ingreso"}
  datos_vertical   JSONB DEFAULT '{}'::jsonb,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_tenant ON clientes_agenda(tenant_id);
CREATE INDEX idx_clientes_nombre ON clientes_agenda
  USING gin (to_tsvector('spanish', nombre));

-- =====================================================================
-- TABLA 9: CITAS (la agenda central)
-- =====================================================================

CREATE TABLE citas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id       UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  profesional_id   UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id      UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,

  -- Tiempo
  fecha_inicio     TIMESTAMPTZ NOT NULL,
  fecha_fin        TIMESTAMPTZ NOT NULL,

  -- Estado
  estado           cita_estado DEFAULT 'pendiente',

  -- Automatización
  recordatorio_enviado      BOOLEAN DEFAULT false,
  recordatorio_24h_enviado  BOOLEAN DEFAULT false,
  canal_notificacion        TEXT DEFAULT 'whatsapp', -- 'whatsapp' | 'email' | 'ninguno'

  -- Post-cita
  notas_profesional   TEXT,
  motivo_cancelacion  TEXT,

  -- Formulario pre-cita (si servicio.requiere_formulario = true)
  respuestas_formulario JSONB DEFAULT '{}'::jsonb,

  -- Pago
  precio_cobrado  NUMERIC(10,2),
  pago_estado     TEXT DEFAULT 'pendiente' CHECK (pago_estado IN ('pendiente','pagado','exento')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citas_tenant          ON citas(tenant_id);
CREATE INDEX idx_citas_prof_fecha      ON citas(profesional_id, fecha_inicio);
CREATE INDEX idx_citas_cliente         ON citas(cliente_id);
CREATE INDEX idx_citas_estado          ON citas(estado);
CREATE INDEX idx_citas_fecha           ON citas(fecha_inicio) WHERE estado != 'cancelada';
CREATE INDEX idx_citas_recordatorio    ON citas(fecha_inicio)
  WHERE recordatorio_enviado = false AND estado = 'confirmada';

-- =====================================================================
-- TABLA 10: LOGS DE ACTIVIDAD (métricas para el superadmin)
-- =====================================================================

CREATE TABLE logs_actividad (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  evento     TEXT NOT NULL,               -- 'cita_creada','login','cancelacion',...
  detalle    JSONB DEFAULT '{}'::jsonb,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_tenant_fecha ON logs_actividad(tenant_id, created_at DESC);
CREATE INDEX idx_logs_evento       ON logs_actividad(evento);

-- =====================================================================
-- TABLA 11: WEBHOOKS / AUTOMATIZACIÓN n8n por negocio
-- =====================================================================

CREATE TABLE webhooks_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento          TEXT NOT NULL,           -- 'cita_confirmada','recordatorio_24h','cancelacion'
  url_webhook     TEXT NOT NULL,           -- URL del workflow n8n
  activo          BOOLEAN DEFAULT true,
  ultimo_trigger  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, evento)
);

CREATE INDEX idx_webhooks_tenant ON webhooks_config(tenant_id);

-- =====================================================================
-- TRIGGERS: updated_at automático
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'planes','tenants','suscripciones','profesionales',
    'servicios','clientes_agenda','citas'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()', t
    );
  END LOOP;
END $$;

-- =====================================================================
-- FUNCIONES HELPER (usadas en RLS)
-- =====================================================================

-- ¿El usuario es superadmin?
CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM superadmins WHERE id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- tenant_id del usuario autenticado (su negocio)
CREATE OR REPLACE FUNCTION mi_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM usuarios_tenant
  WHERE user_id = auth.uid() AND activo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================================
-- RLS: ACTIVAR
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
-- POLÍTICAS RLS
-- =====================================================================

-- PLANES: lectura pública, escritura solo superadmin
CREATE POLICY "planes_read"           ON planes FOR SELECT USING (true);
CREATE POLICY "planes_superadmin"     ON planes FOR ALL    USING (es_superadmin());

-- TENANTS
CREATE POLICY "tenants_superadmin"    ON tenants FOR ALL    USING (es_superadmin());
CREATE POLICY "tenants_owner"         ON tenants FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "tenants_usuario"       ON tenants FOR SELECT USING (id = mi_tenant_id());

-- SUSCRIPCIONES
CREATE POLICY "suscr_superadmin"      ON suscripciones FOR ALL    USING (es_superadmin());
CREATE POLICY "suscr_tenant_read"     ON suscripciones FOR SELECT USING (tenant_id = mi_tenant_id());

-- USUARIOS TENANT
CREATE POLICY "ut_superadmin"         ON usuarios_tenant FOR ALL USING (es_superadmin());
CREATE POLICY "ut_propio"             ON usuarios_tenant FOR ALL USING (tenant_id = mi_tenant_id());

-- PROFESIONALES (lectura pública para el portal de citas)
CREATE POLICY "prof_superadmin"       ON profesionales FOR ALL    USING (es_superadmin());
CREATE POLICY "prof_tenant"           ON profesionales FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "prof_public_read"      ON profesionales FOR SELECT USING (activo = true);

-- SERVICIOS (lectura pública para el portal de citas)
CREATE POLICY "serv_superadmin"       ON servicios FOR ALL    USING (es_superadmin());
CREATE POLICY "serv_tenant"           ON servicios FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "serv_public_read"      ON servicios FOR SELECT USING (activo = true);

-- PROFESIONAL_SERVICIOS
CREATE POLICY "ps_superadmin"         ON profesional_servicios FOR ALL USING (es_superadmin());
CREATE POLICY "ps_tenant"             ON profesional_servicios FOR ALL
  USING (profesional_id IN (SELECT id FROM profesionales WHERE tenant_id = mi_tenant_id()));
CREATE POLICY "ps_public_read"        ON profesional_servicios FOR SELECT USING (true);

-- HORARIOS (lectura pública para calcular disponibilidad)
CREATE POLICY "hor_superadmin"        ON horarios FOR ALL    USING (es_superadmin());
CREATE POLICY "hor_tenant"            ON horarios FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "hor_public_read"       ON horarios FOR SELECT USING (activo = true);

-- BLOQUEOS (lectura pública para calcular disponibilidad)
CREATE POLICY "bloq_superadmin"       ON bloqueos_agenda FOR ALL    USING (es_superadmin());
CREATE POLICY "bloq_tenant"           ON bloqueos_agenda FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "bloq_public_read"      ON bloqueos_agenda FOR SELECT USING (true);

-- CLIENTES AGENDA
CREATE POLICY "cli_superadmin"        ON clientes_agenda FOR ALL USING (es_superadmin());
CREATE POLICY "cli_tenant"            ON clientes_agenda FOR ALL USING (tenant_id = mi_tenant_id());

-- CITAS
CREATE POLICY "citas_superadmin"      ON citas FOR ALL    USING (es_superadmin());
CREATE POLICY "citas_tenant"          ON citas FOR ALL    USING (tenant_id = mi_tenant_id());
-- El cliente puede crear su propia cita (portal público) sin estar autenticado
-- Esto se maneja vía service_role en la Edge Function / RPC, no con anon key directa

-- LOGS
CREATE POLICY "logs_superadmin"       ON logs_actividad FOR ALL    USING (es_superadmin());
CREATE POLICY "logs_tenant_read"      ON logs_actividad FOR SELECT USING (tenant_id = mi_tenant_id());
CREATE POLICY "logs_tenant_insert"    ON logs_actividad FOR INSERT WITH CHECK (tenant_id = mi_tenant_id());

-- WEBHOOKS
CREATE POLICY "wh_superadmin"         ON webhooks_config FOR ALL USING (es_superadmin());
CREATE POLICY "wh_tenant"             ON webhooks_config FOR ALL USING (tenant_id = mi_tenant_id());

-- =====================================================================
-- VISTAS SUPERADMIN
-- =====================================================================

CREATE OR REPLACE VIEW v_superadmin_negocios AS
SELECT
  t.id,
  t.nombre,
  t.slug,
  t.vertical,
  t.ciudad,
  t.whatsapp,
  t.activo,
  t.verificado,
  s.estado        AS suscripcion_estado,
  p.tipo          AS plan,
  p.precio_mes,
  s.fecha_vencimiento,
  s.citas_usadas_mes,
  p.max_citas_mes,
  (SELECT COUNT(*) FROM citas c WHERE c.tenant_id = t.id AND c.estado != 'cancelada')            AS total_citas,
  (SELECT COUNT(*) FROM citas c WHERE c.tenant_id = t.id AND c.fecha_inicio >= NOW() - INTERVAL '30 days') AS citas_30d,
  t.created_at    AS registrado_en
FROM tenants t
LEFT JOIN suscripciones s ON s.tenant_id = t.id AND s.estado IN ('activa','trial')
LEFT JOIN planes p ON p.id = s.plan_id
ORDER BY t.created_at DESC;

-- =====================================================================
-- FIN DEL SCHEMA v1.0
-- Siguiente paso: pegar en Supabase Dashboard → SQL Editor → Run
-- Luego insertar tu usuario en superadmins:
--   INSERT INTO superadmins (id, nombre, email)
--   VALUES ('<tu-auth-uid>', 'Hugo Urquiña', 'hugourquina@gmail.com');
-- =====================================================================
