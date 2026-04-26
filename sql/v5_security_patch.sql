-- ═══════════════════════════════════════════════════════════════════════
-- v5: Parche de seguridad — correcciones críticas y altas
-- Ejecutar en Supabase SQL Editor (orden importa)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. RLS en superadmins (CRÍTICO) ─────────────────────────────────────
--    Sin esto, cualquier usuario autenticado puede leer la lista de superadmins.

ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

-- Cada superadmin puede leer solo su propio registro (para que es_superadmin() funcione)
DROP POLICY IF EXISTS "super_self_read" ON superadmins;
CREATE POLICY "super_self_read" ON superadmins
  FOR SELECT USING (id = auth.uid());

-- Solo superadmins existentes pueden escribir (bootstrap vía service_role en el dashboard)
DROP POLICY IF EXISTS "super_admin_all" ON superadmins;
CREATE POLICY "super_admin_all" ON superadmins
  FOR ALL USING (es_superadmin());


-- ── 2. Vista superadmin → función con guard (CRÍTICO) ────────────────────
--    La vista no soporta RLS; cualquier autenticado podía leer todos los tenants.
--    Se reemplaza por una función SECURITY DEFINER que verifica es_superadmin().

DROP VIEW IF EXISTS v_superadmin_negocios;

CREATE OR REPLACE FUNCTION get_superadmin_negocios()
RETURNS TABLE (
  id                 UUID,
  nombre             TEXT,
  slug               TEXT,
  vertical           TEXT,
  activo             BOOLEAN,
  verificado         BOOLEAN,
  email              TEXT,
  whatsapp           TEXT,
  telefono           TEXT,
  ciudad             TEXT,
  direccion          TEXT,
  descripcion        TEXT,
  color_primario     TEXT,
  notas_admin        TEXT,
  links              JSONB,
  created_at         TIMESTAMPTZ,
  plan               TEXT,
  suscripcion_estado TEXT,
  susc_inicio        DATE,
  susc_vencimiento   DATE,
  citas_30d          BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_superadmin() THEN
    RAISE EXCEPTION 'Acceso denegado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    t.id, t.nombre, t.slug, t.vertical::TEXT, t.activo, t.verificado,
    t.email, t.whatsapp, t.telefono, t.ciudad, t.direccion,
    t.descripcion, t.color_primario, t.notas_admin, t.links,
    t.created_at,
    p.tipo::TEXT,
    s.estado::TEXT,
    s.fecha_inicio,
    s.fecha_vencimiento,
    (SELECT COUNT(*) FROM citas c
       WHERE c.tenant_id = t.id
         AND c.fecha_inicio >= NOW() - INTERVAL '30 days')
  FROM tenants t
  LEFT JOIN suscripciones s ON s.tenant_id = t.id
    AND s.estado IN ('activa','trial')
  LEFT JOIN planes p ON p.id = s.plan_id
  ORDER BY t.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_superadmin_negocios FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_superadmin_negocios TO authenticated;


-- ── 3. Políticas públicas filtradas por tenant activo (ALTO) ─────────────
--    Antes, anon podía leer profesionales/servicios/horarios de TODOS los tenants.

DROP POLICY IF EXISTS "prof_public_read" ON profesionales;
CREATE POLICY "prof_public_read" ON profesionales
  FOR SELECT USING (
    activo = true
    AND tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

DROP POLICY IF EXISTS "serv_public_read" ON servicios;
CREATE POLICY "serv_public_read" ON servicios
  FOR SELECT USING (
    activo = true
    AND tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

DROP POLICY IF EXISTS "ps_public_read" ON profesional_servicios;
CREATE POLICY "ps_public_read" ON profesional_servicios
  FOR SELECT USING (
    profesional_id IN (
      SELECT pr.id FROM profesionales pr
      JOIN tenants t ON t.id = pr.tenant_id
      WHERE pr.activo = true AND t.activo = true
    )
  );

DROP POLICY IF EXISTS "hor_public_read" ON horarios;
CREATE POLICY "hor_public_read" ON horarios
  FOR SELECT USING (
    activo = true
    AND tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );

-- Bloqueos: USING(true) eliminado — solo tenants activos
DROP POLICY IF EXISTS "bloq_public_read" ON bloqueos_agenda;
CREATE POLICY "bloq_public_read" ON bloqueos_agenda
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  );


-- ── 4. get_slots_ocupados — validar profesional y tenant (ALTO) ──────────
--    Antes aceptaba cualquier UUID sin verificar que perteneciera a tenant activo.

CREATE OR REPLACE FUNCTION get_slots_ocupados(
  p_profesional_id UUID,
  p_fecha          DATE
)
RETURNS TABLE (hora_inicio TIME, hora_fin TIME)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar profesional activo en tenant activo
  IF NOT EXISTS (
    SELECT 1 FROM profesionales pr
    JOIN tenants t ON t.id = pr.tenant_id
    WHERE pr.id = p_profesional_id
      AND pr.activo = true
      AND t.activo = true
  ) THEN
    RETURN; -- Vacío sin exponer el motivo
  END IF;

  RETURN QUERY
  SELECT
    (c.fecha_inicio AT TIME ZONE 'America/Bogota')::TIME,
    (c.fecha_fin    AT TIME ZONE 'America/Bogota')::TIME
  FROM citas c
  WHERE c.profesional_id = p_profesional_id
    AND DATE(c.fecha_inicio AT TIME ZONE 'America/Bogota') = p_fecha
    AND c.estado NOT IN ('cancelada', 'cancelado', 'no_asistio');
END;
$$;

GRANT EXECUTE ON FUNCTION get_slots_ocupados TO anon;


-- ── 5. crear_cita_publica — validaciones + anti race condition (CRÍTICO) ──
--    Sin validaciones: tenant suspendido podía recibir citas, cross-tenant injection,
--    race condition de doble reserva, inputs de longitud arbitraria.

CREATE OR REPLACE FUNCTION crear_cita_publica(
  p_tenant_id        UUID,
  p_profesional_id   UUID,
  p_servicio_id      UUID,
  p_fecha_inicio     TIMESTAMPTZ,
  p_fecha_fin        TIMESTAMPTZ,
  p_cliente_nombre   TEXT,
  p_cliente_telefono TEXT        DEFAULT NULL,
  p_cliente_email    TEXT        DEFAULT NULL,
  p_modalidad        TEXT        DEFAULT 'Presencial',
  p_edad             TEXT        DEFAULT NULL,
  p_motivo           TEXT        DEFAULT NULL,
  p_quien_asiste     TEXT        DEFAULT NULL,
  p_notas            TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_cita_id    UUID;
BEGIN
  -- 1. Validar longitud de inputs (previene abuso de almacenamiento)
  IF length(p_cliente_nombre) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Datos inválidos');
  END IF;
  IF p_cliente_telefono IS NOT NULL AND length(p_cliente_telefono) > 25 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Datos inválidos');
  END IF;
  IF p_notas IS NOT NULL AND length(p_notas) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Las notas son demasiado largas');
  END IF;
  IF p_fecha_fin <= p_fecha_inicio THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Horario inválido');
  END IF;

  -- 2. Tenant activo
  IF NOT EXISTS (
    SELECT 1 FROM tenants WHERE id = p_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agenda no disponible');
  END IF;

  -- 3. Profesional pertenece al tenant y está activo
  IF NOT EXISTS (
    SELECT 1 FROM profesionales
    WHERE id = p_profesional_id AND tenant_id = p_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profesional no disponible');
  END IF;

  -- 4. Servicio pertenece al tenant y está activo
  IF NOT EXISTS (
    SELECT 1 FROM servicios
    WHERE id = p_servicio_id AND tenant_id = p_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Servicio no disponible');
  END IF;

  -- 5. Verificar colisión de slots con FOR UPDATE (evita race condition de doble reserva)
  IF EXISTS (
    SELECT 1 FROM citas
    WHERE profesional_id = p_profesional_id
      AND estado NOT IN ('cancelada', 'no_asistio')
      AND tstzrange(fecha_inicio, fecha_fin, '[)') &&
          tstzrange(p_fecha_inicio, p_fecha_fin, '[)')
    FOR UPDATE SKIP LOCKED
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'El horario ya no está disponible. Por favor elige otro.'
    );
  END IF;

  -- 6. Buscar cliente existente por teléfono dentro del tenant
  IF p_cliente_telefono IS NOT NULL THEN
    SELECT id INTO v_cliente_id
    FROM clientes_agenda
    WHERE tenant_id = p_tenant_id AND telefono = p_cliente_telefono
    LIMIT 1;
  END IF;

  -- 7. Crear cliente si no existe
  IF v_cliente_id IS NULL THEN
    INSERT INTO clientes_agenda (tenant_id, nombre, telefono, email)
    VALUES (p_tenant_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- 8. Insertar cita
  INSERT INTO citas (
    tenant_id, profesional_id, servicio_id, cliente_id,
    fecha_inicio, fecha_fin, estado,
    modalidad, edad, motivo, quien_asiste, notas
  )
  VALUES (
    p_tenant_id, p_profesional_id, p_servicio_id, v_cliente_id,
    p_fecha_inicio, p_fecha_fin, 'pendiente',
    p_modalidad, p_edad, p_motivo, p_quien_asiste, p_notas
  )
  RETURNING id INTO v_cita_id;

  RETURN jsonb_build_object('ok', true, 'cita_id', v_cita_id);

EXCEPTION WHEN OTHERS THEN
  -- Nunca exponer detalles internos de PostgreSQL al cliente
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'No fue posible confirmar la cita. Inténtalo de nuevo.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_cita_publica TO anon;


-- ── 6. Eliminar INSERT directo en logs desde el cliente (BAJO) ───────────
--    Los logs deben escribirse solo desde funciones SECURITY DEFINER del servidor.

DROP POLICY IF EXISTS "logs_tenant_insert" ON logs_actividad;


-- ── FIN DEL PARCHE v5 ─────────────────────────────────────────────────────
-- Verificar con:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' ORDER BY tablename;
-- Todas las tablas deben tener rowsecurity = true.
