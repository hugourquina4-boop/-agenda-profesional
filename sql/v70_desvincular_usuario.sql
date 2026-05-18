-- v70: RPC para desvincular un usuario de un tenant
-- Solo el admin/superadmin del tenant puede ejecutar esta acción.
-- Verifica que no se pueda auto-desvincular ni eliminar superadmins.

CREATE OR REPLACE FUNCTION desvincular_usuario_tenant(
  p_user_id   UUID,
  p_tenant_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_rol TEXT;
BEGIN
  -- Verificar que el llamante es admin/superadmin activo de este tenant
  SELECT rol INTO v_rol FROM usuarios_tenant
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND activo = true
  LIMIT 1;

  IF v_rol IS NULL OR v_rol NOT IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sin_permiso');
  END IF;

  -- Prevenir auto-desvinculación
  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_auto_desvincular');
  END IF;

  -- Prevenir eliminar superadmins
  IF EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND rol = 'superadmin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_eliminar_superadmin');
  END IF;

  DELETE FROM usuarios_tenant WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION desvincular_usuario_tenant(UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v70: función desvincular_usuario_tenant creada';
END $$;
