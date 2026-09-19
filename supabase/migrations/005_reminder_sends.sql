-- One row per push attempt made by the send-reminders edge function: which
-- reminder, which participant, which device, what the push service answered,
-- and — reported back by the service worker — whether the notification was
-- shown and tapped. Before this table nothing recorded a send at all; the
-- only trace was the function's {sent, deleted} response body in
-- net._http_response, which pg_net prunes after a few hours.
create table if not exists reminder_sends (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid not null references participants(id) on delete cascade,
  -- set null rather than cascade: the send happened even if the reminder or
  -- the device subscription is later removed.
  reminder_id     uuid references reminders(id) on delete set null,
  subscription_id uuid references push_subscriptions(id) on delete set null,
  environment     text not null check (environment in ('lab','study')),
  -- Snapshot of the reminder at send time. reminders rows hold current state
  -- only, so without this a later time change would rewrite history.
  kind            text not null,
  slot            int,
  practice_id     text,
  time_local      time not null,
  -- The participant-local calendar day this occurrence belongs to.
  local_date      date not null,
  -- pending: row claimed, push in flight. sent: push service accepted (201).
  -- failed: push service error other than an expired subscription.
  -- expired: 404/410 — the subscription was removed.
  status          text not null check (status in ('pending','sent','failed','expired')),
  status_code     int,
  error           text,
  sent_at         timestamptz not null default now(),
  delivered_at    timestamptz,
  tapped_at       timestamptz
);

-- One live attempt per reminder occurrence per device. The edge function
-- inserts this row *before* pushing, so two overlapping runs cannot both send.
-- failed/expired rows are excluded so the next run retries inside the
-- catch-up window.
create unique index if not exists reminder_sends_once_per_occurrence
  on reminder_sends (reminder_id, subscription_id, local_date)
  where status in ('pending', 'sent');

create index if not exists reminder_sends_participant_idx
  on reminder_sends (participant_id, sent_at);
create index if not exists reminder_sends_sent_at_idx
  on reminder_sends (sent_at);

alter table reminder_sends enable row level security;

-- Participants may read their own history. Only the service role writes rows.
create policy "own reminder_sends" on reminder_sends
  for select
  using (participant_id in (select id from participants where auth_user_id = auth.uid()));

-- Delivery receipts. The service worker has no Supabase session (it lives in
-- window localStorage), so the push handler calls these RPCs with the public
-- anon key. The send id is a random uuid carried in the push payload that only
-- the receiving device knows, which is what authorises the update; the
-- functions only ever set a timestamp that is still null.
create or replace function mark_reminder_delivered(p_send_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update reminder_sends
  set delivered_at = coalesce(delivered_at, now())
  where id = p_send_id;
$$;

create or replace function mark_reminder_tapped(p_send_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update reminder_sends
  set tapped_at    = coalesce(tapped_at, now()),
      delivered_at = coalesce(delivered_at, now())
  where id = p_send_id;
$$;

revoke all on function mark_reminder_delivered(uuid) from public;
revoke all on function mark_reminder_tapped(uuid) from public;
grant execute on function mark_reminder_delivered(uuid) to anon, authenticated;
grant execute on function mark_reminder_tapped(uuid) to anon, authenticated;

-- Quick daily funnel for the dashboard / SQL editor. security_invoker keeps
-- the RLS policy above in force for API callers instead of the view owner's.
create or replace view reminder_sends_daily
with (security_invoker = true) as
select
  local_date,
  environment,
  count(*) filter (where status = 'sent')                                    as sent,
  count(*) filter (where status = 'failed')                                  as failed,
  count(*) filter (where status = 'expired')                                 as expired,
  count(*) filter (where status = 'pending')                                 as stuck_pending,
  count(*) filter (where status = 'sent' and delivered_at is not null)       as delivered,
  count(*) filter (where status = 'sent' and tapped_at is not null)          as tapped,
  count(distinct participant_id) filter (where status = 'sent')              as participants_reached
from reminder_sends
group by local_date, environment
order by local_date desc, environment;
