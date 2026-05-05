-- ═══════════════════════════════════════════════════════════════════════
-- v6: Módulo Peluquería / Estética
-- Extiende schema v1 sin romper psicólogo ni SSO.
-- Ejecutar en Supabase SQL Editor (orden importa)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0. Extensiones ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "btree_gist";


-- ── 1. Enriquecimiento de profesionales ──────────────────────────────────
--    tipo_profesional  → filtra columnas en el Monitor del dueño
--    bio               → texto corto visible en el portal público
--    instagram         → enlace de redes del profesional
--    (foto_url ya existe en v1)

ALTER TABLE profesionales
  ADD COLUMN IF NOT EXISTS tipo_profesional TEXT DEFAULT 'estilista'
    CHECK (tipo_profesional IN (
      'estilista','colorista','manicura','pedicura',
      'barbero','esteticista','otro'
    )),
  ADD COLUMN IF NOT EXISTS bio       TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT;


-- ── 2. Enriquecimiento de servicios ─────────────────────────────────────
--    categoria   → agrupa servicios en el portal (Corte, Color, Uñas…)
--    imagen_url  → foto del servicio en el portal
--    (descripcion, duracion_min, precio ya existen en v1)

ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS categoria  TEXT,
  ADD COLUMN IF NOT EXISTS imagen_url TEXT;


-- ── 3. Recursos físicos (sillas, puestos, cabinas) ───────────────────────
--    Opcional por tenant. Si el negocio no los usa, la tabla queda vacía.
--    recurso_id en citas es nullable → compatibilidad con psicólogo/SSO.

CREATE TABLE IF NOT EXISTS recursos_agenda (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,          -- "Silla 1", "Cabina VIP", "Puesto Uñas"
  tipo        TEXT        DEFAULT 'silla',   -- 'silla','cabina','puesto','otro'
  color       TEXT        DEFAULT '#64748b',
  activo      BOOLEAN     DEFAULT true,
  orden       INT         DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recursos_tenant
  ON recursos_agenda(tenant_id) WHERE activo = true;

ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS recurso_id UUID REFERENCES recursos_agenda(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_citas_recurso
  ON citas(recurso_id) WHERE recurso_id IS NOT NULL;


-- ── 4. Variantes de servicio ─────────────────────────────────────────────
--    Ej: "Tinte raíz" vs "Tinte completo" — mismo servicio, precio/tiempo diferente.
--    duracion_modificador y precio_modificador se SUMAN al base del servicio.

CREATE TABLE IF NOT EXISTS variantes_servicio (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  servicio_id          UUID        NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  tenant_id            UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  nombre               TEXT        NOT NULL,
  duracion_modificador INT         DEFAULT 0,       -- minutos adicionales (puede ser negativo)
  precio_modificador   NUMERIC(10,2) DEFAULT 0,     -- precio adicional (puede ser negativo)
  activo               BOOLEAN     DEFAULT true,
  orden                INT         DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_variantes_servicio
  ON variantes_servicio(servicio_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_variantes_tenant
  ON variantes_servicio(tenant_id);


-- ── 5. Servicios de la cita (combos) ────────────────────────────────────
--    Un appointment puede tener varios servicios (corte + tinte + keratina).
--    El dueño los arma desde el panel interno — no el cliente desde el portal.
--    Para citas simples: 1 fila en esta tabla = el mismo servicio_id de citas.

CREATE TABLE IF NOT EXISTS cita_servicios (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  cita_id     UUID          NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  servicio_id UUID          NOT NULL REFERENCES servicios(id),
  variante_id UUID          REFERENCES variantes_servicio(id),
  duracion    INT           NOT NULL,       -- minutos efectivos (base + modificador)
  precio      NUMERIC(10,2) DEFAULT 0,      -- precio efectivo (base + modificador)
  orden       INT           DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cita_servicios_cita
  ON cita_servicios(cita_id);


-- ── 6. Historial técnico por cliente ────────────────────────────────────
--    notas JSONB flexible: fórmula de color, marca, tiempo, alergias, etc.
--    proxima_visita sugiere cuándo llamar al cliente para la próxima cita.

CREATE TABLE IF NOT EXISTS historial_tecnico (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  cliente_id      UUID        NOT NULL REFERENCES clientes_agenda(id) ON DELETE CASCADE,
  cita_id         UUID        REFERENCES citas(id) ON DELETE SET NULL,
  profesional_id  UUID        REFERENCES profesionales(id)           ON DELETE SET NULL,
  notas           JSONB       DEFAULT '{}'::jsonb,
  -- Estructura sugerida de notas:
  -- { "formula_color":"10.1+oxidante 30vol", "marca":"Wella Koleston",
  --   "tiempo_proceso":"35min", "resultado":"excelente",
  --   "alergias":"ninguna", "observaciones":"pelo muy poroso" }
  proxima_visita  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_cliente
  ON historial_tecnico(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_tenant
  ON historial_tecnico(tenant_id);


-- ── 7. EXCLUDE constraints — anti doble-reserva duro ────────────────────
--    Reemplaza la lógica FOR UPDATE SKIP LOCKED de v5.
--    La BD rechaza la inserción a nivel de constraint, sin condición de carrera.

-- 7a. Por profesional (global, todos los verticales)
ALTER TABLE citas DROP CONSTRAINT IF EXISTS no_overlap_profesional;
ALTER TABLE citas ADD CONSTRAINT no_overlap_profesional
  EXCLUDE USING gist (
    profesional_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (estado NOT IN ('cancelada', 'no_asistio'));

-- 7b. Por recurso (solo cuando recurso_id asignado)
ALTER TABLE citas DROP CONSTRAINT IF EXISTS no_overlap_recurso;
ALTER TABLE citas ADD CONSTRAINT no_overlap_recurso
  EXCLUDE USING gist (
    recurso_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (recurso_id IS NOT NULL AND estado NOT IN ('cancelada', 'no_asistio'));


-- ── 8. RLS en tablas nuevas ──────────────────────────────────────────────

ALTER TABLE recursos_agenda    ENABLE ROW LEVEL SECURITY;
ALTER TABLE variantes_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE cita_servicios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_tecnico  ENABLE ROW LEVEL SECURITY;

-- Recursos
DROP POLICY IF EXISTS "rec_superadmin"   ON recursos_agenda;
DROP POLICY IF EXISTS "rec_tenant"       ON recursos_agenda;
DROP POLICY IF EXISTS "rec_public_read"  ON recursos_agenda;

CREATE POLICY "rec_superadmin"   ON recursos_agenda FOR ALL    USING (es_superadmin());
CREATE POLICY "rec_tenant"       ON recursos_agenda FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "rec_public_read"  ON recursos_agenda FOR SELECT USING (
  activo = true
  AND tenant_id IN (SELECT id FROM tenants WHERE activo = true)
);

-- Variantes de servicio
DROP POLICY IF EXISTS "var_superadmin"  ON variantes_servicio;
DROP POLICY IF EXISTS "var_tenant"      ON variantes_servicio;
DROP POLICY IF EXISTS "var_public_read" ON variantes_servicio;

CREATE POLICY "var_superadmin"  ON variantes_servicio FOR ALL    USING (es_superadmin());
CREATE POLICY "var_tenant"      ON variantes_servicio FOR ALL    USING (tenant_id = mi_tenant_id());
CREATE POLICY "var_public_read" ON variantes_servicio FOR SELECT USING (
  activo = true
  AND servicio_id IN (
    SELECT id FROM servicios
    WHERE activo = true
      AND tenant_id IN (SELECT id FROM tenants WHERE activo = true)
  )
);

-- Cita_servicios
DROP POLICY IF EXISTS "cs_superadmin" ON cita_servicios;
DROP POLICY IF EXISTS "cs_tenant"     ON cita_servicios;
DROP POLICY IF EXISTS "cs_anon_read"  ON cita_servicios;

CREATE POLICY "cs_superadmin" ON cita_servicios FOR ALL USING (es_superadmin());
CREATE POLICY "cs_tenant"     ON cita_servicios FOR ALL USING (
  cita_id IN (SELECT id FROM citas WHERE tenant_id = mi_tenant_id())
);

-- Historial técnico
DROP POLICY IF EXISTS "ht_superadmin" ON historial_tecnico;
DROP POLICY IF EXISTS "ht_tenant"     ON historial_tecnico;

CREATE POLICY "ht_superadmin" ON historial_tecnico FOR ALL USING (es_superadmin());
CREATE POLICY "ht_tenant"     ON historial_tecnico FOR ALL USING (tenant_id = mi_tenant_id());


-- ── 9. Función crear_cita_publica actualizada ────────────────────────────
--    Añade p_variante_id.
--    Registra en cita_servicios (siempre, para uniformidad con combos).
--    Elimina FOR UPDATE SKIP LOCKED — el EXCLUDE lo maneja a nivel BD.
--    Captura exclusion_violation (23P01) como "horario no disponible".
--
--    DROP explícito de la firma original de v5 (13 params) para evitar
--    overload ambiguo en el GRANT posterior (ERROR 42725).
DROP FUNCTION IF EXISTS crear_cita_publica(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

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
  p_notas            TEXT        DEFAULT NULL,
  p_variante_id      UUID        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_cita_id    UUID;
  v_duracion   INT;
  v_precio     NUMERIC(10,2);
  v_dur_mod    INT;
  v_prec_mod   NUMERIC(10,2);
BEGIN
  -- ── Validaciones de inputs ──
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

  -- ── Tenant activo ──
  IF NOT EXISTS (
    SELECT 1 FROM tenants WHERE id = p_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agenda no disponible');
  END IF;

  -- ── Profesional activo en el tenant ──
  IF NOT EXISTS (
    SELECT 1 FROM profesionales
    WHERE id = p_profesional_id AND tenant_id = p_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profesional no disponible');
  END IF;

  -- ── Servicio activo en el tenant ──
  IF NOT EXISTS (
    SELECT 1 FROM servicios
    WHERE id = p_servicio_id AND tenant_id = p_tenant_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Servicio no disponible');
  END IF;

  -- ── Variante pertenece al servicio (si aplica) ──
  IF p_variante_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM variantes_servicio
      WHERE id = p_variante_id AND servicio_id = p_servicio_id AND activo = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Variante no disponible');
    END IF;
  END IF;

  -- ── Calcular duración y precio efectivos ──
  SELECT s.duracion_min, s.precio INTO v_duracion, v_precio
  FROM servicios s WHERE s.id = p_servicio_id;

  IF p_variante_id IS NOT NULL THEN
    SELECT COALESCE(duracion_modificador, 0), COALESCE(precio_modificador, 0)
    INTO v_dur_mod, v_prec_mod
    FROM variantes_servicio WHERE id = p_variante_id;
    v_duracion := v_duracion + v_dur_mod;
    v_precio   := v_precio   + v_prec_mod;
  END IF;

  -- ── Buscar o crear cliente ──
  IF p_cliente_telefono IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM clientes_agenda
    WHERE tenant_id = p_tenant_id AND telefono = p_cliente_telefono
    LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO clientes_agenda (tenant_id, nombre, telefono, email)
    VALUES (p_tenant_id, p_cliente_nombre, p_cliente_telefono, p_cliente_email)
    RETURNING id INTO v_cliente_id;
  END IF;

  -- ── Insertar cita ──
  -- El EXCLUDE constraint rechazará automáticamente si hay solapamiento.
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

  -- ── Registrar en cita_servicios ──
  INSERT INTO cita_servicios (cita_id, servicio_id, variante_id, duracion, precio, orden)
  VALUES (v_cita_id, p_servicio_id, p_variante_id, v_duracion, v_precio, 1);

  RETURN jsonb_build_object('ok', true, 'cita_id', v_cita_id);

EXCEPTION
  WHEN sqlstate '23P01' THEN
    -- exclusion_violation → solapamiento de horario
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'El horario ya no está disponible. Por favor elige otro.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'No fue posible confirmar la cita. Inténtalo de nuevo.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_cita_publica TO anon;


-- ── 10. Función crear_cita_interna (panel del dueño — combos) ───────────
--    p_servicios: [{servicio_id, variante_id, duracion, precio}]
--    El dueño arma el combo desde el panel, no el cliente desde el portal.

CREATE OR REPLACE FUNCTION crear_cita_interna(
  p_tenant_id      UUID,
  p_profesional_id UUID,
  p_fecha_inicio   TIMESTAMPTZ,
  p_cliente_id     UUID,            -- ya existe en clientes_agenda
  p_servicios      JSONB,           -- [{servicio_id, variante_id?, duracion, precio}]
  p_recurso_id     UUID DEFAULT NULL,
  p_notas          TEXT DEFAULT NULL,
  p_estado         TEXT DEFAULT 'confirmada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cita_id     UUID;
  v_dur_total   INT := 0;
  v_fecha_fin   TIMESTAMPTZ;
  v_serv        JSONB;
  v_orden       INT := 1;
  v_primer_serv UUID;
BEGIN
  -- Verificar que el llamante pertenece al tenant
  IF mi_tenant_id() IS DISTINCT FROM p_tenant_id AND NOT es_superadmin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acceso denegado');
  END IF;

  IF jsonb_array_length(p_servicios) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Debes agregar al menos un servicio');
  END IF;

  -- Calcular duración total
  FOR v_serv IN SELECT * FROM jsonb_array_elements(p_servicios) LOOP
    v_dur_total := v_dur_total + (v_serv->>'duracion')::INT;
  END LOOP;

  v_fecha_fin   := p_fecha_inicio + (v_dur_total || ' minutes')::INTERVAL;
  v_primer_serv := (p_servicios->0->>'servicio_id')::UUID;

  -- Insertar cita
  INSERT INTO citas (
    tenant_id, profesional_id, servicio_id, cliente_id,
    fecha_inicio, fecha_fin, recurso_id, estado, notas
  )
  VALUES (
    p_tenant_id, p_profesional_id, v_primer_serv, p_cliente_id,
    p_fecha_inicio, v_fecha_fin, p_recurso_id, p_estado, p_notas
  )
  RETURNING id INTO v_cita_id;

  -- Insertar cita_servicios
  FOR v_serv IN SELECT * FROM jsonb_array_elements(p_servicios) LOOP
    INSERT INTO cita_servicios (cita_id, servicio_id, variante_id, duracion, precio, orden)
    VALUES (
      v_cita_id,
      (v_serv->>'servicio_id')::UUID,
      NULLIF(v_serv->>'variante_id', '')::UUID,
      (v_serv->>'duracion')::INT,
      (v_serv->>'precio')::NUMERIC,
      v_orden
    );
    v_orden := v_orden + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cita_id', v_cita_id, 'fecha_fin', v_fecha_fin);

EXCEPTION
  WHEN sqlstate '23P01' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Solapamiento de horario — verifica disponibilidad.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Error al crear la cita: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION crear_cita_interna TO authenticated;


-- ── 11. Función completar_cita (monitor del dueño) ───────────────────────
--    Actualiza estado + crea historial técnico en una transacción.

CREATE OR REPLACE FUNCTION completar_cita(
  p_cita_id         UUID,
  p_notas_tecnicas  JSONB    DEFAULT '{}'::jsonb,
  p_proxima_visita  DATE     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id     UUID;
  v_cliente_id    UUID;
  v_profesional_id UUID;
BEGIN
  -- Verificar acceso
  SELECT tenant_id, cliente_id, profesional_id
  INTO   v_tenant_id, v_cliente_id, v_profesional_id
  FROM   citas
  WHERE  id = p_cita_id AND tenant_id = mi_tenant_id();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cita no encontrada');
  END IF;

  -- Actualizar estado
  UPDATE citas SET estado = 'completada', updated_at = NOW()
  WHERE id = p_cita_id;

  -- Crear historial técnico (siempre, aunque notas estén vacías)
  INSERT INTO historial_tecnico (
    tenant_id, cliente_id, cita_id, profesional_id,
    notas, proxima_visita
  )
  VALUES (
    v_tenant_id, v_cliente_id, p_cita_id, v_profesional_id,
    p_notas_tecnicas, p_proxima_visita
  );

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION completar_cita TO authenticated;


-- ── FIN v6 ────────────────────────────────────────────────────────────────
-- Verificar tablas nuevas:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
--
-- Verificar EXCLUDE constraints:
--   SELECT conname, contype FROM pg_constraint
--   WHERE conrelid = 'citas'::regclass;
