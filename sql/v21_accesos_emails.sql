-- =====================================================================
-- v21 — Función para leer emails de usuarios del tenant
-- auth.users no es accesible con anon key; SECURITY DEFINER lo resuelve.
-- Solo devuelve emails del propio tenant (o todo si es superadmin).
-- =====================================================================

CREATE OR REPLACE FUNCTION get_usuarios_email_tenant(p_tenant_id uuid)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Solo el admin del tenant o el superadmin puede ver esto
  IF p_tenant_id IS DISTINCT FROM mi_tenant_id() AND NOT es_superadmin() THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT ut.user_id, au.email::text
    FROM public.usuarios_tenant ut
    JOIN auth.users au ON au.id = ut.user_id
    WHERE ut.tenant_id = p_tenant_id;
END;
$$;

REVOKE ALL  ON FUNCTION get_usuarios_email_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_usuarios_email_tenant(uuid) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'v21 OK — función get_usuarios_email_tenant lista';
END$$;
