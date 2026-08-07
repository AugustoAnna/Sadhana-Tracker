# Sadhana Tracker PWA — Implementation Plan

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript | Ecosystem, PWA support, team familiarity |
| Build | Vite + vite-plugin-pwa | Fast dev, Workbox service worker |
| Routing | React Router v6 | Screen-based navigation per spec |
| Styling | Tailwind CSS | Rapid mobile-first UI from screenshots |
| Local state | Zustand | Lightweight, works offline |
| Persistence | Dexie (IndexedDB) | Full offline, optimistic writes |
| Remote sync | Mock Supabase client | Real client wired later; queue syncs now |
| Drag & drop | @dnd-kit/core | Session reorder |
| Date utils | date-fns | Day boundaries, streaks, heat map |

## Architecture

```
src/
├── app/              # Router, providers, bootstrap
├── components/       # Shared UI (buttons, sheets, pickers, cards)
├── data/             # Catalogue, journey formula, constants
├── db/               # Dexie schema, repositories
├── hooks/            # useJourney, useToday, useReminders, etc.
├── screens/          # One folder per screen (1–15)
├── services/         # sync (mock), audio cache, notifications
├── stores/           # Zustand slices
├── types/            # Domain types
└── utils/            # Date, heat map, formatting
```

## Data model

### Dexie tables

| Table | Key fields |
|---|---|
| `profile` | `id` (singleton), `name`, `isMeditator`, `onboardingComplete`, `instanceEducationShown` |
| `practiceInstances` | `id`, `practiceId`, `instanceNumber`, `order`, `addedAt` |
| `practiceLogs` | `id`, `practiceId`, `instanceId`, `minutes`, `timestamp`, `source` (`manual` \| `player`) |
| `reminders` | `id` (1–3), `time`, `enabled` |
| `savedSessions` | `id`, `name`, `practiceInstanceIds[]`, `lastUsedAt` |
| `syncQueue` | `id`, `table`, `operation`, `payload`, `createdAt` |
| `appState` | `lastLevelUpDate`, `dndPromptDismissed` |

### Practice log shape (future-proof per spec)

```ts
{ practiceId, instanceId, minutes, timestamp, source }
```

### Journey

- `threshold(level) = Math.round(21 * level^2.6)`
- Current level = highest level where `totalMinutes >= threshold`
- Invocation minutes excluded
- Levels 1–16 = Phase 1 "Roots"

### Supabase mock

Tables to create when credentials arrive: `participants`, `practice_logs`, `practice_instances`. Sync service drains `syncQueue` on reconnect.

## Navigation map

```
/                          → landing rules (redirect)
/onboarding/name           → Screen 1
/onboarding/status         → Screen 2
/onboarding/reminder       → Screen 3
/app-home                  → Screen 4 (static + Practices card)
/practice-home             → Screen 5 (empty | partial | main)
/practices/edit            → Screen 6
/settings                  → Screen 7
/reminders                 → Screen 8
/session/select            → Screen 9
/session/review            → Screen 10
/player                    → Screen 11
/post-practice             → Screen 12
/level-up                  → Screen 13
/journey                   → Screen 14
/practice-so-far           → Screen 15
```

## Service worker responsibilities

1. App shell precache (vite-plugin-pwa)
2. Audio on-demand cache (Cache API, keyed by practiceId)
3. Invocation audio precached on onboarding complete
4. Push notifications for reminders (scheduled via SW; fallback prompt if unavailable)

## Design approach

Screenshots are reference only (no Figma nodes). Colours approximated:
- Background: `#FDFBF5`
- Primary teal: `#0D8A7A`
- Dark header: `#1A2B2B`
- Journey accent: `#C4783A`
- Serif headings (Fraunces), sans body (DM Sans)

Placeholders: plant SVGs, practice illustrations (generic circle), audio files, post-practice image.

## Assumptions (first draft)

| Item | Assumption |
|---|---|
| Level labels 8–16 | `Level N — TBD-PM` |
| Level labels 1–7 | From screenshot reference |
| Ardhasiddhasana minutes | 20 (timed, placeholder) |
| Post-practice min duration | 5 seconds |
| Recent sessions | Last 3 distinct session orderings from player history |
| Explore all practices | Navigates to edit practices screen |
| Name screen copy | From screenshot |
| DND modal | Out of scope (spec); player opens directly |

## Build order (single pass)

1. Scaffold + design tokens
2. Data layer + journey engine
3. Onboarding flow
4. Practice home (all 3 states) + edit practices
5. Settings + reminders
6. Sessions + player + post-practice + level up
7. Journey + practice so far + app home card
8. Service worker + notification scheduling
