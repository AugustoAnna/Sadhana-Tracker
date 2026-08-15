# Supabase Setup

**Project:** `sadhana tracker` (`mmzzcigydnelnxdhmoqw`)
**URL:** https://mmzzcigydnelnxdhmoqw.supabase.co

Schema applied via SQL on 2026-08-15 (v3, `002_v3_schema.sql`).

## Local config

`.env.local` is configured with project credentials (gitignored). To recreate:

```bash
cp .env.example .env.local
```

Fill from **Project Settings → API** in the [Supabase dashboard](https://supabase.com/dashboard/project/mmzzcigydnelnxdhmoqw/settings/api).

## Tables

| Table | Purpose |
|---|---|
| `participants` | Name, platform, notification permission, segment |
| `practices` | Seeded practice catalogue |
| `participant_practices` | Practices added to the participant's list |
| `practice_completed` | Every logged practice session |
| `reminders` | Up to 3 reminder slots + practice reminders |
| `events` | Instrumentation events |

## Migrations

Applied against the live project (`mmzzcigydnelnxdhmoqw`). Local SQL mirror:

```
supabase/migrations/002_v3_schema.sql   (current, supersedes 001_study_build.sql)
supabase/migrations/001_study_build.sql (superseded)
supabase/migrations/20260807100000_initial_schema.sql (pre-v3 prototype)
```

## Security note

RLS policies are permissive for the study pilot (own-row rules on participant data; public read on `practices`). Tighten before wider release.
