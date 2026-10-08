-- One reminder per slot per participant.
--
-- Why: the client used to upsert reminders on a random uuid generated per
-- install, so every reinstall (fresh IndexedDB) added a new row for the same
-- slot and the old ones were never removed. send-reminders pushes every enabled
-- row, so one participant received 26 copies of their 06:00 reminder. The
-- client now upserts on the key below instead of the id.
--
-- Run the duplicate cleanup BEFORE this migration: with duplicates still
-- present the index cannot be created. Keep one row per
-- (participant_id, environment, kind, slot, practice_id), preferring an
-- enabled one; a reminder_sends row pointing at a removed reminder has its
-- reminder_id set null by the existing foreign key.
--
-- Needs Postgres 15+ (NULLS NOT DISTINCT): generic reminders have no
-- practice_id and practice reminders have no slot, and those nulls must count
-- as equal or the index would not stop any duplicates.
create unique index if not exists reminders_one_per_slot
  on reminders (participant_id, environment, kind, slot, practice_id)
  nulls not distinct;
