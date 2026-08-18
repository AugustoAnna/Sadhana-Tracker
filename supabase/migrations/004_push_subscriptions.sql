-- Add timezone column to participants
alter table participants add column if not exists timezone text;

-- Push subscriptions for Web Push notifications
create table if not exists push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  endpoint       text not null,
  p256dh         text not null,
  auth           text not null,
  environment    text not null check (environment in ('lab','study')),
  created_at     timestamptz not null default now(),
  unique (participant_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "own push_subscriptions" on push_subscriptions
  for all
  using (participant_id in (select id from participants where auth_user_id = auth.uid()))
  with check (participant_id in (select id from participants where auth_user_id = auth.uid()));
