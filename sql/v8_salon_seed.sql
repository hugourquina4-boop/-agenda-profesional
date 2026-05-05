-- ═══════════════════════════════════════════════════════════════
-- v8: Datos demo para Salón Pro (Glamour Studio)
-- Ejecutar SEGUNDO en Supabase SQL Editor (después de v7)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tenant ────────────────────────────────────────────────────
INSERT INTO tenants (slug, nombre, vertical, color_primario, activo, verificado,
                     email, whatsapp, ciudad, config_vertical)
VALUES (
  'glamour-studio',
  'Glamour Studio',
  'peluqueria',
  '#f43f5e',
  true,
  true,
  'glamour@ejemplo.co',
  '3001234567',
  'Cali',
  '{"tipo_salon":"mixto","acepta_walk_in":true}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  nombre         = EXCLUDED.nombre,
  color_primario = EXCLUDED.color_primario,
  activo         = true;

-- Guardar el ID para usarlo abajo
DO $$
DECLARE
  v_tid   UUID;
  v_p1    UUID;
  v_p2    UUID;
  v_p3    UUID;
  v_s1    UUID;
  v_s2    UUID;
  v_s3    UUID;
  v_s4    UUID;
  v_s5    UUID;
  v_c1    UUID;
  v_c2    UUID;
  v_c3    UUID;
  v_c4    UUID;
  v_c5    UUID;
  v_hoy   DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO v_tid FROM tenants WHERE slug = 'glamour-studio';

  -- ── 2. Profesionales ──────────────────────────────────────────
  INSERT INTO profesionales (tenant_id, nombre, especialidad, telefono, activo)
  VALUES (v_tid, 'Valentina Cruz',   'Colorista & Estilista',  '3001111111', true)
  RETURNING id INTO v_p1;

  INSERT INTO profesionales (tenant_id, nombre, especialidad, telefono, activo)
  VALUES (v_tid, 'Carlos Herrera',   'Barbero & Estilista',    '3002222222', true)
  RETURNING id INTO v_p2;

  INSERT INTO profesionales (tenant_id, nombre, especialidad, telefono, activo)
  VALUES (v_tid, 'Isabella Torres',  'Manicurista & Nail Art', '3003333333', true)
  RETURNING id INTO v_p3;

  -- ── 3. Servicios ──────────────────────────────────────────────
  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Corte y secado',       'Cortes',        55000,  45,  true)
  RETURNING id INTO v_s1;

  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Mechas + Tinte',        'Color',        180000, 120, true)
  RETURNING id INTO v_s2;

  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Tratamiento keratina',  'Tratamientos', 220000, 90,  true)
  RETURNING id INTO v_s3;

  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Manicure gel',          'Uñas',          60000, 60,  true)
  RETURNING id INTO v_s4;

  INSERT INTO servicios (tenant_id, nombre, categoria, precio, duracion_min, activo)
  VALUES (v_tid, 'Peinado para evento',   'Peinados',      90000, 60,  true)
  RETURNING id INTO v_s5;

  -- ── 4. Clientes ───────────────────────────────────────────────
  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Andrea Martínez', '3001234567', true)
  RETURNING id INTO v_c1;

  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Sofía Ramírez', '3109876543', true)
  RETURNING id INTO v_c2;

  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'María González', '3156789012', true)
  RETURNING id INTO v_c3;

  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Laura Jiménez', '3187654321', true)
  RETURNING id INTO v_c4;

  INSERT INTO clientes_agenda (tenant_id, nombre, telefono, activo)
  VALUES (v_tid, 'Camila Vargas', '3214567890', true)
  RETURNING id INTO v_c5;

  -- ── 5. Citas de hoy ───────────────────────────────────────────
  INSERT INTO citas (tenant_id, cliente_id, profesional_id, servicio_id,
                     fecha_inicio, fecha_fin, estado)
  VALUES
    (v_tid, v_c1, v_p1, v_s2,
     (v_hoy || 'T09:00:00-05:00')::timestamptz,
     (v_hoy || 'T11:00:00-05:00')::timestamptz, 'completada'),

    (v_tid, v_c2, v_p2, v_s1,
     (v_hoy || 'T10:30:00-05:00')::timestamptz,
     (v_hoy || 'T11:15:00-05:00')::timestamptz, 'completada'),

    (v_tid, v_c3, v_p1, v_s3,
     (v_hoy || 'T11:30:00-05:00')::timestamptz,
     (v_hoy || 'T13:00:00-05:00')::timestamptz, 'confirmada'),

    (v_tid, v_c4, v_p3, v_s4,
     (v_hoy || 'T14:00:00-05:00')::timestamptz,
     (v_hoy || 'T15:00:00-05:00')::timestamptz, 'confirmada'),

    (v_tid, v_c5, v_p2, v_s5,
     (v_hoy || 'T16:00:00-05:00')::timestamptz,
     (v_hoy || 'T17:00:00-05:00')::timestamptz, 'pendiente');

  RAISE NOTICE 'Seed completado. Tenant ID: %', v_tid;
END $$;

-- ═══ Para ver el ID del tenant (lo necesitas para el bypass de dev) ════
-- SELECT id, slug, nombre FROM tenants WHERE slug = 'glamour-studio';
