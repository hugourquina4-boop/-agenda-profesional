-- v65: self-service trial para Salón Pro
-- Permite que cualquier negocio se registre sin intervención del superadmin.
-- Crea auth user + tenant + vínculo admin en una sola transacción atómica.
-- SECURITY DEFINER necesario para insertar en auth.users.
-- GRANTed a anon para que usuarios sin sesión puedan registrarse.

CREATE OR REPLACE FUNCTION public.salon_self_service_registrar(
  p_nombre_negocio  TEXT,
  p_slug            TEXT,
  p_email           TEXT,
  p_clave           TEXT,
  p_nombre_owner    TEXT,
  p_vertical        TEXT    DEFAULT 'salon',
  p_ciudad          TEXT    DEFAULT NULL,
  p_telefono        TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
  v_nombre    TEXT;
BEGIN
  -- Validaciones básicas
  IF length(trim(p_clave)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clave_corta');
  END IF;

  IF length(trim(p_slug)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_corto');
  END IF;

  -- Verificar slug único
  IF EXISTS(SELECT 1 FROM tenants WHERE slug = lower(trim(p_slug)) AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_taken');
  END IF;

  -- Verificar email no registrado
  IF EXISTS(SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_taken');
  END IF;

  v_nombre := COALESCE(nullif(trim(p_nombre_owner), ''), split_part(trim(p_email), '@', 1));

  -- Crear usuario en auth.users con email ya confirmado
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

  -- Crear tenant con 14 días de trial
  INSERT INTO tenants (
    nombre, slug, vertical, ciudad, telefono,
    plan, activo, admin_email, nombre_representante,
    fecha_vencimiento, created_at
  ) VALUES (
    trim(p_nombre_negocio),
    lower(trim(p_slug)),
    p_vertical,
    p_ciudad,
    p_telefono,
    'starter',
    true,
    lower(trim(p_email)),
    v_nombre,
    now() + interval '14 days',
    now()
  )
  RETURNING id INTO v_tenant_id;

  -- Vincular usuario como admin del tenant
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

-- Accesible sin sesión (cualquiera puede registrarse)
GRANT EXECUTE ON FUNCTION public.salon_self_service_registrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.salon_self_service_registrar(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v65: salon_self_service_registrar lista — self-service trial 14 días';
END $$;
