-- v43: salon_admin_crear_usuario
-- Crea o actualiza un usuario Supabase Auth + lo vincula al tenant
-- Elimina dependencia de Edge Functions admin-crear-usuario (que da CANNOT GET)
-- Igual mecanismo que salon_admin_reset_password (SECURITY DEFINER, hash verificado)
-- IDEMPOTENTE: si el email ya existe, solo actualiza clave y vincula al tenant
-- APLICAR EN: Supabase → SQL Editor

CREATE OR REPLACE FUNCTION salon_admin_crear_usuario(
  p_token     TEXT,
  p_email     TEXT,
  p_clave     TEXT,
  p_tenant_id UUID,
  p_rol       TEXT DEFAULT 'admin',
  p_nombre    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_nombre  TEXT;
BEGIN
  -- Verificar acceso superadmin
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
  END IF;

  -- Verificar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant_no_existe');
  END IF;

  IF length(trim(p_clave)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clave_minimo_6_caracteres');
  END IF;

  v_nombre := COALESCE(nullif(trim(p_nombre), ''), split_part(trim(p_email), '@', 1));

  -- ¿Ya existe el usuario?
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Crear nuevo usuario en auth.users
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
  ELSE
    -- Usuario existe: actualizar clave y confirmar email
    UPDATE auth.users
    SET encrypted_password  = crypt(trim(p_clave), gen_salt('bf')),
        email_confirmed_at  = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data  = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nombre', v_nombre),
        updated_at          = now()
    WHERE id = v_user_id;
  END IF;

  -- Vincular (o actualizar) en usuarios_tenant
  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  VALUES (v_user_id, p_tenant_id, p_rol, true, v_nombre, lower(trim(p_email)))
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET rol    = p_rol,
        activo = true,
        nombre = v_nombre;

  RETURN jsonb_build_object(
    'ok',        true,
    'user_id',   v_user_id,
    'email',     lower(trim(p_email)),
    'rol',       p_rol,
    'tenant_id', p_tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION salon_admin_crear_usuario(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO anon;

DO $$ BEGIN
  RAISE NOTICE '✓ v43: salon_admin_crear_usuario lista — crea/vincula usuarios sin Edge Functions';
END $$;
