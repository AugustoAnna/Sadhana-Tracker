-- Sadhana Tracker — initial schema
-- Device-bound participants (no auth). Each client generates a device_id stored locally.

create extension if not exists "pgcrypto";

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  name text not null,
  is_meditator boolean,
  onboarding_complete boolean not null default false,
  instance_education_shown boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists practice_instances (
  id uuid primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  device_id text not null,
  practice_id text not null,
  instance_number smallint not null check (instance_number in (1, 2)),
  order_index integer not null default 0,
  added_at timestamptz not null default now(),
  unique (participant_id, practice_id, instance_number)
);

create table if not exists practice_logs (
  id uuid primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  device_id text not null,
  practice_id text not null,
  instance_id uuid not null,
  minutes integer not null check (minutes > 0),
  logged_at timestamptz not null,
  source text not null check (source in ('manual', 'player')),
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id smallint not null check (id between 1 and 3),
  participant_id uuid not null references participants(id) on delete cascade,
  device_id text not null,
  time text not null,
  enabled boolean not null default false,
  primary key (participant_id, id)
);

create table if not exists saved_sessions (
  id uuid primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  device_id text not null,
  name text not null,
  practice_instance_ids uuid[] not null default '{}',
  last_used_at timestamptz not null default now()
);

create index if not exists idx_practice_logs_participant on practice_logs(participant_id);
create index if not exists idx_practice_logs_device on practice_logs(device_id);
create index if not exists idx_practice_logs_logged_at on practice_logs(logged_at);
create index if not exists idx_practice_instances_participant on practice_instances(participant_id);

-- Study pilot: device-scoped access via anon key (no user accounts)
alter table participants enable row level security;
alter table practice_instances enable row level security;
alter table practice_logs enable row level security;
alter table reminders enable row level security;
alter table saved_sessions enable row level security;

create policy "participants_device_select" on participants
  for select using (true);
create policy "participants_device_insert" on participants
  for insert with check (true);
create policy "participants_device_update" on participants
  for update using (true);

create policy "practice_instances_all" on practice_instances
  for all using (true) with check (true);
create policy "practice_logs_all" on practice_logs
  for all using (true) with check (true);
create policy "reminders_all" on reminders
  for all using (true) with check (true);
create policy "saved_sessions_all" on saved_sessions
  for all using (true) with check (true);

-- Auto-update updated_at on participants
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger participants_updated_at
  before update on participants
  for each row execute function update_updated_at();
