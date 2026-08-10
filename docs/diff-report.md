# Diff report — codebase vs Build Specification v3

**Generated:** Phase 0 (pre-implementation)  
**Scope:** Spec sections §6 (Removals), §7 (Screens), §8 (Practice calendar), §9 (Offline and sync)  
**Authority:** `pwa-build-spec-v3.md` supersedes all earlier specs.

---

## Summary

The codebase has a **study-oriented skeleton** from an earlier build pass: welcome flow, feature flags, route gating, and a week-based progress grid. It is **not yet aligned with v3** in several critical areas: the calendar component model, backend schema/sync, instrumentation, web-push reminders, UI corrections, and several §6.1 deletions. Two Vercel projects are **not yet configured** (documented in `docs/vercel-deployments.md`).

**Recommendation:** Approve Phase 1 (removals + flag isolation) before building on the current calendar or sync layer.

---

## §6 · Removals

### Requirements already satisfied

| Item | Evidence |
| --- | --- |
| Feature-discovery bottom sheets removed from active UI | No `FeatureDiscovery` references in `src/` |
| Explore all practices / Start here / Your next practices / Recently practiced removed | Not present in `PracticeHome.tsx` |
| App home screen removed from flow | `/app-home` redirects to `/practice-home` in `router.tsx` |
| Settings screen not routed | No `/settings` route |
| Old meditator onboarding funnel not routed | `/onboarding/*` redirects to `/welcome` |
| `features.ts` exists with lab vs study sets | `src/features.ts` + `src/config/environment.ts` |
| Flagged routes wrapped in `FeatureGate` | Sessions, journey, level-up gated in `router.tsx` |
| Timed practices: no second instance in add flow | `EditPractices.tsx` hides row after one add for `type === 'timed'` |
| Second-instance education sheet (partial) | Bottom sheet exists after first add |

### Requirements not satisfied

| Item | Gap |
| --- | --- |
| **§6.1 — Delete My practice progress detail screen** | `PracticeSoFar.tsx` still exists; `/practice-so-far` routed; `PracticeHome` section is tappable and navigates there |
| **§6.1 — Delete second instances for timed practices** | Add flow correct; need to verify no timed second instance can exist in store/DB from legacy data |
| **§6.2 — `features.ts` exactly as spec** | Spec shows a single `FEATURES` export with all `false`; implementation uses `LAB_FEATURES` / `STUDY_FEATURES` toggle — functionally OK for two deploys but not literal match |
| **§6.3 — Routes unreachable by URL** | `FeatureGate` **redirects** to `/practice-home`, not 404 — fails V56/V57 intent |
| **§6.3 — Isolation tests** | No test framework; no per-flag route/entry-point tests |
| **§6.3 — Player route** | `/player` and `/post-practice` always registered (study uses player for guided practices — OK, but session/multi-practice paths need review) |
| **Flag isolation — data** | Sync still writes `saved_sessions`, old schema tables when configured |
| **Flag isolation — background** | `scheduleReminders()` uses `setTimeout` in main thread, not service worker push |

### Present in code but not mentioned in spec (assess for removal)

| Item | Location | Assessment |
| --- | --- | --- |
| Demo mode / mandala indicator | `demoMode.ts`, `DemoModeIndicator` | Lab-only QA tool; keep behind `mandala` flag or remove for study |
| `OnboardingName` export | `screens/index.ts` | Dead export; delete with §6.1 cleanup |
| Old profile fields (`isMeditator`, `drawnToType`, `durationPreference`, `featureDiscoveryStep`, `trackerIntroSeen`) | `types/index.ts`, `db/index.ts` | Legacy; remove when backend migrates |
| `startHere.ts` data module | `src/data/startHere.ts` | Discovery/ladder logic; delete if unused (grep shows no imports in active screens) |
| Invocation phases in player | `PracticePlayer.tsx` | Flag `invocation` off but player code still contains invocation state machine |
| `savedSessions` table + sync | `db`, `sync.ts` | Sessions feature; should not sync in study |
| `MonthHeatMap` / `heatmap.ts` (if present) | — | Superseded by §8 calendar; remove if unused |
| `device_id` participant model | `sync.ts`, `deviceId.ts` | Pre-v3; replace with anonymous auth + `auth_user_id` (§2) |
| `getWeekDays()` deprecated helper | `dates.ts` | Still used by `getWeekMinutes`; audit |

### Cannot determine without running the app

| Item | Why |
| --- | --- |
| Whether flagged URLs are reachable in practice | Need browser test: `/session/select`, `/journey`, `/level-up` on study build |
| Empty section headers under flags | Visual pass on study deploy |
| Whether old onboarding files cause bundle/import side effects | Build + route smoke test |
| Instance education sheet timing | UX test on first add |

---

## §7 · Screens

### Requirements already satisfied

| Screen / behaviour | Status |
| --- | --- |
| Welcome illustration cluster + headline | Mostly — headline matches; cluster uses square illustrations |
| Welcome CTA → name | Routed `/welcome` → `/welcome/name` |
| Name field label above input | `TextInput` with `label="Your name"` |
| Continue disabled until name entered | Implemented |
| Stored name skips onboarding | `LandingRedirect` → `/practice-home` when complete |
| Four-step setup path (welcome → name → add → reminders → practices) | Guard logic supports this |
| Add practices: commonly practiced + all other (collapsible) | `EditPractices.tsx` |
| Add / Add again row actions | Implemented |
| Instance suffix 1 in My practices, 2 on row | Via `getInstanceSuffix` |
| Sticky footer counter animation | `ConfirmFooter` with `animate-[scale-bump]` |
| CTA disabled until ≥1 practice | `disabled={instances.length === 0}` |
| Reminders: three generic slots, card tap opens time sheet | `Reminders.tsx` |
| Reminder 1 enabled by default | Seeded in `initDB` (verify time TBD-PM) |
| Practice home: Today stats, practice list, progress section | `PracticeHome.tsx` |
| Checkbox → record → green checkmark (no box) | `PracticeCard.tsx` |
| Plus opens minutes sheet | Implemented |
| Play opens player (guided) or minutes then player (timed) | Implemented |
| Post-practice: skip, continue after delay, no level-up | `PostPractice.tsx` |

### Requirements not satisfied

| Screen / behaviour | Gap |
| --- | --- |
| **Welcome subhead** | Spec: “Track what you practice.” — Code: “Track what you practice. **Watch it build.**” |
| **Name headline** | Spec: “Put a name to your practice” — Code: “**What should we call you?**” (⊘ uses “we”) |
| **Add practices title** | Section header “My practices” when collapsed — verify copy on screen title vs sections |
| **Save CTA** | Spec: “Save” — `ConfirmFooter` default label is “**Confirm**” |
| **Cap message** | Spec: “You can add up to 21 practices.” — Code: “Maximum of 21 practices reached…” |
| **My practices collapsed by default** | `addedOpen` initial state is `true` |
| **Education sheet body** | Spec copy differs slightly; visual 1/2 reference present |
| **Reminders description** | Spec: “Set up to three reminders…” — Code: “Up to three reminders…” |
| **Sadhguru's Presence reminder** | Not implemented — no practice-specific row |
| **Web push reminders** | `notifications.ts` uses `setTimeout` + `Notification` API — **not** service worker push (⊘ V41) |
| **Practices header: no chevron** | `BackHeader` always renders back button; `PracticeHome` passes no `onBack` but chevron still shows |
| **Pen icon teal** | `text-ink` stroke, not primary/teal |
| **Section header “My practices”** | Middle section labeled “**Practices**” not “My practices” |
| **Checkbox/plus teal outline** | Uses `border-border`, not teal |
| **Metadata: timed copy** | Spec: “{n} **minutes practiced so far**” — Code: “{n} min **practiced today**” |
| **Minutes sheet title** | Spec: “How long did you practice?” — Code: “**Add minutes**” |
| **Minutes sheet CTA** | Spec: “Add” — Code: “**Confirm**” |
| **Minutes sheet: no context line** | Extra line: “This value applies to one session…” |
| **Progress: three stat boxes** | `ProgressStatBoxes` has **2** boxes (days, minutes) — **missing streak** |
| **Progress: inline calendar** | Section navigates to `/practice-so-far` instead of inline full calendar + legend |
| **Anonymous sign-in on welcome** | Not implemented |
| **Sentence case audit** | “My Practice Progress” uses title case on section header |
| **Player leave sheet copy** | Verify against §7.6 — may still mention multi-practice/session |
| **Mark completed when audio missing** | Need runtime verify |

### Present in code but not in spec

| Item | Notes |
| --- | --- |
| `BackHeader` `dark` variant on Practices | Spec shows cream/header treatment TBD-PM |
| Row opacity on completed non-timed | Spec: list never dims — `opacity-55` on completed rows |
| `precacheInvocation()` on reminder finish | Invocation flagged off |

### Cannot determine without running the app

| Item | Why |
| --- | --- |
| Name continue visible above keyboard on all devices | `visualViewport` logic present; needs iOS Safari test |
| Streak behaviour when today empty | `getCurrentStreak()` exists in `dates.ts` but **not wired to UI** |
| Player auto-advance at 0:00 | Timer logic needs device test |
| Audio continues when screen locks | Needs mobile test |
| Permission prompt → confirmation → dismiss | State machine in `Reminders.tsx`; needs test |

---

## §8 · Practice calendar

### Requirements already satisfied

| Item | Status |
| --- | --- |
| Monday-first week concept | `weekStartsOn: 1` in `weekProgress.ts` |
| Twelve heat bands defined | `HEAT_MAP_COLORS` in `constants.ts` matches §8.5 hex values |
| Per-cell accessible name with date + minutes | `DayCell` `aria-label` in `WeekProgressGrid.tsx` |
| `getCurrentStreak()` with “exclude today if empty” logic | `dates.ts` lines 40–55 — **correct algorithm, not displayed** |

### Requirements not satisfied

| Item | Gap |
| --- | --- |
| **Grid model: columns = weeks within month blocks** | Current component is **row-per-week** going back in history — wrong layout |
| **Only current month** | Renders multiple weeks/months back |
| **Only elapsed days in current month** | Renders future days in week rows; “before-tracking” grey cells |
| **Rounded squares** | `rounded-full` circles |
| **No × marks** | `no-practice` state renders **×** character |
| **Base cell colour `#E6E4E0`** | Uses `#FAF8F4` / border / grey variants |
| **Band 1 vs base distinguishable** | Empty day styling may conflate with 1–10 min band |
| **Fixed left gutter + horizontal scroll** | No gutter scroll split; grid is vertical stack |
| **Month label row above grid** | Week row labels (“This week”, “Last week”, month name) — wrong |
| **Month block gap ~4× cell gap** | Not implemented |
| **Geometry ratios (26px cell, 6px gap, etc.)** | Uses 28/32px compact sizes ad hoc |
| **Legend: single 12-segment bar, 0 and 240+ only** | `HeatLegend` uses **individual swatches with per-band labels** |
| **Single tab stop for grid** | Per-cell divs, not one focusable grid |
| **No min/week column** | Column present in week-row model — wrong component entirely |
| **Component used once on Practices** | Also used on `PracticeSoFar` detail screen (to be deleted) |

### Present in code but not in spec

| Item | Notes |
| --- | --- |
| `maxRows={5} compact` on home preview | Spec: full calendar inline, not truncated preview |
| `getHeatMapColor` zero band `#FFFFFF` | Spec base cell is `#E6E4E0`, not white |

### Cannot determine without running the app

| Item | Why |
| --- | --- |
| Band 1 visibly distinct from base | Colour contrast needs screenshot |
| Horizontal scroll when history grows | No month-block scroll built yet |
| First-day participant (V35) | Edge case render test |

---

## §9 · Offline and sync

### Requirements already satisfied

| Item | Evidence |
| --- | --- |
| Local-first storage (Dexie) | `SadhanaDB` with profile, instances, logs, reminders |
| Optimistic UI on log | `appStore.logPractice` updates state immediately |
| Sync queue in IndexedDB | `syncQueue` table; `queueSync` persists items |
| Queue drains on `online` event | `initSyncListener` |
| PWA service worker + audio runtime cache | `vite.config.ts` workbox + CacheFirst for `/audio/` |
| `localDate` on `PracticeLog` type | `types/index.ts` |

### Requirements not satisfied

| Item | Gap |
| --- | --- |
| **Supabase anonymous auth** | No `signInAnonymously`; uses `device_id` |
| **`practice_completed` table** | Sync targets `practice_logs` with wrong columns (`source`, `instance_id`, no `local_date`, no `mode`, no `was_offline`) |
| **`environment` on every insert** | Not sent in `sync.ts` |
| **`events` table + shared queue** | No event tracking or queue type |
| **`participant_practices` sync** | Syncs `practice_instances` with old shape |
| **Participant profile fields** | Missing `platform`, `installed_standalone`, `notification_permission`, `segment` |
| **RLS** | Not verified / likely not applied |
| **No offline indicator** | Spec compliant if true — verify none added |
| **Audio cache on practice add with progress** | `precacheInvocation` only; per-practice on-add not verified |
| **Queue survives restart** | Dexie persistence likely OK — **not verified** (V26) |
| **Duplicate-free sync** | Upsert by id assumed; **not verified** (V24) |
| **Web push for reminders** | In-app `setTimeout` only — fails §7.4.12 and §9 |

### Present in code but not in spec

| Item | Notes |
| --- | --- |
| `saved_sessions` sync | Out of scope for study |
| `demoMode` separate IndexedDB | Lab QA |
| `syncFullState` re-queues everything on launch | May duplicate if server schema mismatches |

### Cannot determine without running the app

| Item | Why |
| --- | --- |
| Full offline load (V25) | Needs airplane mode test |
| Queue after force-quit (V26) | Needs device test |
| Sync without duplicate (V24) | Needs network toggle + Supabase inspect |
| Audio precache size (V13) | Needs asset inventory |

---

## Cross-cutting gaps (sections §6–§9)

| Area | Priority | Notes |
| --- | --- | --- |
| Calendar rebuild | **High** | Wrong component; do not iterate on `WeekProgressGrid` |
| Delete `PracticeSoFar` + inline calendar | **High** | §6.1 + §7.5 |
| Backend schema + auth | **High** | Blocks V1–V9, instrumentation, RLS |
| Web push + SW events | **High** | Blocks V41, V42, reminder reliability |
| UI correction pass | Medium | Teal controls, copy, padding, no chevron |
| Instrumentation | Medium | §3 — separate phase but depends on backend |
| Two Vercel projects | Medium | Doc ready; dashboard setup required |
| Flag 404 tests | Medium | Phase 1 deliverable |

---

## TBD placeholders already in code

| Location | Placeholder |
| --- | --- |
| `PostPractice.tsx` | “TBD — placeholder image” |
| `docs/vercel-deployments.md` | Study and lab URLs TBD-PM |
| Spec §11 | Reminder times, post-practice duration, Ardhasiddhasana minutes, Shambhavi audio decode |

---

## Suggested Phase 1–5 order (for approval)

1. **Phase 1** — Delete `PracticeSoFar`, dead onboarding exports, discovery data; fix `FeatureGate` → 404; flag isolation report + tests  
2. **Phase 2** — Supabase schema migration, anonymous auth, sync rewrite  
3. **Phase 3** — Illustration mapping (**stop** for review)  
4. **Phase 4** — Screen copy + UI corrections (§7)  
5. **Phase 5** — New calendar component from scratch per §8 (replace `WeekProgressGrid`)

**Phase 0 complete. Awaiting review before Phase 1.**
