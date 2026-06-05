-- v79: access_logs — trazabilidad de uso por negocio
-- Registra cada inicio de sesión. Permite al superadmin saber qué negocios
-- están usando activamente el sistema antes de cobrar / suspender.

CREATE TABLE IF NOT EXISTS access_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL,
  user_id    uuid        NOT NULL,
  evento     text        NOT NULL DEFAULT 'session_start',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_tenant_at
  ON access_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_logs_at
  ON access_logs(created_at DESC);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede insertar su propio evento
DROP POLICY IF EXISTS "access_logs_insert" ON access_logs;
CREATE POLICY "access_logs_insert" ON access_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Cada tenant ve solo sus propios logs
DROP POLICY IF EXISTS "access_logs_select_tenant" ON access_logs;
CREATE POLICY "access_logs_select_tenant" ON access_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM usuarios_tenant
      WHERE user_id = auth.uid() AND activo = true
    )
  );

GRANT INSERT, SELECT ON access_logs TO authenticated;

-- RPC superadmin: resumen de uso por negocio
-- Retorna: último acceso, sesiones este mes, días sin actividad
CREATE OR REPLACE FUNCTION salon_admin_get_access_logs(p_token TEXT)
RETURNS TABLE(
  tenant_id       uuid,
  tenant_nombre   text,
  tenant_slug     text,
  tenant_activo   boolean,
  tenant_plan     text,
  fecha_vence     date,
  ultimo_acceso   timestamptz,
  sesiones_mes    bigint,
  dias_sin_uso    int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_token <> 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id                                                         AS tenant_id,
    t.nombre                                                     AS tenant_nombre,
    t.slug                                                       AS tenant_slug,
    t.activo                                                     AS tenant_activo,
    t.plan                                                       AS tenant_plan,
    t.fecha_vencimiento::date                                    AS fecha_vence,
    MAX(al.created_at)                                           AS ultimo_acceso,
    COUNT(
      CASE WHEN al.created_at >= date_trunc('month', now()) THEN 1 END
    )::bigint                                                    AS sesiones_mes,
    CASE
      WHEN MAX(al.created_at) IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM now() - MAX(al.created_at))::int
    END                                                          AS dias_sin_uso
  FROM tenants t
  LEFT JOIN access_logs al ON al.tenant_id = t.id
  WHERE t.deleted_at IS NULL
  GROUP BY t.id, t.nombre, t.slug, t.activo, t.plan, t.fecha_vencimiento
  ORDER BY MAX(al.created_at) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION salon_admin_get_access_logs(TEXT) TO anon, authenticated;

DO $$ BEGIN
  RAISE NOTICE '✓ v79: access_logs — trazabilidad de uso + RPC salon_admin_get_access_logs';
END $$;
