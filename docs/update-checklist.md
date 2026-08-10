# Sadhana Tracker — v3 update checklist

Status: **partial** — Phase 0 complete; awaiting review before Phase 1.

Legend: `done` · `partial` · `blocked` · `pending`

## Phase 0 — Diff report

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 0.1 | Read codebase against v3 spec | done | See `docs/diff-report.md` |
| 0.2 | Diff report for spec §6–§9 | done | `docs/diff-report.md` |
| 0.3 | Stop for review before Phase 1 | done | Waiting on PM |

## Phase 1 — Removals and flags (§6)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 1.1 | Delete §6.1 items outright | done | 16 files deleted; detail route returns 404 |
| 1.2 | `features.ts` exactly as §6.2 | done | `STUDY_FEATURES` matches spec; lab enables all |
| 1.3 | Gate at route + entry point only | done | Routes conditionally registered; no `FeatureGate` redirect |
| 1.4 | Shared primitives unaware of flags | done | `PracticeCard` unchanged; player wraps session UI |
| 1.5 | Isolation checklist per flag | done | `docs/flag-isolation-report.md` |
| 1.6 | One test per flag (routes 404, no entry points) | done | `routeFlags.test.ts` + `PracticeHome.test.tsx` |

## Phase 2 — Backend (§2)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 2.1 | Schema `practice_completed`, `events`, participant fields | partial | Migration draft uses `practice_logs`, missing `events` and profile fields |
| 2.2 | Anonymous auth on first launch | pending | Uses `device_id`, not `auth.users` |
| 2.3 | RLS on all user tables | pending | Not applied |
| 2.4 | Analysis views §2.5 | partial | Views exist but reference old table names |
| 2.5 | Seed `practices` from §5 | pending | Local catalogue only |
| 2.6 | Vercel env on both projects | partial | Documented in `docs/vercel-deployments.md`; projects not created in this session |
| 2.7 | `APP_ENV` read once at module load | done | `src/config/environment.ts` |
| 2.8 | `local_date` on all day logic | partial | Field exists; some utils still fall back to `timestamp` |
| 2.9 | Verification V1–V9 | pending | Not executed |

## Phase 3 — Assets (§4)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 3.1 | `docs/illustration-mapping.md` | pending | **Stop point** — needs Drive folder access |
| 3.2 | `practices.audio_path` from program JSONs | pending | |
| 3.3 | `kind` = guided only where audio exists | pending | |
| 3.4 | Total audio size report | pending | |
| 3.5 | Shambhavi decode or report unguided | blocked | TBD-PM |

## Phase 4 — Screens and UI (§7)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 4.1 | Welcome copy | partial | Subhead still “Watch it build.” |
| 4.2 | Name screen copy + keyboard-safe CTA | partial | Headline uses “we”; layout OK |
| 4.3 | Add practices copy/behaviour | partial | “Confirm” not “Save”; My practices expanded by default |
| 4.4 | Reminders + Sadhguru Presence slot | partial | Generic slots only; in-app timers not web push |
| 4.5 | Practices screen layout + controls | partial | Chevron on header; pen not teal; checkbox not teal |
| 4.6 | Progress stats (3 boxes incl. streak) | partial | 2 boxes; no streak in UI; links to detail screen |
| 4.7 | Player + post-practice | partial | Invocation phases remain; copy mostly OK |

## Phase 5 — Practice calendar (§8)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 5.1 | Month-column grid (not week rows) | pending | Current `WeekProgressGrid` is wrong model |
| 5.2 | Rounded squares, no × marks | pending | Circles + × marks today |
| 5.3 | Current month, elapsed days only | pending | Multi-week history grid |
| 5.4 | Twelve-band colours + bar legend | partial | Colours in constants; legend is per-swatch |
| 5.5 | Accessibility per §8.6 | partial | Per-cell labels exist; grid not single tab stop |

## Phase 6 — Instrumentation (§3)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 6.1 | Nine events, study only | pending | No `track()` implementation |
| 6.2 | `docs/instrumentation.md` | pending | |
| 6.3 | `/instrumentation` route (lab only) | pending | |
| 6.4 | Participant fields on `participants` | pending | |
| 6.5 | Persisted offline queue for events | pending | Records queue in Dexie; no events |
| 6.6 | SW `reminder_delivered` / `reminder_tapped` | pending | No web push handlers |

## Phase 7 — Verification (§10)

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| 7.1 | V1–V62 reported | pending | None executed in this session |

## Infrastructure

| # | Requirement | Status | Note |
| --- | --- | --- | --- |
| I.1 | Two Vercel projects (study + lab) | done | Projects created by PM; see `docs/vercel-deployments.md` |
