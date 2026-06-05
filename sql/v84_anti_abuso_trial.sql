-- v84: anti-abuso en registro, trial 15 días, campos dirección e instagram
-- Actualiza salon_self_service_registrar con nuevas validaciones y campos.

-- Agregar columnas si no existen
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Eliminar versión anterior (8 parámetros) para reemplazarla con la de 10
DROP FUNCTION IF EXISTS public.salon_self_service_registrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);

CREATE OR REPLACE FUNCTION public.salon_self_service_registrar(
  p_nombre_negocio  TEXT,
  p_slug            TEXT,
  p_email           TEXT,
  p_clave           TEXT,
  p_nombre_owner    TEXT,
  p_vertical        TEXT    DEFAULT 'salon',
  p_ciudad          TEXT    DEFAULT NULL,
  p_telefono        TEXT    DEFAULT NULL,
  p_direccion       TEXT    DEFAULT NULL,
  p_instagram       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
  v_nombre    TEXT;
BEGIN
  IF length(trim(p_clave)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clave_corta');
  END IF;
  IF length(trim(p_slug)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_corto');
  END IF;

  -- Slug único
  IF EXISTS(SELECT 1 FROM tenants WHERE slug = lower(trim(p_slug)) AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_taken');
  END IF;

  -- Email único — bloquea re-registro incluso de trials vencidos sin pago
  IF EXISTS(SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_taken');
  END IF;

  -- Anti-abuso: teléfono no puede reutilizarse para otro trial gratuito
  IF p_telefono IS NOT NULL AND trim(p_telefono) <> '' THEN
    IF EXISTS(SELECT 1 FROM tenants WHERE telefono = trim(p_telefono) AND deleted_at IS NULL) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'phone_taken');
    END IF;
  END IF;

  v_nombre := COALESCE(nullif(trim(p_nombre_owner), ''), split_part(trim(p_email), '@', 1));

  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    lower(trim(p_email)),
    crypt(trim(p_clave), gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', v_nombre),
    false, ''
  )
  RETURNING id INTO v_user_id;

  INSERT INTO tenants (
    nombre, slug, vertical, ciudad, telefono, direccion, instagram,
    plan, activo, admin_email, nombre_representante,
    fecha_vencimiento, created_at
  ) VALUES (
    trim(p_nombre_negocio),
    lower(trim(p_slug)),
    p_vertical,
    nullif(trim(coalesce(p_ciudad, '')),    ''),
    nullif(trim(coalesce(p_telefono, '')),  ''),
    nullif(trim(coalesce(p_direccion, '')), ''),
    nullif(trim(coalesce(p_instagram, '')), ''),
    'starter',
    true,
    lower(trim(p_email)),
    v_nombre,
    now() + interval '15 days',
    now()
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO usuarios_tenant (tenant_id, user_id, rol, nombre, email, activo)
  VALUES (v_tenant_id, v_user_id, 'admin', v_nombre, lower(trim(p_email)), true);

  RETURN jsonb_build_object(
    'ok',        true,
    'slug',      lower(trim(p_slug)),
    'tenant_id', v_tenant_id::text,
    'user_id',   v_user_id::text
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown', 'detail', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.salon_self_service_registrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.salon_self_service_registrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v84: trial 15 días · anti-abuso teléfono · campos dirección + instagram';
END $$;
