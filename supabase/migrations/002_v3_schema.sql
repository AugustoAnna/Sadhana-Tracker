-- Sadhana Tracker v3 schema (supersedes 001_study_build.sql)

-- participants
create table if not exists participants (
  id                      uuid primary key default gen_random_uuid(),
  auth_user_id            uuid not null unique references auth.users(id) on delete cascade,
  name                    text not null,
  platform                text,
  installed_standalone      boolean not null default false,
  notification_permission text,
  segment                 text,
  environment             text not null check (environment in ('lab','study')),
  created_at              timestamptz not null default now()
);

-- seeded catalogue
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

create table if not exists practice_completed (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  practice_id    text not null references practices(id),
  instance       int  not null default 1 check (instance in (1,2)),
  minutes        int  not null check (minutes > 0),
  mode           text not null check (mode in ('logged','minutes_added','guided')),
  was_offline    boolean not null default false,
  local_date     date not null,
  occurred_at    timestamptz not null default now(),
  environment    text not null check (environment in ('lab','study')),
  created_at     timestamptz not null default now()
);

create index if not exists practice_completed_participant_date_idx
  on practice_completed (participant_id, local_date);

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

create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  name           text not null,
  properties     jsonb not null default '{}',
  occurred_at    timestamptz not null default now(),
  local_date     date not null,
  environment    text not null check (environment in ('lab','study')),
  created_at     timestamptz not null default now()
);

create index if not exists events_name_idx on events (name);
create index if not exists events_participant_idx on events (participant_id, occurred_at);
create index if not exists events_props_idx on events using gin (properties);

-- RLS
alter table participants enable row level security;
alter table participant_practices enable row level security;
alter table practice_completed enable row level security;
alter table reminders enable row level security;
alter table events enable row level security;

create policy "own participants" on participants
  for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "own participant_practices" on participant_practices
  for all
  using (participant_id in (select id from participants where auth_user_id = auth.uid()))
  with check (participant_id in (select id from participants where auth_user_id = auth.uid()));

create policy "own practice_completed" on practice_completed
  for all
  using (participant_id in (select id from participants where auth_user_id = auth.uid()))
  with check (participant_id in (select id from participants where auth_user_id = auth.uid()));

create policy "own reminders" on reminders
  for all
  using (participant_id in (select id from participants where auth_user_id = auth.uid()))
  with check (participant_id in (select id from participants where auth_user_id = auth.uid()));

create policy "own events" on events
  for all
  using (participant_id in (select id from participants where auth_user_id = auth.uid()))
  with check (participant_id in (select id from participants where auth_user_id = auth.uid()));

alter table practices enable row level security;
create policy "practices public read" on practices for select using (true);

-- Analysis views (§2.5)
create or replace view study_participants as
  select * from participants where environment = 'study';

create or replace view study_practice_completed as
  select * from practice_completed where environment = 'study';

create or replace view study_practices_added as
  select * from participant_practices where environment = 'study';

create or replace view study_events as
  select * from events where environment = 'study';

create or replace view study_participant_profile as
select
  p.id, p.name, p.segment, p.platform, p.installed_standalone,
  p.notification_permission, p.created_at,
  count(distinct c.local_date)                                  as days_practiced,
  coalesce(sum(c.minutes), 0)                                   as total_minutes,
  count(distinct c.practice_id)                                 as distinct_practices_logged,
  count(c.id)                                                   as total_records,
  round(coalesce(sum(c.minutes),0)::numeric
        / greatest(count(distinct c.local_date),1), 1)           as avg_minutes_per_active_day,
  min(c.local_date)                                             as first_record_date,
  max(c.local_date)                                             as last_record_date,
  current_date - max(c.local_date)                              as days_since_last_record,
  (select count(*) from participant_practices pp
     where pp.participant_id = p.id)                            as practices_added,
  (select count(*) from participant_practices pp
     where pp.participant_id = p.id) - count(distinct c.practice_id) as added_never_logged,
  (select count(*) from reminders r
     where r.participant_id = p.id and r.enabled)               as reminders_enabled
from study_participants p
left join study_practice_completed c on c.participant_id = p.id
group by p.id, p.name, p.segment, p.platform, p.installed_standalone,
         p.notification_permission, p.created_at;
