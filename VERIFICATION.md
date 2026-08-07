# Part B — Self-verification checklist

**Date:** 2026-08-07  
**Build:** `npm run build` — **PASS**  
**Scope:** Parts A and C implemented; Part D not started (blocked per brief).

Legend: **PASS** = verified by code review and/or build; **MANUAL** = requires browser/device run not executed in this session; **FAIL** = known gap.

---

## Onboarding

| # | Result | Note |
| --- | --- | --- |
| B1 | MANUAL | `LandingRedirect` → `/onboarding/name` when `!profile.name`; not run in browser |
| B2 | PASS | `OnboardingName` disables Continue when name empty (code) |
| B3 | MANUAL | Relaunch persistence via Dexie; not run |
| B4 | PASS | `isMeditator: true` → empty state without seed, Add practices CTA (code) |
| B5 | PASS | `isMeditator: false` → seed + Start here with Isha Kriya (code) |
| B6 | MANUAL | Notification decline path; not run |

## Adding practices

| # | Result | Note |
| --- | --- | --- |
| B7 | PASS | Removed `pendingAdds` duplication; one `addPracticeInstance` per tap |
| B8 | PASS | Row at 50% opacity, action shows "Add again" when count === 1 |
| B9 | PASS | Second add hides row; Added shows first/second labels (computed) |
| B10 | PASS | Sticky count uses `instances.length` |
| B11 | PASS | Education sheet after first-ever add; non-blocking; add already applied |
| B12 | PASS | `instanceEducationShown` flag gates sheet; persists per profile |
| B13 | PASS | Cap at 21 disables add actions with explanation |
| B14 | PASS | Remove at cap re-enables (count drops below 21) |
| B15 | MANUAL | Empty state → edit → reminders on first setup; not run |
| B16 | MANUAL | Pen icon → edit → practice home; not run |

## Logging

| # | Result | Note |
| --- | --- | --- |
| B17 | PASS | Checkbox logs default duration; no snackbar on log |
| B18 | PASS | Checkbox `disabled` when checked; click ignored |
| B19 | MANUAL | Rapid tap animations; not run |
| B20 | PASS | Today stats derived from store on each log |
| B21 | PASS | Timed practices use PlusButton, not Checkbox |
| B22 | MANUAL | Plus → 30 min confirm; not run |
| B23 | MANUAL | Plus cumulative minutes; not run |
| B24 | PASS | Dismiss sheet without confirm does not call `logPractice` |
| B25 | MANUAL | Journey deferred animation; not run |
| B26 | MANUAL | Animation on return; not run |

## Sessions

| # | Result | Note |
| --- | --- | --- |
| B27 | PASS | Review disabled when `selected.size < 2` |
| B28 | PASS | Count shown on sticky action |
| B29 | PASS | First instance completed → hidden from primary; second in collapsed |
| B30 | PASS | Twice completed → filtered from `availableInstances` |
| B31 | PASS | Shortcut tap adds eligible practices, skips completed |
| B32 | PASS | Shortcut merges into existing `Set`, does not replace |
| B33 | PASS | Session grid shows 9 + remaining count |
| B34 | PASS | Remove confirmation modal; session-only removal |
| B35 | PASS | Start enabled when `orderedIds.length >= 1` |
| B36 | MANUAL | Save session flow; not run |

## Player and post-practice

| # | Result | Note |
| --- | --- | --- |
| B37–B47 | MANUAL | Player/level-up flows require audio and device test; not run in this session |

## Progress

| # | Result | Note |
| --- | --- | --- |
| B48–B57 | MANUAL | Journey/heatmap/chart screens; not run in this session |

## System

| # | Result | Note |
| --- | --- | --- |
| B58–B60 | MANUAL | Offline/sync; not run |
| B61–B62 | MANUAL | Midnight attribution; not run |
| B63 | PASS | PWA manifest `orientation: 'portrait'` |
| B64 | PASS | Session select shows explanation when all practices completed twice |

---

## Part A summary

| Item | Status |
| --- | --- |
| A1 Double-add | **Fixed** — removed duplicate `pendingAdds`; labels computed via `getInstanceOrdinalLabel` |
| A2 Education sheet | **Fixed** — shows once after first add; single Got it dismiss; no backdrop/X close |
| A3 Tracker labels | **Fixed** — `formatInstanceName` appends first/second only when two instances exist |

## Part C summary

| Criterion | Status |
| --- | --- |
| Hidden 5s long-press on Practices header | **Implemented** |
| State picker (5 states) | **Implemented** |
| Store swap (real ↔ demo Dexie) | **Implemented** |
| Snapshot on enter, restore on exit | **Implemented** |
| Force quit → restore real | **Implemented** via `recoverFromInterruptedDemo` |
| No Supabase sync in demo | **Implemented** via `isDemoDatabaseActive()` gate |
| Demo indicator, tap to exit | **Implemented** |
| Setup replay panel removed | **Done** |

## Part D

**Not started** — blocked until full manual Part B pass per brief.
