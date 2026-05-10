-- v45: mejoras panel superadmin
-- 1. Agrega citas_hoy y excluye tenants eliminados de salon_admin_get_tenants
-- 2. Nueva función salon_admin_eliminar_tenant (soft delete)
-- IDEMPOTENTE — APLICAR EN: Supabase → SQL Editor

-- ── 0. Columna deleted_at en tenants ─────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── 1. Actualizar salon_admin_get_tenants (incluye citas_hoy, excluye eliminados)
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
      'id',                  t.id,
      'nombre',              t.nombre,
      'slug',                t.slug,
      'ciudad',              t.ciudad,
      'vertical',            t.vertical,
      'plan',                t.plan,
      'activo',              t.activo,
      'admin_email',         t.admin_email,
      'fecha_vencimiento',   t.fecha_vencimiento,
      'color_primario',      t.color_primario,
      'created_at',          t.created_at,
      'nombre_representante',t.nombre_representante,
      'telefono',            t.telefono,
      'instagram',           t.instagram,
      'pagina_web',          t.pagina_web,
      'total_citas',         (SELECT COUNT(*) FROM citas c WHERE c.tenant_id = t.id),
      'citas_hoy',           (SELECT COUNT(*) FROM citas c WHERE c.tenant_id = t.id AND c.fecha_inicio::date = CURRENT_DATE),
      'total_clientes',      (SELECT COUNT(*) FROM clientes_agenda ca WHERE ca.tenant_id = t.id),
      'total_profesionales', (SELECT COUNT(*) FROM profesionales p WHERE p.tenant_id = t.id AND p.activo = true)
    ) ORDER BY t.nombre
  ) INTO v_result
  FROM tenants t
  WHERE t.deleted_at IS NULL;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_get_tenants(TEXT) TO anon;

-- ── 2. salon_admin_eliminar_tenant — soft delete ──────────────────────────────
CREATE OR REPLACE FUNCTION salon_admin_eliminar_tenant(
  p_token     TEXT,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT salon_verificar_admin(p_token) THEN
    RETURN '{"ok":false,"error":"no_autorizado"}'::JSONB;
  END IF;

  UPDATE tenants
  SET activo     = false,
      deleted_at = now(),
      updated_at = now()
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object('ok', true, 'tenant_id', p_tenant_id);
END;
$$;
GRANT EXECUTE ON FUNCTION salon_admin_eliminar_tenant(TEXT, UUID) TO anon;

DO $$ BEGIN
  RAISE NOTICE '✓ v45: salon_admin_get_tenants actualizado (citas_hoy + excluye eliminados)';
  RAISE NOTICE '       salon_admin_eliminar_tenant: soft delete (activo=false + deleted_at)';
END $$;
