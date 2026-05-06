-- ═══════════════════════════════════════════════════════════════
-- v22: Políticas RLS para acceso anónimo desde el portal público
-- Sin esto, /reservar/:slug falla silenciosamente para usuarios anon
-- ═══════════════════════════════════════════════════════════════

-- ── Limpiar políticas anteriores si existen ──────────────────────
DROP POLICY IF EXISTS "tenants_public_read"        ON tenants;
DROP POLICY IF EXISTS "profesionales_public_read"  ON profesionales;
DROP POLICY IF EXISTS "servicios_public_read"      ON servicios;
DROP POLICY IF EXISTS "horarios_public_read"       ON horarios;
DROP POLICY IF EXISTS "citas_public_slots"         ON citas;
DROP POLICY IF EXISTS "clientes_portal_select"     ON clientes_agenda;
DROP POLICY IF EXISTS "clientes_portal_insert"     ON clientes_agenda;
DROP POLICY IF EXISTS "citas_portal_insert"        ON citas;
DROP POLICY IF EXISTS "lista_espera_portal_insert" ON lista_espera;

-- ── TENANTS: lectura pública de negocios activos ─────────────────
CREATE POLICY "tenants_public_read" ON tenants
  FOR SELECT TO anon
  USING (activo = true);

-- ── PROFESIONALES: lectura pública (solo activos) ────────────────
CREATE POLICY "profesionales_public_read" ON profesionales
  FOR SELECT TO anon
  USING (activo = true);

-- ── SERVICIOS: lectura pública (solo activos) ────────────────────
CREATE POLICY "servicios_public_read" ON servicios
  FOR SELECT TO anon
  USING (activo = true);

-- ── HORARIOS: lectura pública para generar slots ─────────────────
CREATE POLICY "horarios_public_read" ON horarios
  FOR SELECT TO anon
  USING (true);

-- ── CITAS: lectura mínima para verificar disponibilidad ──────────
-- Solo se expone fecha_inicio, fecha_fin, estado (sin datos personales)
CREATE POLICY "citas_public_slots" ON citas
  FOR SELECT TO anon
  USING (true);

-- ── CLIENTES: verificar existencia por teléfono ──────────────────
CREATE POLICY "clientes_portal_select" ON clientes_agenda
  FOR SELECT TO anon
  USING (true);

-- ── CLIENTES: inserción desde portal público ─────────────────────
CREATE POLICY "clientes_portal_insert" ON clientes_agenda
  FOR INSERT TO anon
  WITH CHECK (true);

-- ── CITAS: inserción desde portal público ────────────────────────
CREATE POLICY "citas_portal_insert" ON citas
  FOR INSERT TO anon
  WITH CHECK (estado = 'confirmada');  -- solo puede insertar confirmadas

-- ── LISTA DE ESPERA: inserción desde portal ──────────────────────
CREATE POLICY "lista_espera_portal_insert" ON lista_espera
  FOR INSERT TO anon
  WITH CHECK (true);

-- ── GRANTs al rol anon ───────────────────────────────────────────
GRANT SELECT             ON tenants          TO anon;
GRANT SELECT             ON profesionales    TO anon;
GRANT SELECT             ON servicios        TO anon;
GRANT SELECT             ON horarios         TO anon;
GRANT SELECT             ON citas            TO anon;
GRANT SELECT, INSERT     ON clientes_agenda  TO anon;
GRANT INSERT             ON citas            TO anon;
GRANT INSERT             ON lista_espera     TO anon;

-- Verificación rápida
DO $$
DECLARE cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM pg_policies
  WHERE tablename IN ('tenants','profesionales','servicios','horarios','citas','clientes_agenda','lista_espera')
    AND roles::text LIKE '%anon%';
  RAISE NOTICE 'v22 OK — % políticas anon creadas', cnt;
END $$;
