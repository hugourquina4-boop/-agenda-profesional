-- ═══════════════════════════════════════════════════════════════
-- SALON PRO — Setup completo en un solo archivo
-- Copia todo esto y pégalo en Supabase → SQL Editor → Run
-- Es seguro re-ejecutar cuantas veces quieras
-- ═══════════════════════════════════════════════════════════════

-- ── Extensiones ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMs (seguros si ya existen) ────────────────────────────────
DO $$ BEGIN CREATE TYPE vertical_tipo     AS ENUM ('psicologo','peluqueria','sso','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE plan_tipo         AS ENUM ('free','basico','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE suscripcion_estado AS ENUM ('trial','activa','vencida','suspendida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cita_estado       AS ENUM ('pendiente','confirmada','cancelada','completada','no_asistio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dia_semana        AS ENUM ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tablas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL, tipo plan_tipo NOT NULL UNIQUE,
  precio_mes NUMERIC(10,2) DEFAULT 0, max_citas_mes INT DEFAULT 30,
  max_profesionales INT DEFAULT 1, tiene_recordatorios BOOLEAN DEFAULT false,
  tiene_whatsapp BOOLEAN DEFAULT false, tiene_reportes BOOLEAN DEFAULT false,
  tiene_multisede BOOLEAN DEFAULT false, descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO planes (nombre, tipo, precio_mes, max_citas_mes, max_profesionales,
  tiene_recordatorios, tiene_whatsapp, tiene_reportes, descripcion)
VALUES
  ('Gratuito',   'free',       0,     30,    1, false, false, false, 'Para probar'),
  ('Básico',     'basico',  49000,   150,    2, true,  false, true,  'Consultorio pequeño'),
  ('Pro',        'pro',     99000,   500,    5, true,  true,  true,  'En crecimiento'),
  ('Enterprise', 'enterprise',199000,NULL, NULL, true,  true,  true,  'Sin límites')
ON CONFLICT (tipo) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL,
  vertical vertical_tipo NOT NULL DEFAULT 'otro',
  email TEXT, whatsapp TEXT, telefono TEXT,
  ciudad TEXT DEFAULT 'Cali', direccion TEXT,
  logo_url TEXT, color_primario TEXT DEFAULT '#3b82f6',
  descripcion TEXT, config_vertical JSONB DEFAULT '{}'::jsonb,
  activo BOOLEAN DEFAULT true, verificado BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES planes(id),
  estado suscripcion_estado DEFAULT 'trial',
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE, fecha_cancelacion DATE,
  monto_cobrado NUMERIC(10,2), metodo_pago TEXT,
  referencia_pago TEXT, notas_pago TEXT,
  citas_usadas_mes INT DEFAULT 0, mes_referencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios_tenant (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT DEFAULT 'admin' CHECK (rol IN ('admin','profesional','recepcion')),
  nombre TEXT NOT NULL, email TEXT NOT NULL,
  activo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS profesionales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL, especialidad TEXT,
  telefono TEXT,
  foto_url TEXT, color TEXT DEFAULT '#3b82f6',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas extra peluquería en profesionales
ALTER TABLE profesionales ADD COLUMN IF NOT EXISTS tipo_profesional TEXT DEFAULT 'estilista';
ALTER TABLE profesionales ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profesionales ADD COLUMN IF NOT EXISTS instagram TEXT;

CREATE TABLE IF NOT EXISTS servicios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, descripcion TEXT,
  duracion_min INT NOT NULL DEFAULT 30,
  precio NUMERIC(10,2) DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  activo BOOLEAN DEFAULT true, orden INT DEFAULT 0,
  requiere_formulario BOOLEAN DEFAULT false,
  formulario_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas extra peluquería en servicios
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS imagen_url TEXT;

CREATE TABLE IF NOT EXISTS profesional_servicios (
  profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id    UUID REFERENCES servicios(id)    ON DELETE CASCADE,
  PRIMARY KEY (profesional_id, servicio_id)
);

CREATE TABLE IF NOT EXISTS horarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  dia dia_semana NOT NULL, hora_inicio TIME NOT NULL, hora_fin TIME NOT NULL,
  activo BOOLEAN DEFAULT true, UNIQUE (profesional_id, dia)
);

CREATE TABLE IF NOT EXISTS bloqueos_agenda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  fecha_inicio TIMESTAMPTZ NOT NULL, fecha_fin TIMESTAMPTZ NOT NULL,
  motivo TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes_agenda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, email TEXT, telefono TEXT, whatsapp TEXT,
  fecha_nacimiento DATE, notas TEXT,
  datos_vertical JSONB DEFAULT '{}'::jsonb,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes_agenda ADD COLUMN IF NOT EXISTS puntos_fidelizacion INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS citas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  fecha_inicio TIMESTAMPTZ NOT NULL, fecha_fin TIMESTAMPTZ NOT NULL,
  estado cita_estado DEFAULT 'pendiente',
  recordatorio_enviado BOOLEAN DEFAULT false,
  recordatorio_24h_enviado BOOLEAN DEFAULT false,
  canal_notificacion TEXT DEFAULT 'whatsapp',
  notas_profesional TEXT, motivo_cancelacion TEXT,
  respuestas_formulario JSONB DEFAULT '{}'::jsonb,
  precio_cobrado NUMERIC(10,2),
  pago_estado TEXT DEFAULT 'pendiente' CHECK (pago_estado IN ('pendiente','pagado','exento')),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs_actividad (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  evento TEXT NOT NULL, detalle JSONB DEFAULT '{}'::jsonb,
  ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento TEXT NOT NULL, url_webhook TEXT NOT NULL,
  activo BOOLEAN DEFAULT true, ultimo_trigger TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, evento)
);

-- ── Índices ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_slug        ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_profesionales_tenant ON profesionales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicios_tenant     ON servicios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant      ON clientes_agenda(tenant_id);
CREATE INDEX IF NOT EXISTS idx_citas_tenant         ON citas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_citas_prof_fecha     ON citas(profesional_id, fecha_inicio);

-- ── Trigger updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tenants','profesionales','servicios','clientes_agenda','citas']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = t::regclass
    ) THEN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()', t);
    END IF;
  END LOOP;
END $$;

-- ── Funciones helper ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION es_superadmin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM superadmins WHERE id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION mi_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM usuarios_tenant WHERE user_id = auth.uid() AND activo = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesionales    ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_agenda  ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscripciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_tenant  ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_agenda  ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_actividad   ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesional_servicios ENABLE ROW LEVEL SECURITY;

-- ── Políticas ────────────────────────────────────────────────────
-- Tenants
DROP POLICY IF EXISTS "t_superadmin"   ON tenants;
DROP POLICY IF EXISTS "t_owner"        ON tenants;
DROP POLICY IF EXISTS "t_usuario"      ON tenants;
DROP POLICY IF EXISTS "t_public_read"  ON tenants;
CREATE POLICY "t_superadmin"  ON tenants FOR ALL    USING (es_superadmin());
CREATE POLICY "t_owner"       ON tenants FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "t_usuario"     ON tenants FOR SELECT USING (id = mi_tenant_id());
CREATE POLICY "t_public_read" ON tenants FOR SELECT USING (activo = true);

-- Profesionales
DROP POLICY IF EXISTS "p_superadmin"  ON profesionales;
DROP POLICY IF EXISTS "p_tenant"      ON profesionales;
DROP POLICY IF EXISTS "p_public_read" ON profesionales;
CREATE POLICY "p_superadmin"  ON profesionales FOR ALL    USING (es_superadmin());
CREATE POLICY "p_tenant"      ON profesionales FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "p_public_read" ON profesionales FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));

-- Servicios
DROP POLICY IF EXISTS "s_superadmin"  ON servicios;
DROP POLICY IF EXISTS "s_tenant"      ON servicios;
DROP POLICY IF EXISTS "s_public_read" ON servicios;
CREATE POLICY "s_superadmin"  ON servicios FOR ALL    USING (es_superadmin());
CREATE POLICY "s_tenant"      ON servicios FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "s_public_read" ON servicios FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));

-- Clientes agenda
DROP POLICY IF EXISTS "c_superadmin"  ON clientes_agenda;
DROP POLICY IF EXISTS "c_tenant"      ON clientes_agenda;
DROP POLICY IF EXISTS "c_public_read" ON clientes_agenda;
CREATE POLICY "c_superadmin"  ON clientes_agenda FOR ALL    USING (es_superadmin());
CREATE POLICY "c_tenant"      ON clientes_agenda FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "c_public_read" ON clientes_agenda FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));

-- Citas
DROP POLICY IF EXISTS "ci_superadmin"  ON citas;
DROP POLICY IF EXISTS "ci_tenant"      ON citas;
DROP POLICY IF EXISTS "ci_public_read" ON citas;
CREATE POLICY "ci_superadmin"  ON citas FOR ALL    USING (es_superadmin());
CREATE POLICY "ci_tenant"      ON citas FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "ci_public_read" ON citas FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE activo = true));

-- Planes (públicos)
DROP POLICY IF EXISTS "pl_read"       ON planes;
DROP POLICY IF EXISTS "pl_superadmin" ON planes;
CREATE POLICY "pl_read"       ON planes FOR SELECT USING (true);
CREATE POLICY "pl_superadmin" ON planes FOR ALL    USING (es_superadmin());

-- Resto de tablas (solo tenant/superadmin)
DROP POLICY IF EXISTS "su_sa" ON suscripciones; DROP POLICY IF EXISTS "su_t" ON suscripciones;
CREATE POLICY "su_sa" ON suscripciones FOR ALL USING (es_superadmin());
CREATE POLICY "su_t"  ON suscripciones FOR SELECT USING (tenant_id = mi_tenant_id());

DROP POLICY IF EXISTS "ut_sa" ON usuarios_tenant; DROP POLICY IF EXISTS "ut_t" ON usuarios_tenant;
CREATE POLICY "ut_sa" ON usuarios_tenant FOR ALL USING (es_superadmin());
CREATE POLICY "ut_t"  ON usuarios_tenant FOR ALL USING (tenant_id = mi_tenant_id());

DROP POLICY IF EXISTS "h_sa" ON horarios; DROP POLICY IF EXISTS "h_t" ON horarios; DROP POLICY IF EXISTS "h_pub" ON horarios;
CREATE POLICY "h_sa"  ON horarios FOR ALL    USING (es_superadmin());
CREATE POLICY "h_t"   ON horarios FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "h_pub" ON horarios FOR SELECT USING (activo = true);

DROP POLICY IF EXISTS "b_sa" ON bloqueos_agenda; DROP POLICY IF EXISTS "b_t" ON bloqueos_agenda;
CREATE POLICY "b_sa" ON bloqueos_agenda FOR ALL    USING (es_superadmin());
CREATE POLICY "b_t"  ON bloqueos_agenda FOR ALL    USING (tenant_id = mi_tenant_id());

DROP POLICY IF EXISTS "ps_sa" ON profesional_servicios; DROP POLICY IF EXISTS "ps_t" ON profesional_servicios; DROP POLICY IF EXISTS "ps_pub" ON profesional_servicios;
CREATE POLICY "ps_sa"  ON profesional_servicios FOR ALL    USING (es_superadmin());
CREATE POLICY "ps_t"   ON profesional_servicios FOR ALL    USING (profesional_id IN (SELECT id FROM profesionales WHERE tenant_id = mi_tenant_id()));
CREATE POLICY "ps_pub" ON profesional_servicios FOR SELECT USING (true);

DROP POLICY IF EXISTS "lo_sa" ON logs_actividad; DROP POLICY IF EXISTS "lo_t" ON logs_actividad;
CREATE POLICY "lo_sa" ON logs_actividad FOR ALL    USING (es_superadmin());
CREATE POLICY "lo_t"  ON logs_actividad FOR SELECT USING (tenant_id = mi_tenant_id());

DROP POLICY IF EXISTS "w_sa" ON webhooks_config; DROP POLICY IF EXISTS "w_t" ON webhooks_config;
CREATE POLICY "w_sa" ON webhooks_config FOR ALL USING (es_superadmin());
CREATE POLICY "w_t"  ON webhooks_config FOR ALL USING (tenant_id = mi_tenant_id());

-- ── GRANTs para rol anon (necesario para el panel sin login) ─────
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON tenants         TO anon;
GRANT SELECT ON profesionales   TO anon;
GRANT SELECT ON servicios       TO anon;
GRANT SELECT ON clientes_agenda TO anon;
GRANT SELECT ON citas           TO anon;
GRANT SELECT ON horarios        TO anon;
GRANT SELECT ON bloqueos_agenda TO anon;
GRANT SELECT ON planes          TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── Datos demo: Glamour Studio ───────────────────────────────────
INSERT INTO tenants (slug, nombre, vertical, color_primario, activo, verificado,
                     email, whatsapp, ciudad, config_vertical)
VALUES ('glamour-studio', 'Glamour Studio', 'peluqueria', '#f43f5e',
        true, true, 'glamour@ejemplo.co', '3001234567', 'Cali',
        '{"tipo_salon":"mixto","acepta_walk_in":true}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre, color_primario = EXCLUDED.color_primario, activo = true;

DO $$
DECLARE
  v_tid UUID;
  v_p1 UUID; v_p2 UUID; v_p3 UUID;
  v_s1 UUID; v_s2 UUID; v_s3 UUID; v_s4 UUID; v_s5 UUID;
  v_c1 UUID; v_c2 UUID; v_c3 UUID; v_c4 UUID; v_c5 UUID;
  v_hoy DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO v_tid FROM tenants WHERE slug = 'glamour-studio';

  -- Borrar datos anteriores del seed para que sea re-ejecutable
  DELETE FROM citas         WHERE tenant_id = v_tid;
  DELETE FROM clientes_agenda WHERE tenant_id = v_tid;
  DELETE FROM servicios     WHERE tenant_id = v_tid;
  DELETE FROM profesionales WHERE tenant_id = v_tid;

  -- Profesionales
  INSERT INTO profesionales (tenant_id, nombre, especialidad, telefono, activo)
  VALUES (v_tid, 'Valentina Cruz',  'Colorista & Estilista',  '3001111111', true) RETURNING id INTO v_p1;
  INSERT INTO profesionales (tenant_id, nombre, especialidad, telefono, activo)
  VALUES (v_tid, 'Carlos Herrera',  'Barbero & Estilista',    '3002222222', true) RETURNING id INTO v_p2;
  INSERT INTO profesionales (tenant_id, nombre, especialidad, telefono, activo)
  VALUES (v_tid, 'Isabella Torres', 'Manicurista & Nail Art', '3003333333', true) RETURNING id INTO v_p3;

  -- Servicios
  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Corte y secado',      'Cortes',       55000, 45,  true) RETURNING id INTO v_s1;
  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Mechas + Tinte',      'Color',       180000, 120, true) RETURNING id INTO v_s2;
  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Tratamiento keratina','Tratamientos',220000, 90,  true) RETURNING id INTO v_s3;
  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Manicure gel',        'Uñas',         60000, 60,  true) RETURNING id INTO v_s4;
  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Peinado para evento', 'Peinados',     90000, 60,  true) RETURNING id INTO v_s5;

  -- Clientes
  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Andrea Martínez', '3001234567', true) RETURNING id INTO v_c1;
  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Sofía Ramírez',   '3109876543', true) RETURNING id INTO v_c2;
  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'María González',  '3156789012', true) RETURNING id INTO v_c3;
  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Laura Jiménez',   '3187654321', true) RETURNING id INTO v_c4;
  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Camila Vargas',   '3214567890', true) RETURNING id INTO v_c5;

  -- Citas de hoy
  INSERT INTO citas (tenant_id, cliente_id, profesional_id, servicio_id, fecha_inicio, fecha_fin, estado)
  VALUES
    (v_tid, v_c1, v_p1, v_s2, (v_hoy||'T09:00:00-05')::timestamptz, (v_hoy||'T11:00:00-05')::timestamptz, 'completada'),
    (v_tid, v_c2, v_p2, v_s1, (v_hoy||'T10:30:00-05')::timestamptz, (v_hoy||'T11:15:00-05')::timestamptz, 'completada'),
    (v_tid, v_c3, v_p1, v_s3, (v_hoy||'T11:30:00-05')::timestamptz, (v_hoy||'T13:00:00-05')::timestamptz, 'confirmada'),
    (v_tid, v_c4, v_p3, v_s4, (v_hoy||'T14:00:00-05')::timestamptz, (v_hoy||'T15:00:00-05')::timestamptz, 'confirmada'),
    (v_tid, v_c5, v_p2, v_s5, (v_hoy||'T16:00:00-05')::timestamptz, (v_hoy||'T17:00:00-05')::timestamptz, 'pendiente');

  RAISE NOTICE 'Setup completo. Tenant: % → ID: %', 'glamour-studio', v_tid;
END $$;

-- ═══ Verificar: debe retornar el tenant ══════════════════════════
SELECT id, slug, nombre, color_primario FROM tenants WHERE slug = 'glamour-studio';
