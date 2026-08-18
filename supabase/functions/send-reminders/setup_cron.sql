-- Enable pg_cron extension (run once)
create extension if not exists pg_cron;

-- Enable net extension for HTTP requests (run once)
create extension if not exists pg_net;

-- Schedule send-reminders Edge Function to run every minute
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://mmzzcigydnelnxdhmoqw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Verify the job is scheduled
select * from cron.job where jobname = 'send-reminders';
