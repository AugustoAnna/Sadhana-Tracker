-- Participants sign in with an email code; the email is the account's
-- human-readable identity (auth.users.email, mirrored here for analysis).
-- Nullable: rows from the anonymous build fill it in when they link an email.
alter table participants add column if not exists email text;

create unique index if not exists participants_email_key
  on participants (lower(email))
  where email is not null;

-- `select *` views are expanded at creation time, so re-create the ones that
-- should expose the new column.
create or replace view study_participants as
  select * from participants where environment = 'study';

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
     where r.participant_id = p.id and r.enabled)               as reminders_enabled,
  p.email
from study_participants p
left join study_practice_completed c on c.participant_id = p.id
group by p.id, p.name, p.email, p.segment, p.platform, p.installed_standalone,
         p.notification_permission, p.created_at;
