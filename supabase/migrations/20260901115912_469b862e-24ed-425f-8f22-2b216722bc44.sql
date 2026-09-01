CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-meta-ads');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'sync-meta-ads',
  '17 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://leadsconvert.co.uk/api/public/hooks/sync-meta-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcHp3cXp1Z3V0aHhnaXNpaXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTExOTYsImV4cCI6MjA5ODQyNzE5Nn0.j1i-vIAkxAepGnm9VZolQBJAZvJhl7amW_XXY5Zq9FQ'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);