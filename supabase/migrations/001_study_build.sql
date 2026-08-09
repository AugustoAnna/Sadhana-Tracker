-- Study Build schema (§2). Apply in Supabase SQL editor.

create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  name          text not null,
  environment   text not null check (environment in ('lab','study')),
  created_at    timestamptz not null default now()
);

create table if not exists practices (
  id                     text primary key,
  name                   text not null,
  kind                   text not null check (kind in ('guided','timed','unguided')),
  default_minutes        int,
  illustration           text not null,
  audio_path             text,
  allows_second_instance boolean not null default true,
  sort_order             int not null
);

create table if not exists participant_practices (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  practice_id    text not null references practices(id),
  instance       int  not null default 1 check (instance in (1,2)),
  environment    text not null check (environment in ('lab','study')),
  created_at     timestamptz not null default now(),
  unique (participant_id, practice_id, instance)
);

create table if not exists practice_logs (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  practice_id    text not null references practices(id),
  instance       int  not null default 1,
  minutes        int  not null check (minutes > 0),
  source         text not null check (source in ('checkbox','minutes','player')),
  logged_at      timestamptz not null default now(),
  local_date     date not null,
  environment    text not null check (environment in ('lab','study')),
  created_at     timestamptz not null default now()
);

create table if not exists reminders (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  kind           text not null check (kind in ('generic','practice')),
  slot           int,
  practice_id    text references practices(id),
  time_local     time not null,
  enabled        boolean not null default false,
  environment    text not null check (environment in ('lab','study'))
);

-- Analysis views (§2.4)
create or replace view study_participants as
  select * from participants where environment = 'study';

create or replace view study_logs as
  select * from practice_logs where environment = 'study';

create or replace view study_practices_added as
  select * from participant_practices where environment = 'study';

create or replace view study_daily_activity as
  select p.id as participant_id,
         p.name,
         l.local_date,
         count(l.id)                   as logs,
         coalesce(sum(l.minutes), 0)   as minutes,
         count(distinct l.practice_id) as distinct_practices
  from study_participants p
  left join study_logs l on l.participant_id = p.id
  group by p.id, p.name, l.local_date;
