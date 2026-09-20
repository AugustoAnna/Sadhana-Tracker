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
--
-- Reliability model: pg_cron has run this every minute without a gap since
-- 2026-08-19 (checked 2026-09-19: 0 missing minutes), but a "succeeded" run
-- only means the HTTP request was queued — pg_net delivers it asynchronously
-- and the function's own outcome is visible only in net._http_response, which
-- is pruned after ~6 h. The function therefore treats a reminder as due for
-- CATCH_UP_WINDOW_MINUTES after its time and records every attempt in
-- reminder_sends with a once-per-occurrence unique index, so a slow, late or
-- failed run is retried by the following runs and can never double-send.
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
    ),
    -- pg_net's default is 5 s; a cold start plus a burst of pushes at a
    -- popular minute (06:00 IST) can exceed that and be logged as a timeout.
    timeout_milliseconds := 20000
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

-- ---------------------------------------------------------------------------
-- Monitoring (reminder_sends is written by the function, see migration 005)
-- ---------------------------------------------------------------------------

-- Daily funnel: sent / failed / expired / delivered / tapped.
select * from reminder_sends_daily limit 14;

-- Anything not accepted by the push service in the last 24 h.
select sent_at, status, status_code, left(error, 120) as error, participant_id
from reminder_sends
where status in ('failed', 'expired') and sent_at > now() - interval '24 hours'
order by sent_at desc;

-- Rows stuck in 'pending' mean the function died between claiming and
-- pushing; they block that occurrence for the day and should be rare.
select count(*) as stuck_pending
from reminder_sends
where status = 'pending' and sent_at < now() - interval '15 minutes';

-- Enabled reminders the function can never send (participant has a device
-- subscription but no timezone). Should be 0; the app syncs timezone on open.
select count(*) as unsendable_reminders
from reminders r
join participants p on p.id = r.participant_id
where r.enabled and p.timezone is null
  and exists (select 1 from push_subscriptions s where s.participant_id = p.id);

-- HTTP-level failures between pg_net and the function (last ~6 h only).
select created, status_code, error_msg, left(content, 200) as content
from net._http_response
where status_code is distinct from 200
order by created desc limit 20;
