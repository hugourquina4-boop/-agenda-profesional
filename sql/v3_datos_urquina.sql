-- ═══════════════════════════════════════════════════════════════
-- v3: Cargar datos reales — Dr. Hugo Urquina Neuropsicología
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tenant_id UUID;
  v_prof_id   UUID;
  v_svc1 UUID; v_svc2 UUID; v_svc3 UUID;
  v_svc4 UUID; v_svc5 UUID; v_svc6 UUID;
BEGIN
  -- Obtener tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'consultorio-neuropsicologia';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado. Verifica el slug en la tabla tenants.';
  END IF;

  -- Actualizar datos del consultorio
  UPDATE tenants SET
    nombre          = 'Neuropsicología Dr. Hugo Urquina',
    vertical        = 'psicologo',
    color_primario  = '#0f172a',
    descripcion     = 'Evaluaciones neuropsicológicas y psicología clínica especializada en Cali',
    direccion       = 'Cl 9 C #49-45, Cali, Valle del Cauca',
    whatsapp        = '3028480238'
  WHERE id = v_tenant_id;

  -- Insertar profesional
  INSERT INTO profesionales (tenant_id, nombre, especialidad, color, activo)
  VALUES (v_tenant_id, 'Dr. Hugo Urquina', 'Neuropsicólogo Clínico', '#0d9488', true)
  RETURNING id INTO v_prof_id;

  -- Insertar 6 servicios
  INSERT INTO servicios (tenant_id, nombre, descripcion, duracion_min, precio, activo)
  VALUES (v_tenant_id,
    'Evaluación Neuropsicológica Adultos',
    'Valoración cognitiva: memoria, atención, funciones ejecutivas y lenguaje',
    120, 0, true)
  RETURNING id INTO v_svc1;

  INSERT INTO servicios (tenant_id, nombre, descripcion, duracion_min, precio, activo)
  VALUES (v_tenant_id,
    'Evaluación Neuropsicológica Niños',
    'Desarrollo cognitivo, aprendizaje, TDAH, autismo y neurodesarrollo',
    120, 0, true)
  RETURNING id INTO v_svc2;

  INSERT INTO servicios (tenant_id, nombre, descripcion, duracion_min, precio, activo)
  VALUES (v_tenant_id,
    'Consulta Psicológica',
    'Ansiedad, depresión, duelo, crisis emocionales y acompañamiento clínico',
    60, 0, true)
  RETURNING id INTO v_svc3;

  INSERT INTO servicios (tenant_id, nombre, descripcion, duracion_min, precio, activo)
  VALUES (v_tenant_id,
    'Seguimiento / Control',
    'Revisión de evolución y ajuste de estrategias terapéuticas',
    60, 0, true)
  RETURNING id INTO v_svc4;

  INSERT INTO servicios (tenant_id, nombre, descripcion, duracion_min, precio, activo)
  VALUES (v_tenant_id,
    'Orientación a Familia',
    'Guía y acompañamiento a familias de pacientes neurológicos',
    60, 0, true)
  RETURNING id INTO v_svc5;

  INSERT INTO servicios (tenant_id, nombre, descripcion, duracion_min, precio, activo)
  VALUES (v_tenant_id,
    'Evaluación Laboral / Pericial',
    'Riesgo laboral, incapacidades cognitivas, daño cerebral',
    120, 0, true)
  RETURNING id INTO v_svc6;

  -- Asignar todos los servicios al profesional
  INSERT INTO profesional_servicios (profesional_id, servicio_id) VALUES
    (v_prof_id, v_svc1), (v_prof_id, v_svc2), (v_prof_id, v_svc3),
    (v_prof_id, v_svc4), (v_prof_id, v_svc5), (v_prof_id, v_svc6);

  -- Horarios: Lunes a Viernes 8am - 6pm
  INSERT INTO horarios (tenant_id, profesional_id, dia, hora_inicio, hora_fin, activo) VALUES
    (v_tenant_id, v_prof_id, 'lunes',     '08:00', '18:00', true),
    (v_tenant_id, v_prof_id, 'martes',    '08:00', '18:00', true),
    (v_tenant_id, v_prof_id, 'miercoles', '08:00', '18:00', true),
    (v_tenant_id, v_prof_id, 'jueves',    '08:00', '18:00', true),
    (v_tenant_id, v_prof_id, 'viernes',   '08:00', '18:00', true);

  RAISE NOTICE 'OK — Profesional, servicios y horarios cargados para tenant %', v_tenant_id;
END $$;
