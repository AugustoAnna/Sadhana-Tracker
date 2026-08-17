-- banner_targets — names that should trigger the name-banner
-- Seeded with 'Anonymous' so the app rule is simply: show banner when participant name ∈ banner_targets.

create table if not exists banner_targets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

insert into banner_targets (name)
values ('Anonymous')
on conflict (name) do nothing;

alter table banner_targets enable row level security;
create policy "banner_targets public read" on banner_targets
  for select using (true);
