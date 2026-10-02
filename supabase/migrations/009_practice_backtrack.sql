-- One-day backtracking: the app can log a practice for yesterday. Such a row
-- has local_date = the day before the local date of occurred_at, since
-- occurred_at stays the moment it was entered. These columns mark those rows
-- so analysis can tell "practiced then" from "entered then".
--
-- Run this BEFORE deploying an app build that syncs these columns: until
-- they exist, every practice_completed upsert naming them is rejected and
-- stays in the device's sync queue (retried, not lost).

-- True when the log was made for the day before the one it was entered on.
alter table practice_completed
  add column if not exists backtrack boolean not null default false;

-- How the person reached yesterday: the day switcher, the missed-day sheet,
-- or a push. Set only on backtracked rows.
alter table practice_completed
  add column if not exists route text;

alter table practice_completed
  drop constraint if exists practice_completed_route_check;
alter table practice_completed
  add constraint practice_completed_route_check check (
    (backtrack and route in ('switcher', 'sheet', 'push'))
    or (not backtrack and route is null)
  );

-- A `select *` view keeps the column list it was created with, so the study
-- view has to be recreated to expose the new columns.
create or replace view study_practice_completed as
  select * from practice_completed where environment = 'study';
