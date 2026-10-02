# Sadhana Tracker PWA

A progressive web app for logging spiritual practice, built for a four-week diary study. It works offline first: everything is stored on the device and synced to Supabase in the background.

## What it does

- **Setup**: name, meditator status, what you're drawn to, then pick practices (up to two instances of each).
- **Practice home**: tick a practice done, add minutes, or play a guided or timed practice. Shows the day's stats, total progress, a streak and a calendar that reaches back through past months.
- **Log yesterday**: a day switcher moves practice home between Today and Yesterday, so a missed log can still be added, for yesterday only. A sheet asks "did you practice yesterday?" after a gap, a one-time tip introduces the feature, and a one-time push ("Yesterday can still count") can open the app on Yesterday.
- **Journey**: minutes add up to levels (plant visuals 0–16).
- **Reminders**: generic reminders plus Sadhguru's Presence, delivered by Web Push even when the app is closed.
- **Sign-in**: anonymous by default; passwordless email code, with passkeys (Face ID / Touch ID / fingerprint) on top. An anonymous device's history merges into an existing email account.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 on a mobile viewport (portrait).

```bash
npm test          # Vitest: app, edge-function logic
npm run build     # type-check and production build
```

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Dexie (IndexedDB) for offline persistence; a sync queue pushes changes to Supabase
- Zustand for state
- vite-plugin-pwa with a custom service worker (`src/sw.ts`) for precaching, push and notification taps
- Supabase: Postgres with RLS, email-code auth, edge functions (Deno)
- Vercel hosting

## Environments

| | Study | Lab |
|---|---|---|
| Who | Diary-study participants | Internal testing |
| Branch | `main` | `lab` |
| Vercel project | Study (Production tracks `main`) | Lab (Production tracks `lab`) |
| `VITE_APP_ENV` | unset (`study`) | `lab` |

Feature work merges into `lab`; a release merges `lab` into `main`. Both environments share **one Supabase project** and every row is tagged with `environment`. Edge-function settings (secrets) therefore apply to both. See [docs/vercel-deployments.md](./docs/vercel-deployments.md).

## Supabase

Credentials live in `.env.local` (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. `npm run dev` writes to the shared project as `study` unless `VITE_APP_ENV=lab` is set. Demo mode (a local Dexie database) skips sync entirely.

### Migrations

Run in order in the SQL Editor (`002_v3_schema.sql` supersedes `001_study_build.sql`; `20260807100000_initial_schema.sql` is the pre-v3 prototype):

| Migration | Adds |
|---|---|
| `002_v3_schema.sql` | Core schema: participants, practices, logs, reminders, events, study views |
| `003_seed_practices.sql`, `003_banner_targets.sql` | Practices catalogue; banner targets |
| `004_push_subscriptions.sql` | Web Push subscriptions per device |
| `005_reminder_sends.sql` | One row per reminder push, with delivered/tapped receipts |
| `006_participant_email.sql` | Participant email for email sign-in |
| `007_merge_participants.sql` | Merging an anonymous participant into an email account |
| `008_onboarding_completed_at.sql` | When setup was finished |
| `009_practice_backtrack.sql` | `practice_completed.backtrack` / `route` for logs made for yesterday |
| `010_backtrack_push.sql` | `participants.backtrack_push_sent_at` (the one-time push) |

Run a migration before deploying the app or function that needs it. More detail in [SUPABASE.md](./SUPABASE.md).

### Edge functions

- **`send-reminders`**: called every minute by cron (`setup_cron.sql`). Sends each due reminder to every device in its environment, with a 10-minute catch-up window and `reminder_sends` as the once-per-occurrence guard. Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `BACKTRACK_PUSH_ENABLED`. With that last one set to `true`, the function sends the one-time backtracking push, for lab and study together. Keep it off until backtracking is live on `main`. The send loop is in `send.ts`, the HTTP and web-push wiring in `index.ts`.
- **`merge-anonymous-account`**: moves an anonymous device's history into the email account it signs in to.

## Docs

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): architecture and data model
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md): build progress
- [DESIGN.md](./DESIGN.md): design tokens and component inventory
- [SUPABASE.md](./SUPABASE.md): database setup and migrations
- [docs/email-otp-setup.md](./docs/email-otp-setup.md): email sign-in, with Supabase, Resend and deSEC
- [docs/vercel-deployments.md](./docs/vercel-deployments.md): the two Vercel projects
- [docs/instrumentation.md](./docs/instrumentation.md): analytics events
- [docs/next-steps.md](./docs/next-steps.md): open setup and device-testing items
- `analysis/`: engagement and reminder-conversion scripts (`analysis/pull.sh` pulls study data)

## Install as PWA

On iOS Safari: Share → Add to Home Screen. On Android Chrome: Menu → Install app. On iOS, notifications only work from the installed app.

## History

| Date | Change |
|---|---|
| 2026-08-07 | Project started: offline-first tracker, practices, journey levels, calendar |
| 2026-08-15 – 08-17 | Vercel 404 fix; practices catalogue seeded; name banner and `name_changed` event |
| 2026-08-18 – 08-21 | Web Push reminders (#6, #8); custom Sadhguru's Presence text and synced presence time (#9, #10) |
| 2026-08-18 – 08-26 | Sync reliability: no queue bloat, bootstrap never blocked, records no longer fail silently, evicted local databases restored from the server (#7, #11, #16, #17) |
| 2026-08-22 – 08-23 | iOS bootstrap crash fixed; new service worker activates at once so deploys reach open apps; the day rolls over correctly at midnight (#12, #13, #15) |
| 2026-09-01 – 09-02 | Guided audio keeps playing through silent stretches; a worker update no longer reloads a practice in progress (#19, #20) |
| 2026-09-15 | Calendar reaches back through past months; Android notification tap opens the app (#21, #22) |
| 2026-09-18 | Diary-study release: setup flow, timer gating, green heatmap (#25); engagement analysis scripts (#23); Vercel deploy action (#24) |
| 2026-09-20 – 09-22 | Email-code sign-in (#27), every reminder push recorded in `reminder_sends` (#28), passkeys (#29), anonymous history merged into email accounts (#31), compact home header (#32), resend cooldown (#33), email-only returning sign-in (#34, #35), simpler blocked-notifications message (#36) |
| 2026-09-23 | Android icon crop fixed (#37); lab released to `main` (#38) |
| 2026-09-26 | Analytics: practices catalogue pulled, least-added practices scoped to real participants (#39) |
| 2026-09-30 – 10-01 | Log yesterday's practice: day switcher, missed-day sheet, discovery tip, swipe-to-dismiss sheets (#41, #42, #43); the one-time backtracking push (#44); audit clean-up (#45). In `lab`, not yet on `main` |
