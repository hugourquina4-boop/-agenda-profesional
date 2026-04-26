-- v4: Campos extra en tenants para gestión superadmin
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS notas_admin TEXT,
  ADD COLUMN IF NOT EXISTS links       JSONB DEFAULT '{}';

-- Actualizar la vista superadmin para incluir nuevos campos
CREATE OR REPLACE VIEW v_superadmin_negocios AS
SELECT
  t.id, t.nombre, t.slug, t.vertical, t.activo, t.verificado,
  t.email, t.whatsapp, t.telefono, t.ciudad, t.direccion,
  t.descripcion, t.color_primario, t.notas_admin, t.links,
  t.created_at,
  p.tipo  AS plan,
  s.estado AS suscripcion_estado,
  s.fecha_inicio AS susc_inicio,
  s.fecha_vencimiento AS susc_vencimiento,
  (SELECT COUNT(*) FROM citas c
   WHERE c.tenant_id = t.id
     AND c.fecha_inicio >= NOW() - INTERVAL '30 days') AS citas_30d
FROM tenants t
LEFT JOIN suscripciones s ON s.tenant_id = t.id
  AND s.estado IN ('activa', 'trial')
LEFT JOIN planes p ON p.id = s.plan_id
ORDER BY t.created_at DESC;
