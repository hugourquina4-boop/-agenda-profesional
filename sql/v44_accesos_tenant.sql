-- v44: funciones para que el ADMIN del negocio cree y gestione accesos
-- Mismo patrón SECURITY DEFINER que salon_admin_reset_password
-- No requiere Edge Functions ni service_role en frontend
-- APLICAR EN: Supabase → SQL Editor — IDEMPOTENTE

-- ── 1. crear_acceso_tenant ─────────────────────────────────────────────────
-- Crea o actualiza un usuario Supabase Auth y lo vincula al tenant
-- Solo puede llamarlo quien tiene rol admin o superadmin en ese tenant
CREATE OR REPLACE FUNCTION crear_acceso_tenant(
  p_email     TEXT,
  p_clave     TEXT,
  p_tenant_id UUID,
  p_rol       TEXT    DEFAULT 'profesional',
  p_nombre    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_rol TEXT;
  v_user_id    UUID;
  v_nombre     TEXT;
BEGIN
  -- Solo admin/superadmin del tenant pueden crear accesos
  SELECT rol INTO v_caller_rol
  FROM usuarios_tenant
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND activo = true
  LIMIT 1;

  IF v_caller_rol NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'solo_admin_puede_crear_accesos');
  END IF;

  IF length(trim(p_clave)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clave_minimo_6_caracteres');
  END IF;

  v_nombre := COALESCE(nullif(trim(p_nombre), ''), split_part(lower(trim(p_email)), '@', 1));

  -- ¿Ya existe el usuario en auth?
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Crear nuevo usuario
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
    -- Existe: actualizar clave y confirmar
    UPDATE auth.users
    SET encrypted_password  = crypt(trim(p_clave), gen_salt('bf')),
        email_confirmed_at  = COALESCE(email_confirmed_at, now()),
        updated_at          = now()
    WHERE id = v_user_id;
  END IF;

  -- Vincular al tenant (o actualizar si ya estaba)
  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  VALUES (v_user_id, p_tenant_id, p_rol, true, v_nombre, lower(trim(p_email)))
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET rol    = p_rol,
        activo = true,
        nombre = v_nombre;

  RETURN jsonb_build_object(
    'ok',     true,
    'user_id', v_user_id,
    'email',  lower(trim(p_email)),
    'rol',    p_rol
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_acceso_tenant(TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ── 2. resetear_clave_tenant ───────────────────────────────────────────────
-- Admin del negocio puede cambiar la clave de cualquier usuario de su tenant
-- sin necesidad de mandar email — la clave queda visible para que el admin la entregue
CREATE OR REPLACE FUNCTION resetear_clave_tenant(
  p_email     TEXT,
  p_clave     TEXT,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_rol TEXT;
  v_user_id    UUID;
BEGIN
  SELECT rol INTO v_caller_rol
  FROM usuarios_tenant
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND activo = true
  LIMIT 1;

  IF v_caller_rol NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'solo_admin');
  END IF;

  IF length(trim(p_clave)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clave_minimo_6_caracteres');
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario_no_encontrado');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(trim(p_clave), gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at         = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'email', lower(trim(p_email)));
END;
$$;

GRANT EXECUTE ON FUNCTION resetear_clave_tenant(TEXT, TEXT, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v44: crear_acceso_tenant + resetear_clave_tenant listos';
  RAISE NOTICE '  Sin Edge Functions — SECURITY DEFINER directo a auth.users';
END $$;
