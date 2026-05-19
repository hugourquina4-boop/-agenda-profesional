-- ═══════════════════════════════════════════════════════════════════════
-- SALÓN PRO — v38: Control de acceso por rol dentro del tenant
--
-- El admin de cada negocio configura qué módulos ve cada rol:
--   contable / recepcion / profesional
--   (admin y superadmin siempre tienen acceso total — no se almacenan)
--
-- Permisos por defecto:
--   contable    → hoy, caja, comisiones, inventario, analytics
--   recepcion   → hoy, agenda, clientes, servicios, ordenes
--   profesional → hoy, agenda, clientes, servicios, ordenes
--
-- APLICAR EN: Supabase → SQL Editor (idempotente — puede re-ejecutarse)
-- DEPENDENCIAS: v36_eliminar_dev_policies debe aplicarse primero
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Tabla ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permisos_tenant (
  tenant_id UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rol       TEXT    NOT NULL CHECK (rol IN ('contable','recepcion','profesional')),
  modulo    TEXT    NOT NULL,
  activo    BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, rol, modulo)
);

ALTER TABLE permisos_tenant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_sel" ON permisos_tenant;
CREATE POLICY "pt_sel" ON permisos_tenant FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

-- ── 2. salon_seed_permisos — semilla de permisos por defecto ──────────
CREATE OR REPLACE FUNCTION salon_seed_permisos(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO permisos_tenant (tenant_id, rol, modulo, activo) VALUES
    -- contable: finanzas sí, agenda/clientes/equipo no
    (p_tenant_id,'contable','hoy',        true),
    (p_tenant_id,'contable','agenda',     false),
    (p_tenant_id,'contable','clientes',   false),
    (p_tenant_id,'contable','servicios',  false),
    (p_tenant_id,'contable','ordenes',    false),
    (p_tenant_id,'contable','caja',       true),
    (p_tenant_id,'contable','comisiones', true),
    (p_tenant_id,'contable','inventario', true),
    (p_tenant_id,'contable','analytics',  true),
    (p_tenant_id,'contable','equipo',     false),
    (p_tenant_id,'contable','accesos',    false),
    (p_tenant_id,'contable','config',     false),
    -- recepcion: agenda/clientes sí, finanzas no
    (p_tenant_id,'recepcion','hoy',        true),
    (p_tenant_id,'recepcion','agenda',     true),
    (p_tenant_id,'recepcion','clientes',   true),
    (p_tenant_id,'recepcion','servicios',  true),
    (p_tenant_id,'recepcion','ordenes',    true),
    (p_tenant_id,'recepcion','caja',       false),
    (p_tenant_id,'recepcion','comisiones', false),
    (p_tenant_id,'recepcion','inventario', false),
    (p_tenant_id,'recepcion','analytics',  false),
    (p_tenant_id,'recepcion','equipo',     false),
    (p_tenant_id,'recepcion','accesos',    false),
    (p_tenant_id,'recepcion','config',     false),
    -- profesional: igual que recepcion
    (p_tenant_id,'profesional','hoy',        true),
    (p_tenant_id,'profesional','agenda',     true),
    (p_tenant_id,'profesional','clientes',   true),
    (p_tenant_id,'profesional','servicios',  true),
    (p_tenant_id,'profesional','ordenes',    true),
    (p_tenant_id,'profesional','caja',       false),
    (p_tenant_id,'profesional','comisiones', false),
    (p_tenant_id,'profesional','inventario', false),
    (p_tenant_id,'profesional','analytics',  false),
    (p_tenant_id,'profesional','equipo',     false),
    (p_tenant_id,'profesional','accesos',    false),
    (p_tenant_id,'profesional','config',     false)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── 3. get_permisos_tenant — lee permisos (seed automático si vacío) ──
-- Retorna: { "contable": { "hoy": true, ... }, "recepcion": {...}, "profesional": {...} }
CREATE OR REPLACE FUNCTION get_permisos_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_count  INT;
  v_result JSONB;
BEGIN
  -- El llamante debe pertenecer al tenant
  IF NOT EXISTS (
    SELECT 1 FROM usuarios_tenant
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND activo = true
  ) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  -- Seed si nunca se han definido permisos para este tenant
  SELECT COUNT(*) INTO v_count FROM permisos_tenant WHERE tenant_id = p_tenant_id;
  IF v_count = 0 THEN
    PERFORM salon_seed_permisos(p_tenant_id);
  END IF;

  SELECT jsonb_build_object(
    'contable',    COALESCE(jsonb_object_agg(modulo, activo) FILTER (WHERE rol = 'contable'),    '{}'::JSONB),
    'recepcion',   COALESCE(jsonb_object_agg(modulo, activo) FILTER (WHERE rol = 'recepcion'),   '{}'::JSONB),
    'profesional', COALESCE(jsonb_object_agg(modulo, activo) FILTER (WHERE rol = 'profesional'), '{}'::JSONB)
  ) INTO v_result
  FROM permisos_tenant WHERE tenant_id = p_tenant_id;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION get_permisos_tenant(UUID) TO authenticated;

-- ── 4. set_permiso_tenant — admin activa/desactiva un módulo por rol ──
CREATE OR REPLACE FUNCTION set_permiso_tenant(
  p_tenant_id UUID,
  p_rol       TEXT,
  p_modulo    TEXT,
  p_activo    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rol_usr TEXT;
BEGIN
  SELECT rol INTO v_rol_usr FROM usuarios_tenant
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND activo = true
  LIMIT 1;

  IF v_rol_usr NOT IN ('admin','superadmin') THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  IF p_rol NOT IN ('contable','recepcion','profesional') THEN
    RETURN '{"ok":false,"error":"rol_invalido"}'::JSONB;
  END IF;

  INSERT INTO permisos_tenant (tenant_id, rol, modulo, activo)
  VALUES (p_tenant_id, p_rol, p_modulo, p_activo)
  ON CONFLICT (tenant_id, rol, modulo) DO UPDATE SET activo = EXCLUDED.activo;

  RETURN '{"ok":true}'::JSONB;
END;
$$;
GRANT EXECUTE ON FUNCTION set_permiso_tenant(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── Verificación ──────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '✓ v38 aplicado: permisos_tenant + salon_seed_permisos';
  RAISE NOTICE '  Funciones: get_permisos_tenant, set_permiso_tenant';
  RAISE NOTICE '  Roles configurables: contable, recepcion, profesional';
END $$;
