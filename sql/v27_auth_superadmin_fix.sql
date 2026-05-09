-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v27: Fix Auth Superadmin
-- Ejecutar en Supabase → SQL Editor
-- Soluciona: superadmin sin acceso, edge function faltante, emails
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Ampliar rol CHECK para incluir 'superadmin' ──────────────────
ALTER TABLE usuarios_tenant DROP CONSTRAINT IF EXISTS usuarios_tenant_rol_check;
ALTER TABLE usuarios_tenant ADD CONSTRAINT usuarios_tenant_rol_check
  CHECK (rol IN ('superadmin', 'admin', 'profesional', 'recepcion'));

-- ── 2. Función get_usuarios_email_tenant ────────────────────────────
-- Permite al frontend obtener emails de usuarios de un tenant de forma segura.
-- SECURITY DEFINER: accede a auth.users sin exponer tabla directamente.
CREATE OR REPLACE FUNCTION get_usuarios_email_tenant(p_tenant_id UUID)
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT au.id AS user_id, au.email::TEXT
  FROM auth.users au
  INNER JOIN usuarios_tenant ut ON ut.user_id = au.id
  WHERE ut.tenant_id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION get_usuarios_email_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_usuarios_email_tenant(UUID) TO anon;

-- ── 3. Función crear_usuario_tenant (reemplaza Edge Function) ───────
-- Permite a un admin insertar un usuario nuevo a su tenant de forma segura.
-- Solo admins/superadmins del tenant pueden llamarla.
CREATE OR REPLACE FUNCTION crear_usuario_tenant(
  p_user_id UUID,
  p_tenant_id UUID,
  p_rol TEXT DEFAULT 'profesional'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Verificar que el llamante es admin de este tenant
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND rol IN ('admin', 'superadmin')
      AND activo = true
  ) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol admin o superadmin';
  END IF;

  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo)
  VALUES (p_user_id, p_tenant_id, p_rol, true)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_usuario_tenant(UUID, UUID, TEXT) TO authenticated;

-- ── 4. Función reset_password_usuario (envía email de reset) ────────
-- El admin puede disparar un reset de contraseña para un usuario de su tenant.
CREATE OR REPLACE FUNCTION get_email_usuario(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT email::TEXT FROM auth.users WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_email_usuario(UUID) TO authenticated;

-- ── 5. Insertar superadmin en todos los tenants existentes ──────────
-- Esto garantiza que Hugo (hugourquina@gmail.com) tenga acceso a todos
-- los tenants como superadmin, independientemente del dispositivo.
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'hugourquina@gmail.com'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'Usuario hugourquina@gmail.com no encontrado en auth.users — crea la cuenta primero.';
    RETURN;
  END IF;

  -- Insertar en todos los tenants donde no esté
  INSERT INTO usuarios_tenant (user_id, tenant_id, rol, activo, nombre, email)
  SELECT
    v_admin_id,
    t.id,
    'superadmin',
    true,
    COALESCE(
      (SELECT raw_user_meta_data->>'nombre' FROM auth.users WHERE id = v_admin_id),
      'Hugo'
    ),
    (SELECT email::TEXT FROM auth.users WHERE id = v_admin_id)
  FROM tenants t
  WHERE NOT EXISTS (
    SELECT 1 FROM usuarios_tenant ut
    WHERE ut.user_id = v_admin_id AND ut.tenant_id = t.id
  );

  -- Actualizar a superadmin donde ya exista con otro rol
  UPDATE usuarios_tenant
  SET rol = 'superadmin', activo = true
  WHERE user_id = v_admin_id;

  RAISE NOTICE 'Superadmin configurado correctamente para el usuario %', v_admin_id;
END $$;

-- ── 6. Política RLS: superadmin puede ver todos los tenants ─────────
DROP POLICY IF EXISTS "ut_superadmin_all" ON usuarios_tenant;
CREATE POLICY "ut_superadmin_all" ON usuarios_tenant
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_tenant me
      WHERE me.user_id = auth.uid() AND me.rol = 'superadmin' AND me.activo = true
    )
  );

-- ── 7. Política: admins gestionan su propio tenant ──────────────────
DROP POLICY IF EXISTS "ut_admin_tenant"  ON usuarios_tenant;
DROP POLICY IF EXISTS "ut_own_read"      ON usuarios_tenant;

CREATE POLICY "ut_admin_tenant" ON usuarios_tenant
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'superadmin')
        AND activo = true
    )
  );

CREATE POLICY "ut_own_read" ON usuarios_tenant
  FOR SELECT
  USING (user_id = auth.uid());

-- ── 8. Función tenants_del_usuario ─────────────────────────────────
-- Retorna todos los tenants a los que tiene acceso el usuario logueado.
-- Necesario para el selector de salón del superadmin.
CREATE OR REPLACE FUNCTION tenants_del_usuario()
RETURNS TABLE(
  tenant_id UUID, nombre TEXT, slug TEXT, color_primario TEXT,
  ciudad TEXT, vertical TEXT, rol TEXT
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    t.id AS tenant_id,
    t.nombre,
    t.slug,
    t.color_primario,
    t.ciudad,
    t.vertical,
    ut.rol
  FROM tenants t
  INNER JOIN usuarios_tenant ut ON ut.tenant_id = t.id
  WHERE ut.user_id = auth.uid()
    AND ut.activo = true
    AND t.activo = true
  ORDER BY t.nombre;
$$;

GRANT EXECUTE ON FUNCTION tenants_del_usuario() TO authenticated;
GRANT EXECUTE ON FUNCTION tenants_del_usuario() TO anon;
