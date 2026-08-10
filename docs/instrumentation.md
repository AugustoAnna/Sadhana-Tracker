# Instrumentation — Sadhana Tracker study build

Study environment only. Every event call is guarded: `if (APP_ENV === 'study') track(...)`.

No event may be added, renamed, removed, or have its properties changed without updating this file in the same commit.

## Events

| Event | Trigger | Properties |
| --- | --- | --- |
| `app_open` | App visible after cold launch or backgrounded >30 min | `standalone` bool, `platform` string |
| `setup_completed` | First Save on add practices | `practices` slug[], `instance_count` int, `distinct_count` int |
| `practices_changed` | Later Save when list changed | `added` `{practice_id, instance}[]`, `removed` same, `total_after` int |
| `practice_started` | Play tapped | `practice_id`, `instance`, `kind` |
| `practice_quit` | Leave session confirmed | `practice_id`, `instance`, `elapsed_seconds`, `total_seconds` |
| `reminder_set` | Set time confirmed | `slot` int\|null, `kind`, `practice_id`\|null, `time_local`, `was_enabled_before` bool |
| `reminder_disabled` | Reminder toggled off | `slot`\|null, `kind`, `time_local` |
| `reminder_delivered` | SW shows notification | `slot`\|null, `kind` |
| `reminder_tapped` | SW notificationclick | `slot`\|null, `minutes_since_delivered` int |
| `sync_failed` | Queue flush fails after retries | `queued_count` int, `error` string |

## Not tracked

- Practice-completed analytics event (`practice_completed` is a table)
- Screen views, funnel steps, permission prompt outcomes (stored on `participants`)

## Participant fields

| Field | Set when |
| --- | --- |
| `platform` | First `app_open` |
| `installed_standalone` | Any `app_open` where standalone; never set false |
| `notification_permission` | Every `app_open` |
| `segment` | Manual in Supabase |
