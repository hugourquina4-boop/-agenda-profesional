-- =====================================================================
-- v17 — FASE 1 del plan SaaS Salon Pro
-- Custom Access Token Hook (Postgres) + migración progresiva de mi_tenant_id()
-- y es_superadmin() para preferir JWT claims sobre lookup de tabla.
--
-- Resultado: cada request reduce de 1 query (lookup usuarios_tenant) a 0
-- queries para resolver tenant_id. Backward compatible: sesiones viejas
-- caen al fallback de tabla, así que nadie queda fuera durante la transición.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hook que inyecta claims al JWT en cada login/refresh
--    Lo invoca supabase_auth_admin automáticamente cuando se emite un token
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  v_user_id   uuid;
  v_tenant_id uuid;
  v_rol       text;
  v_is_super  boolean;
BEGIN
  v_user_id := (event ->> 'user_id')::uuid;
  claims    := COALESCE(event -> 'claims', '{}'::jsonb);

  -- 1) ¿Es superadmin?
  SELECT EXISTS (
    SELECT 1 FROM superadmins WHERE id = v_user_id
  ) INTO v_is_super;

  IF v_is_super THEN
    claims := jsonb_set(claims, '{is_superadmin}', 'true'::jsonb);
    claims := jsonb_set(claims, '{rol}',          '"superadmin"'::jsonb);
  ELSE
    -- 2) ¿Pertenece a algún tenant activo?
    SELECT tenant_id, rol
      INTO v_tenant_id, v_rol
    FROM usuarios_tenant
    WHERE user_id = v_user_id
      AND activo  = true
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
      claims := jsonb_set(claims, '{rol}',       to_jsonb(v_rol));
    END IF;
  END IF;

  -- Devolver el evento completo con claims modificados
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Permisos: solo el admin de auth ejecuta el hook; nadie más
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Acceso a las tablas que el hook lee (BYPASSRLS de supabase_auth_admin
-- + SECURITY DEFINER = lectura segura sin tocar políticas existentes)
GRANT USAGE  ON SCHEMA public          TO supabase_auth_admin;
GRANT SELECT ON public.usuarios_tenant TO supabase_auth_admin;
GRANT SELECT ON public.superadmins     TO supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 2. mi_tenant_id() — prefiere JWT, fallback a tabla
--    JWT path: 0 queries. Fallback path: 1 query (igual que antes).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mi_tenant_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Camino rápido: claim del JWT (cero queries)
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    -- Fallback para sesiones emitidas antes de activar el hook
    (SELECT tenant_id FROM usuarios_tenant
       WHERE user_id = auth.uid() AND activo = true
       LIMIT 1)
  );
$$;

-- ---------------------------------------------------------------------
-- 3. es_superadmin() — prefiere JWT, fallback a tabla
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_superadmin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'is_superadmin')::boolean,
    EXISTS (SELECT 1 FROM superadmins WHERE id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- 4. mi_rol() — nuevo helper para policies que segmenten por rol
--    (admin, profesional, recepcion). El front ya usa rol pero
--    en el server faltaba forma rápida de leerlo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mi_rol() RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'rol', ''),
    (SELECT rol FROM usuarios_tenant
       WHERE user_id = auth.uid() AND activo = true
       LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.mi_rol() TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 5. Función de diagnóstico (uso manual en SQL editor para verificar
--    que el hook produce los claims esperados antes de activarlo en Dashboard)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.test_auth_hook(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT custom_access_token_hook(jsonb_build_object(
    'user_id', p_user_id::text,
    'claims',  '{}'::jsonb
  ));
$$;

GRANT EXECUTE ON FUNCTION public.test_auth_hook(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Diagnóstico final
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_funcs INT;
BEGIN
  SELECT COUNT(*) INTO v_funcs
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('custom_access_token_hook','mi_tenant_id','es_superadmin','mi_rol','test_auth_hook');

  IF v_funcs <> 5 THEN
    RAISE EXCEPTION 'v17: faltan funciones (esperadas 5, encontradas %)', v_funcs;
  END IF;

  RAISE NOTICE 'v17 OK — funciones listas. SIGUIENTE PASO MANUAL:';
  RAISE NOTICE '  Dashboard > Authentication > Hooks > Customize Access Token (JWT) Claims';
  RAISE NOTICE '  Type: Postgres | Schema: public | Function: custom_access_token_hook';
  RAISE NOTICE '  Tras activar, hacer logout/login para regenerar JWT con claims.';
END$$;
