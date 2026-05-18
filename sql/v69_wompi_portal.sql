-- v69: pagos en línea desde el portal público vía Wompi
-- Cada tenant puede activar cobros online registrando su clave pública de Wompi.
-- La clave pública es segura en el frontend — solo permite abrir el widget.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS wompi_public_key    TEXT,
  ADD COLUMN IF NOT EXISTS pagos_portal_activo BOOLEAN NOT NULL DEFAULT false;

-- Habilitar pagos para un negocio (lo hace el admin desde SalonConfig):
-- UPDATE tenants SET wompi_public_key = 'pub_stagtest_xxx', pagos_portal_activo = true WHERE slug = 'mi-salon';

DO $$ BEGIN
  RAISE NOTICE '✓ v69: columnas wompi_public_key y pagos_portal_activo añadidas a tenants';
END $$;
