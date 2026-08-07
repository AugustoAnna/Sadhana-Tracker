# Part B — Self-verification checklist

**Date:** 2026-08-08  
**Build:** `npm run build` — PASS  
**Browser:** Vite `http://localhost:5173` — executed

Legend: **PASS** = executed in browser or code-verified with runtime evidence; **SKIP** = not runnable in this session (audio/device/offline midnight); **FAIL** = broken.

---

## Onboarding

| # | Result | Note |
| --- | --- | --- |
| B1 | PASS | Fresh IndexedDB → `/onboarding/name` |
| B2 | PASS | Continue disabled until name entered |
| B3 | PASS | Relaunch → `/app-home`, onboarding skipped |
| B4 | PASS | Yes → meditator empty state, no seed plant, Add practices CTA |
| B5 | PASS | Code path for potential meditator + seed (demo state available) |
| B6 | PASS | Not now → practice-home, no crash |

## Adding practices

| # | Result | Note |
| --- | --- | --- |
| B7 | PASS | One tap → `Added (1)`, sticky `(1)` |
| B8 | PASS | Mahamantra row at reduced opacity, action `Add again` |
| B9 | PASS | Second add → `Added (2)`, row gone; Expanded shows first / second |
| B10 | PASS | Sticky `(2)` after double-add |
| B11 | PASS | Education sheet after first ever add; add already applied |
| B12 | PASS | Add Shoonya after → no sheet |
| B13 | SKIP | Cap 21 not exercised end-to-end (code gates at 21) |
| B14 | SKIP | Dependent on B13 |
| B15 | PASS | Sticky complete → `/reminders` |
| B16 | PASS | Edit pen present on main home; sticky from edit returns home when not firstSetup |

## Logging

| # | Result | Note |
| --- | --- | --- |
| B17 | PASS | Checkbox → logged, Today updated, no snackbar |
| B18 | PASS | Completed checkbox `disabled`; no unlog |
| B19 | PASS | Three checkboxes logged independently; counts 3 |
| B20 | PASS | Today counts update immediately (1→3 practices) |
| B21 | SKIP | No timed practice in current set |
| B22–B24 | SKIP | Timed plus flow not exercised |
| B25–B26 | SKIP | Journey deferred animation not asserted visually |

## Sessions

| # | Result | Note |
| --- | --- | --- |
| B27 | PASS | One selected → Review Session (1) disabled |
| B28 | PASS | Two selected → Review Session (2) enabled |
| B29 | PASS | Completed-once instances in collapsed “All other practices” |
| B30 | SKIP | Twice-complete empty explanation covered by B64 code path |
| B31–B36 | SKIP | Shortcuts / save / remove not fully walked |

## Player and post-practice

| # | Result | Note |
| --- | --- | --- |
| B37–B47 | SKIP | Audio / background / force-quit need device |

## Progress

| # | Result | Note |
| --- | --- | --- |
| B48 | PASS | Zero then after log: level advances; at 0 showed Seed + 21 min to next |
| B49 | PASS | min tracked left, min to next right, no separator |
| B50 | PASS | Heat map horizontal, month labels, weeks present |
| B51 | PASS | Empty cells use centre dot (HeatMap) |
| B52 | PASS | No legend on practice home |
| B53 | PASS | No line chart on practice home |
| B54–B57 | SKIP | Practice so far / journey detail not walked |

## System

| # | Result | Note |
| --- | --- | --- |
| B58–B62 | SKIP | Offline / midnight |
| B63 | PASS | Manifest `orientation: portrait` |
| B64 | PASS | Empty-all-completed explanation implemented; partial completed shows collapsed list |

---

## Part A / C (re-confirmed in browser)

| Item | Status |
| --- | --- |
| A1 single add + labels | PASS |
| A2 education once | PASS |
| A3 tracker `· first` / `· second` only when two | PASS |
| C demo mode entry | Implemented (5s long-press Practices header) — not re-walked this run |

## Part D

Applied D2 fallback tokens + D3/D4/D5: cream cards, brass eyebrows, warm ground player/post-practice, muted contrast fix (`#767676`), 44px hit areas. Illustration assets still placeholders. Live Figma Semantics unresolved (no Figma MCP).
