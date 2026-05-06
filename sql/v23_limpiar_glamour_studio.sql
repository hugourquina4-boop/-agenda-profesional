-- Limpia TODOS los datos de prueba del tenant glamour-studio
-- Ejecutar en Supabase SQL Editor una sola vez

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'glamour-studio';
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant glamour-studio no encontrado';
    RETURN;
  END IF;

  -- Dependencias primero
  DELETE FROM lista_espera  WHERE tenant_id = v_tenant_id;
  DELETE FROM saldo_puntos  WHERE tenant_id = v_tenant_id;
  DELETE FROM citas         WHERE tenant_id = v_tenant_id;
  DELETE FROM horarios      WHERE tenant_id = v_tenant_id;

  -- Entidades principales
  DELETE FROM profesionales   WHERE tenant_id = v_tenant_id;
  DELETE FROM clientes_agenda WHERE tenant_id = v_tenant_id;

  RAISE NOTICE 'Glamour Studio limpiado. tenant_id: %', v_tenant_id;
END $$;
