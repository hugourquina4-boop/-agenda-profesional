-- =====================================================================
-- RESET COMPLETO — ejecutar SOLO si necesitas empezar de cero
-- Borra todo lo del schema anterior antes de correr schema_v1.sql
-- =====================================================================

-- Vistas
DROP VIEW IF EXISTS v_superadmin_negocios CASCADE;
DROP VIEW IF EXISTS v_citas_hoy CASCADE;

-- Tablas (en orden inverso de dependencias)
DROP TABLE IF EXISTS webhooks_config       CASCADE;
DROP TABLE IF EXISTS logs_actividad        CASCADE;
DROP TABLE IF EXISTS citas                 CASCADE;
DROP TABLE IF EXISTS bloqueos_agenda       CASCADE;
DROP TABLE IF EXISTS horarios              CASCADE;
DROP TABLE IF EXISTS profesional_servicios CASCADE;
DROP TABLE IF EXISTS servicios             CASCADE;
DROP TABLE IF EXISTS clientes_agenda       CASCADE;
DROP TABLE IF EXISTS profesionales         CASCADE;
DROP TABLE IF EXISTS usuarios_tenant       CASCADE;
DROP TABLE IF EXISTS suscripciones         CASCADE;
DROP TABLE IF EXISTS tenants               CASCADE;
DROP TABLE IF EXISTS planes                CASCADE;
DROP TABLE IF EXISTS superadmins           CASCADE;

-- Funciones
DROP FUNCTION IF EXISTS es_superadmin()    CASCADE;
DROP FUNCTION IF EXISTS mi_tenant_id()     CASCADE;
DROP FUNCTION IF EXISTS trg_set_updated_at() CASCADE;

-- Tipos / ENUMs
DROP TYPE IF EXISTS vertical_tipo      CASCADE;
DROP TYPE IF EXISTS plan_tipo          CASCADE;
DROP TYPE IF EXISTS suscripcion_estado CASCADE;
DROP TYPE IF EXISTS cita_estado        CASCADE;
DROP TYPE IF EXISTS dia_semana         CASCADE;
