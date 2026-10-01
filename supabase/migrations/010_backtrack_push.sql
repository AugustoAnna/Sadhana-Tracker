-- One-day backtracking: a single "Yesterday can still count" push per person,
-- sent by send-reminders in place of their first morning reminder. Set when
-- that push is accepted, so it is never sent again.
--
-- Run this BEFORE setting BACKTRACK_PUSH_ENABLED=true on send-reminders. With
-- the flag off the function never reads it.
alter table participants add column if not exists backtrack_push_sent_at timestamptz;
