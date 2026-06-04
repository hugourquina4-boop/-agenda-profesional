-- v90_cron_vencimiento.sql
-- Cron diario: alerta WA a tenants con suscripción próxima a vencer (7d, 3d, 0d)
--
-- PASOS PREVIOS:
--   1. npx supabase functions deploy notif-vencimiento-suscripcion
--   2. Correr este SQL en el Editor de Supabase

SELECT cron.schedule(
  'notif-vencimiento-suscripcion',
  '0 14 * * *',  -- 9am Colombia (UTC-5 = 14:00 UTC)
  $$
    SELECT net.http_post(
      url     := 'https://unpxoamfyushsbyyziyn.supabase.co/functions/v1/notif-vencimiento-suscripcion',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verificar: SELECT * FROM cron.job WHERE jobname = 'notif-vencimiento-suscripcion';
-- Desactivar: SELECT cron.unschedule('notif-vencimiento-suscripcion');
