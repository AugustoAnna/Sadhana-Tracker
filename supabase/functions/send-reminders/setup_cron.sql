-- Enable pg_cron extension (run once)
create extension if not exists pg_cron;

-- Enable net extension for HTTP requests (run once)
create extension if not exists pg_net;

-- Store the project's anon key in Vault (run once; replace the placeholder).
-- The edge function talks to the database with its own service-role secret,
-- so the cron caller only needs a JWT that passes gateway verification —
-- the public anon key is enough. Do NOT store the service role key here.
select vault.create_secret('<YOUR_SUPABASE_ANON_KEY>', 'project_anon_key');

-- Schedule send-reminders Edge Function to run every minute.
-- Re-running cron.schedule with the same job name replaces the existing job.
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://mmzzcigydnelnxdhmoqw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'project_anon_key'
      ),
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Verify the job is scheduled
select * from cron.job where jobname = 'send-reminders';

-- Verify recent runs succeed (status should be 'succeeded')
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'send-reminders')
order by start_time desc limit 10;

-- Verify the edge function's HTTP responses (status_code should be 200)
select status_code, content, created
from net._http_response
order by created desc limit 5;
