# Instrumentation — Sadhana Tracker study build

Study environment only. Every event call is guarded: `if (APP_ENV === 'study') track(...)`.

No event may be added, renamed, removed, or have its properties changed without updating this file in the same commit.

## Events

| Event | Trigger | Properties |
| --- | --- | --- |
| `app_open` | App visible after cold launch or backgrounded >30 min | `standalone` bool, `platform` string |
| `setup_completed` | First Save on add practices | `practices` slug[], `instance_count` int, `distinct_count` int |
| `onboarding_completed` | Done on the reminders step of setup | `reminder_enabled` bool, `practice_count` int, `notification_permission` string |
| `practices_changed` | Later Save when list changed | `added` `{practice_id, instance}[]`, `removed` same, `total_after` int |
| `practice_started` | Play tapped | `practice_id`, `instance`, `kind` |
| `practice_quit` | Leave session confirmed | `practice_id`, `instance`, `elapsed_seconds`, `total_seconds` |
| `practice_unticked` | A checkbox tick taken back within its first minute; the `practice_completed` row is deleted | `log_id`, `practice_id`, `instance`, `minutes`, `local_date`, `backtrack` bool |
| `reminder_set` | Set time confirmed | `slot` int\|null, `kind`, `practice_id`\|null, `time_local`, `was_enabled_before` bool |
| `reminder_disabled` | Reminder toggled off | `slot`\|null, `kind`, `time_local` |
| `reminder_delivered` | SW shows notification **and an app window is open** — undercounts; use `reminder_sends.delivered_at` for the real number | `slot`\|null, `kind` |
| `reminder_tapped` | SW notificationclick | `slot`\|null, `minutes_since_delivered` int |
| `sync_failed` | Queue flush fails after retries | `queued_count` int, `error` string |

## Reminder delivery (not an event)

Every push attempt is a row in `reminder_sends`, written by the `send-reminders` edge function: `status` (`sent` / `failed` / `expired`), `local_date`, and a snapshot of the reminder. The service worker reports back through two anon-key RPCs, `mark_reminder_delivered` and `mark_reminder_tapped`, keyed by the `send_id` carried in the push payload, so `delivered_at` and `tapped_at` are filled in even when the app is closed. Receipts that fail to post are queued in the worker's IndexedDB and retried on the next push or app open.

## Not tracked

- Practice-completed analytics event (`practice_completed` is a table)
- Screen views, funnel steps, permission prompt outcomes (stored on `participants`)

## Participant fields

| Field | Set when |
| --- | --- |
| `platform` | First `app_open` |
| `installed_standalone` | Any `app_open` where standalone; never set false |
| `notification_permission` | Every `app_open` |
| `onboarding_completed_at` | Done on the reminders step of setup; written only where still null, so the first device to finish (or the migration 008 backfill) keeps the real moment. Read back on restore so a second device skips setup. |
| `segment` | Manual in Supabase |
