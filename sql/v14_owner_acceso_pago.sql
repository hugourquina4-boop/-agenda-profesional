-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v14: Datos del dueño + alerta de pago
-- Corre en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── Columnas nuevas en tenants ───────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS owner_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS owner_email    TEXT,
  ADD COLUMN IF NOT EXISTS owner_telefono TEXT,
  ADD COLUMN IF NOT EXISTS alerta_pago    BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_pago_msg TEXT      DEFAULT 'Tu suscripción está vencida. Contacta al administrador para renovarla y seguir usando Salón Pro.';

-- ── Índice para consultar tenants con alerta activa ─────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_alerta ON tenants(alerta_pago) WHERE alerta_pago = true;

-- ── Actualizar la función superadmin para incluir los nuevos campos ──
CREATE OR REPLACE FUNCTION get_superadmin_negocios()
RETURNS TABLE (
  id                  UUID,
  nombre              TEXT,
  slug                TEXT,
  vertical            TEXT,
  activo              BOOLEAN,
  verificado          BOOLEAN,
  email               TEXT,
  whatsapp            TEXT,
  telefono            TEXT,
  ciudad              TEXT,
  direccion           TEXT,
  descripcion         TEXT,
  color_primario      TEXT,
  notas_admin         TEXT,
  links               JSONB,
  logo_url            TEXT,
  owner_nombre        TEXT,
  owner_email         TEXT,
  owner_telefono      TEXT,
  alerta_pago         BOOLEAN,
  alerta_pago_msg     TEXT,
  plan                TEXT,
  precio_mes          NUMERIC,
  suscripcion_estado  TEXT,
  susc_inicio         DATE,
  susc_vencimiento    DATE,
  citas_30d           BIGINT,
  total_citas         BIGINT,
  registrado_en       TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.nombre,
    t.slug,
    t.vertical,
    t.activo,
    t.verificado,
    t.email,
    t.whatsapp,
    t.telefono,
    t.ciudad,
    t.direccion,
    t.descripcion,
    t.color_primario,
    t.notas_admin,
    t.links,
    t.logo_url,
    t.owner_nombre,
    t.owner_email,
    t.owner_telefono,
    t.alerta_pago,
    t.alerta_pago_msg,
    p.nombre       AS plan,
    p.precio_mes,
    s.estado       AS suscripcion_estado,
    s.fecha_inicio AS susc_inicio,
    s.fecha_vencimiento AS susc_vencimiento,
    (SELECT COUNT(*) FROM citas c
      WHERE c.tenant_id = t.id
        AND c.fecha_inicio >= NOW() - INTERVAL '30 days')  AS citas_30d,
    (SELECT COUNT(*) FROM citas c WHERE c.tenant_id = t.id) AS total_citas,
    t.created_at   AS registrado_en
  FROM tenants t
  LEFT JOIN suscripciones s ON s.tenant_id = t.id
    AND s.estado IN ('activa','trial')
  LEFT JOIN planes p ON p.id = s.plan_id
  ORDER BY t.created_at DESC;
END;
$$;
