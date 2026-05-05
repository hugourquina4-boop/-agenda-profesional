-- ═══════════════════════════════════════════════════════════════════
-- SALÓN PRO — v13: Storage bucket para imágenes
-- Corre esto en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Crear bucket público "imagenes"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imagenes',
  'imagenes',
  true,
  5242880,   -- 5 MB máximo por archivo
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'];

-- Lectura pública (cualquiera puede ver las imágenes)
DROP POLICY IF EXISTS "imagenes_public_read" ON storage.objects;
CREATE POLICY "imagenes_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'imagenes');

-- Subida: anon y authenticated pueden subir
DROP POLICY IF EXISTS "imagenes_insert" ON storage.objects;
CREATE POLICY "imagenes_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'imagenes');

-- Actualizar: solo authenticated
DROP POLICY IF EXISTS "imagenes_update" ON storage.objects;
CREATE POLICY "imagenes_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'imagenes' AND auth.role() = 'authenticated');

-- Eliminar: solo authenticated
DROP POLICY IF EXISTS "imagenes_delete" ON storage.objects;
CREATE POLICY "imagenes_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'imagenes' AND auth.role() = 'authenticated');
