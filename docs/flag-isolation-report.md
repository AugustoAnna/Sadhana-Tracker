# Flag isolation report — Phase 1 (§6.3)

Study build (`VITE_APP_ENV=study`). Each flag assessed on five vectors.

## sessions

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | `/session/select`, `/session/review` not registered |
| Entry points | pass | No start-session or saved-session UI on `PracticeHome` |
| Data | pass | `saveSession` no-ops; `saved_sessions` sync skipped |
| Background | pass | No session-specific SW tasks |
| Empty states | pass | No session section headers |

## invocation

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | No invocation routes (player always on for guided practices) |
| Entry points | pass | `includeInvocation` never set true from `PracticeHome` |
| Data | pass | No invocation rows written |
| Background | pass | `precacheInvocation` skipped on reminders setup |
| Empty states | pass | Invocation UI removed from player |

## journey

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | `/level-up`, `/journey` not registered |
| Entry points | pass | No journey row or level-up on `PracticeHome` |
| Data | pass | `logPractice` skips level computation when flag off |
| Background | pass | No journey notifications |
| Empty states | pass | No journey section headers |

## postPracticeContent

| Vector | Status | Note |
| --- | --- | --- |
| Routes | partial | `/post-practice` remains — study spec §7.7 requires simplified screen |
| Entry points | pass | No quote/audio/video controls |
| Data | pass | No extra post-practice content stored |
| Background | pass | — |
| Empty states | pass | Placeholder image only |

## potentialMeditatorPath

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | Old onboarding screens deleted; `/onboarding/*` → welcome |
| Entry points | pass | No type/duration/status onboarding |
| Data | pass | Profile fields remain in DB but unused in flow |
| Background | pass | — |
| Empty states | pass | — |

## denominator

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | No denominator routes |
| Entry points | pass | No targets, percentages, or “3 of 5” UI |
| Data | pass | — |
| Background | pass | — |
| Empty states | pass | — |

## mandala

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | Demo mode is overlay, not a route |
| Entry points | pass | `DemoModeIndicator` hidden when flag off |
| Data | pass | Demo DB not activated without mandala entry |
| Background | pass | — |
| Empty states | pass | — |

## detailLogging

| Vector | Status | Note |
| --- | --- | --- |
| Routes | pass | No detail-logging routes |
| Entry points | pass | No cycles/holding-time UI |
| Data | pass | — |
| Background | pass | — |
| Empty states | pass | — |

## Tests

- `src/app/routeFlags.test.ts` — one assertion per gated route (404 when flag off)
- `src/screens/PracticeHome.test.tsx` — entry points absent for sessions/journey; no `practice-so-far` link

Run: `npm test`
