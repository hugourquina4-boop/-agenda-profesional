-- v72: Permitir lectura pública de tenants activos para el portal de reservas
-- ROOT CAUSE: anon role no tenía política SELECT en tenants → query retornaba null
-- → SalonPortal mostraba pantalla en blanco silenciosamente
-- APLICAR EN: Supabase → SQL Editor

DROP POLICY IF EXISTS "tenants_publico_activos" ON tenants;
CREATE POLICY "tenants_publico_activos" ON tenants
  FOR SELECT TO anon
  USING (activo = true AND deleted_at IS NULL);

-- También necesitamos que anon pueda leer profesionales, servicios, horarios,
-- horarios_excepcion, sedes y profesional_servicios para que el portal funcione.
-- (La mayoría ya tienen política anon desde v59_fixes_portal_anticipos.sql)
-- Verificar y añadir las que falten:

DROP POLICY IF EXISTS "profesionales_portal_anon" ON profesionales;
CREATE POLICY "profesionales_portal_anon" ON profesionales
  FOR SELECT TO anon
  USING (activo = true);

DROP POLICY IF EXISTS "servicios_portal_anon" ON servicios;
CREATE POLICY "servicios_portal_anon" ON servicios
  FOR SELECT TO anon
  USING (activo = true);

DROP POLICY IF EXISTS "horarios_portal_anon" ON horarios;
CREATE POLICY "horarios_portal_anon" ON horarios
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "horarios_excepcion_portal_anon" ON horarios_excepcion;
CREATE POLICY "horarios_excepcion_portal_anon" ON horarios_excepcion
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "sedes_portal_anon" ON sedes;
CREATE POLICY "sedes_portal_anon" ON sedes
  FOR SELECT TO anon
  USING (activo = true);

DROP POLICY IF EXISTS "paquetes_salon_portal_anon" ON paquetes_salon;
CREATE POLICY "paquetes_salon_portal_anon" ON paquetes_salon
  FOR SELECT TO anon
  USING (visible_portal = true AND activo = true);

DROP POLICY IF EXISTS "paquetes_servicios_portal_anon" ON paquetes_servicios;
CREATE POLICY "paquetes_servicios_portal_anon" ON paquetes_servicios
  FOR SELECT TO anon
  USING (true);

-- citas: anon solo puede hacer SELECT para verificar solapamiento (anti double-booking)
-- y INSERT para crear reservas. La política de INSERT ya existe desde v59.
DROP POLICY IF EXISTS "citas_portal_anon_select" ON citas;
CREATE POLICY "citas_portal_anon_select" ON citas
  FOR SELECT TO anon
  USING (true);

-- config_vertical no existe en este proyecto — omitido
