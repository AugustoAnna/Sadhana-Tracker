# Supabase Setup

## 1. Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Wait for the database to provision.

## 2. Run the migration

In the Supabase Dashboard → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/20260807100000_initial_schema.sql
```

Or, if you have the Supabase CLI installed:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in values from **Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |

## 4. Restart the dev server

```bash
npm run dev
```

The app syncs to Supabase automatically when online. Each device gets a `device_id` stored in localStorage — no user accounts required.

## Tables

| Table | Purpose |
|---|---|
| `participants` | Name, meditator status, onboarding flags |
| `practice_instances` | Practices added to the participant's list |
| `practice_logs` | Every logged practice session |
| `reminders` | Up to 3 reminder slots |
| `saved_sessions` | Named session shortcuts |

## Security note

RLS policies are permissive for the study pilot (no auth). Tighten before wider release.
