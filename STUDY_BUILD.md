# Study Build — Implementation Checklist

Supersedes change orders 01 and 02. Updated as work proceeds.

## Phase 0 — Foundations
- [x] `src/config/environment.ts` — `APP_ENV` from `VITE_APP_ENV`
- [x] `src/features.ts` — study vs lab feature flags
- [x] `supabase/migrations/001_study_build.sql` — schema + analysis views (apply manually)
- [ ] Anonymous auth on first launch
- [ ] `environment` on every insert

## Phase 1 — §3 Removals (do first)
- [x] 3.1.1 Feature-discovery sheets
- [x] 3.1.2 Explore all practices card
- [x] 3.1.3 Your next practices
- [x] 3.1.4 Start here
- [x] 3.1.5 Recently practiced
- [x] 3.1.6 App home + entry card (redirects to Practices)
- [x] 3.1.7 Practices-learnt question (routes redirect to /welcome)
- [x] 3.1.8 Type/duration onboarding (routes redirect to /welcome)
- [ ] 3.1.9 Settings screen file (file exists, unused — delete)
- [x] 3.1.10 Second instances for timed practices
- [x] Streak UI removed from tracker
- [x] §3.2 Flag isolation at router level (sessions, journey routes gated)

## Phase 2 — Setup flow (§4.1–4.3)
- [x] Welcome screen with illustration cluster
- [x] Name step (keyboard-safe continue)
- [x] Simplified onboarding: welcome → name → add practices → reminders → Practices
- [ ] Reminders: Sadhguru's Presence practice-specific slot
- [x] Web Push reminders (replace in-app timers)

## Phase 3 — Practices tracker (§4.4)
- [x] Section order: Today → Practices → My Practice Progress
- [x] Remove journey row, sticky footer, start session (study build)
- [x] Practice list: checkbox/plus/play per spec
- [x] Metadata line rules
- [x] No snackbar on log

## Phase 4 — My Practice Progress (§4.5)
- [x] Week grid: circles, M–S + min/week
- [x] Row labels: This week / Last week / month
- [x] 12-band orange intensity
- [x] Grey before tracking, × for tracked non-practice day
- [x] Full screen with legend; section shows 5 weeks max

## Phase 5 — Player & post-practice (§4.6–4.7)
- [x] Auto-return at 0:00 (existing)
- [x] Post-practice: image only, skip + timed continue; no level-up
- [x] Journey level-up gated off in study

## Phase 6 — Offline & sync (§5)
- [ ] Persist sync queue across restart
- [ ] Audio cache on practice add

## Phase 7 — Verification (§7)
- [ ] V1–V37 checklist

## Open / blocked (§8)
- Practice illustration assets — placeholder squares until received
- Guided audio manifest — pending PM
- TBD-PM: default reminder times, post-practice duration
