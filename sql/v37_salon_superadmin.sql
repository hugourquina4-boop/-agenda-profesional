-- ═══════════════════════════════════════════════════════════════════════════
-- SALÓN PRO — v37: Panel Superadmin con SHA-256 propio
-- Misma arquitectura que POS Restaurante:
--   · admin_config con hash SHA-256 de HFURQUINA12
--   · Brute-force protection
--   · Funciones SECURITY DEFINER (corren como postgres)
--   · Reset contraseñas Supabase Auth desde dentro de la plataforma
--   · Gestión de tenants, planes y suscripciones
--
-- SHA-256('HFURQUINA12') = e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91
--
-- APLICAR EN: Supabase → SQL Editor (una sola vez, es idempotente)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Tabla de configuración admin ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salon_admin_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
ALTER TABLE salon_admin_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sac_deny_all" ON salon_admin_config;
CREATE POLICY "sac_deny_all" ON salon_admin_config FOR ALL USING (false);

-- Hash maestro HFURQUINA12
INSERT INTO salon_admin_config (clave, valor)
VALUES ('admin_pin_hash', 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- ── 2. Tabla brute-force protection ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salon_login_intentos (
  clave           TEXT        PRIMARY KEY,
  intentos        INT         NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE salon_login_intentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sli_deny_all" ON salon_login_intentos;
CREATE POLICY "sli_deny_all" ON salon_login_intentos FOR ALL USING (false);

-- ── 3. salon_verificar_admin — valida token SHA-256 con brute-force ───────────
CREATE OR REPLACE FUNCTION salon_verificar_admin(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  hash_guardado TEXT;
  v_clave       TEXT;
  v_intentos    INT;
  v_bloq_hasta  TIMESTAMPTZ;
BEGIN
  v_clave := LEFT(p_token, 16);

  SELECT intentos, bloqueado_hasta
    INTO v_intentos, v_bloq_hasta
  FROM salon_login_intentos WHERE clave = v_clave;

  IF v_bloq_hasta IS NOT NULL AND now() < v_bloq_hasta THEN
    RAISE EXCEPTION 'Acceso bloqueado temporalmente. Intenta en % minutos.',
      CEIL(EXTRACT(EPOCH FROM (v_bloq_hasta - now())) / 60)::INT;
  END IF;

  SELECT valor INTO hash_guardado FROM salon_admin_config WHERE clave = 'admin_pin_hash';

  IF p_token = hash_guardado THEN
    DELETE FROM salon_login_intentos WHERE clave = v_clave;
    RETURN TRUE;
  ELSE
    v_intentos := COALESCE(v_intentos, 0) + 1;
    INSERT INTO salon_login_intentos (clave, intentos, bloqueado_hasta, updated_at)
    VALUES (v_clave, v_intentos,
      CASE WHEN v_intentos >= 5 THEN now() + INTERVAL '15 minutes' ELSE NULL END,
      now())
    ON CONFLICT (clave) DO UPDATE SET
      intentos        = v_intentos,
      bloqueado_hasta = CASE WHEN v_intentos >= 5 THEN now() + INTERVAL '15 minutes' ELSE NULL END,
      updated_at      = now();
    RETURN FALSE;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION salon_verificar_admin(TEXT) TO anon;

-- ── 4. salon_admin_reset_password — resetea contraseña de cualquier usuario ──
-- Corre como postgres (SECURITY DEFINER) → puede actualizar auth.users
CREATE OR REPLACE FUNCTION salon_admin_reset_password(
  p_token     TEXT,
  p_email     TEXT,
  p_nueva_clave TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = extensions, public, auth AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  IF p_nueva_clave IS NULL OR length(trim(p_nueva_clave)) < 6 THEN
    RETURN '{"ok":false,"error":"clave_minimo_6_caracteres"}'::JSONB;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario_no_encontrado: ' || p_email);
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(trim(p_nueva_clave), gen_salt('bf')),
      updated_at         = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'email', p_email);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_reset_password(TEXT, TEXT, TEXT) TO anon;

-- ── 5. salon_admin_get_tenants — lista todos los tenants con métricas ─────────
CREATE OR REPLACE FUNCTION salon_admin_get_tenants(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',               t.id,
      'nombre',           t.nombre,
      'slug',             t.slug,
      'ciudad',           t.ciudad,
      'vertical',         t.vertical,
      'plan',             t.plan,
      'activo',           t.activo,
      'admin_email',      t.admin_email,
      'admin_clave_temp', t.admin_clave_temp,
      'fecha_vencimiento',t.fecha_vencimiento,
      'color_primario',   t.color_primario,
      'created_at',       t.created_at,
      'total_citas',      (SELECT COUNT(*) FROM citas c WHERE c.tenant_id = t.id),
      'total_clientes',   (SELECT COUNT(*) FROM clientes_agenda ca WHERE ca.tenant_id = t.id),
      'total_profesionales', (SELECT COUNT(*) FROM profesionales p WHERE p.tenant_id = t.id),
      'admin_user_id',    (
        SELECT user_id FROM usuarios_tenant ut
        WHERE ut.tenant_id = t.id AND ut.rol IN ('admin','superadmin') AND ut.activo = true
        LIMIT 1
      ),
      'admin_rol',        (
        SELECT rol FROM usuarios_tenant ut
        WHERE ut.tenant_id = t.id AND ut.activo = true
        ORDER BY (CASE rol WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END)
        LIMIT 1
      )
    ) ORDER BY t.nombre
  ) INTO v_result FROM tenants t;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_get_tenants(TEXT) TO anon;

-- ── 6. salon_admin_set_activo — activar/suspender tenant ─────────────────────
CREATE OR REPLACE FUNCTION salon_admin_set_activo(
  p_token     TEXT,
  p_tenant_id UUID,
  p_activo    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  UPDATE tenants SET activo = p_activo, updated_at = now()
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object('ok', true, 'tenant_id', p_tenant_id, 'activo', p_activo);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_set_activo(TEXT, UUID, BOOLEAN) TO anon;

-- ── 7. salon_admin_set_plan — cambiar plan y fecha vencimiento ────────────────
CREATE OR REPLACE FUNCTION salon_admin_set_plan(
  p_token             TEXT,
  p_tenant_id         UUID,
  p_plan              TEXT,
  p_fecha_vencimiento DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  IF p_plan NOT IN ('starter', 'pro', 'ultra') THEN
    RETURN '{"ok":false,"error":"plan_invalido"}'::JSONB;
  END IF;

  UPDATE tenants
  SET plan              = p_plan,
      fecha_vencimiento = p_fecha_vencimiento,
      updated_at        = now()
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object('ok', true, 'plan', p_plan, 'fecha_vencimiento', p_fecha_vencimiento);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_set_plan(TEXT, UUID, TEXT, DATE) TO anon;

-- ── 8. salon_admin_get_users — lista usuarios con su tenant ──────────────────
CREATE OR REPLACE FUNCTION salon_admin_get_users(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id',     u.id,
      'email',       u.email,
      'created_at',  u.created_at,
      'last_sign_in',u.last_sign_in_at,
      'tenants',     (
        SELECT jsonb_agg(jsonb_build_object(
          'tenant_id', ut.tenant_id,
          'nombre',    t.nombre,
          'rol',       ut.rol,
          'activo',    ut.activo
        ))
        FROM usuarios_tenant ut
        JOIN tenants t ON t.id = ut.tenant_id
        WHERE ut.user_id = u.id
      )
    ) ORDER BY u.created_at DESC
  ) INTO v_result
  FROM auth.users u;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_get_users(TEXT) TO anon;

-- ── Verificación ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '✓ v37 aplicado: panel superadmin SHA-256 listo';
  RAISE NOTICE '  Hash maestro: e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91';
  RAISE NOTICE '  Funciones: salon_verificar_admin, salon_admin_reset_password,';
  RAISE NOTICE '             salon_admin_get_tenants, salon_admin_set_activo,';
  RAISE NOTICE '             salon_admin_set_plan, salon_admin_get_users';
END $$;
