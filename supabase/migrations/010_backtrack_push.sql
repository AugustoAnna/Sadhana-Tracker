-- One-day backtracking: a single "Yesterday can still count" push per person,
-- sent by send-reminders in place of their first morning reminder. Set when
-- that push is accepted, so it is never sent again.
--
-- Run this BEFORE setting BACKTRACK_PUSH_ENABLED (e.g. =lab) on send-reminders.
-- With it unset the function never reads this column.
alter table participants add column if not exists backtrack_push_sent_at timestamptz;
