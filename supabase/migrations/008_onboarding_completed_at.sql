-- When the participant finished the setup flow (practices step, then the
-- reminders step's Done). Until now this lived only in the device's IndexedDB
-- profile: a second device, or one whose database was evicted, inferred it
-- from having practice logs and otherwise walked the person through setup
-- again — and analysis could not tell who finished onboarding from who added
-- practices and stopped.
alter table participants add column if not exists onboarding_completed_at timestamptz;

-- Backfill for rows created before the column existed. The practices step
-- cannot be left without at least one practice added and the reminders step
-- follows immediately, so the first participant_practices row is the closest
-- evidence of finishing setup; a participant whose practices were all removed
-- (or merged away) but who has logs finished it too, since logging is only
-- reachable past onboarding. Approximate by construction: it also marks the
-- few who added practices and abandoned the reminders step. The app only ever
-- writes this column where it is still null, so a device that finishes setup
-- later never overwrites the earlier backfilled value.
update participants p
set onboarding_completed_at = coalesce(pp.first_added, pc.first_log)
from participants q
left join (
  select participant_id, min(created_at) as first_added
  from participant_practices
  group by participant_id
) pp on pp.participant_id = q.id
left join (
  select participant_id, min(occurred_at) as first_log
  from practice_completed
  group by participant_id
) pc on pc.participant_id = q.id
where q.id = p.id
  and p.onboarding_completed_at is null
  and coalesce(pp.first_added, pc.first_log) is not null;
