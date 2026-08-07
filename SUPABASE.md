# Supabase Setup

**Project:** `sadhana tracker` (`eevoabfiyzsfoberzsom`)  
**Region:** ap-southeast-2 (Sydney)  
**URL:** https://eevoabfiyzsfoberzsom.supabase.co

Schema applied via MCP on 2026-08-07. Legacy prototype tables preserved as `*_legacy`.

## Local config

`.env.local` is configured with project credentials (gitignored). To recreate:

```bash
cp .env.example .env.local
```

Fill from **Project Settings → API** in the [Supabase dashboard](https://supabase.com/dashboard/project/eevoabfiyzsfoberzsom/settings/api).

## Tables

| Table | Purpose |
|---|---|
| `participants` | Name, meditator status, onboarding flags |
| `practice_instances` | Practices added to the participant's list |
| `practice_logs` | Every logged practice session |
| `reminders` | Up to 3 reminder slots |
| `saved_sessions` | Named session shortcuts |

Legacy tables (`device_sessions_legacy`, `practice_logs_legacy`, `analytics_events_legacy`) are preserved from the earlier prototype.

## Migrations

Applied remotely via Supabase MCP. Local SQL mirror:

```
supabase/migrations/20260807100000_initial_schema.sql
```

## Security note

RLS policies are permissive for the study pilot (no auth). Tighten before wider release.
