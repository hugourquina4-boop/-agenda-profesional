-- v64: activar recordatorios automáticos via pg_cron
--
-- PASOS PREVIOS (hacer en Supabase Dashboard antes de correr este SQL):
--   1. Database → Extensions → buscar "pg_cron" → Enable
--   2. Database → Extensions → buscar "pg_net" → Enable (si no está activo)
--   3. Edge Functions → deployar las funciones:
--      npx supabase functions deploy notificacion-recordatorio cumpleanos-clientes resumen-diario
--
-- LUEGO correr este archivo completo en SQL Editor.

-- Recordatorio de cita: corre cada hora (envía WA 24h y 1h antes)
SELECT cron.schedule(
  'recordatorio-citas',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://unpxoamfyushsbyyziyn.supabase.co/functions/v1/notificacion-recordatorio',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Cumpleaños: corre diario a las 9am Colombia (UTC-5 = 14:00 UTC)
SELECT cron.schedule(
  'cumpleanos-clientes',
  '0 14 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://unpxoamfyushsbyyziyn.supabase.co/functions/v1/cumpleanos-clientes',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Resumen diario para el dueño: 9pm Colombia (02:00 UTC siguiente día)
SELECT cron.schedule(
  'resumen-diario-salon',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://unpxoamfyushsbyyziyn.supabase.co/functions/v1/resumen-diario',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verificar que quedaron creados:
-- SELECT * FROM cron.job;

-- Para desactivar si es necesario:
-- SELECT cron.unschedule('recordatorio-citas');
-- SELECT cron.unschedule('cumpleanos-clientes');
-- SELECT cron.unschedule('resumen-diario-salon');
