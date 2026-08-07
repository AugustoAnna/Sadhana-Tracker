# Implementation Checklist

> Updated as work progresses. Resume from first unchecked item.

## Foundation
- [x] Vite + React + TS + Tailwind scaffold
- [x] PWA plugin + manifest
- [x] Router + landing rules
- [x] Dexie schema + repositories
- [x] Zustand stores
- [x] Practice catalogue (R1, R2, R3)
- [x] Journey threshold engine (R4)
- [x] Heat map utilities (R5)
- [x] Mock Supabase sync service

## Shared components
- [x] Button, TextInput, BackHeader
- [x] Checkbox (animated), PlusButton, PlayButton
- [x] Toggle, StickyAction, BottomSheet
- [x] TimePicker, MinutePicker
- [x] Modal, Toast
- [x] ProgressRing, ProgressBar, PlantVisual
- [x] PracticeCard, HeatMap, WeekStrip

## Screens
- [x] 1 — Onboarding name
- [x] 2 — Onboarding practice status
- [x] 3 — Onboarding reminder permission
- [x] 4 — App home (static + Practices card)
- [x] 5 — Practice home (empty / partial / main)
- [x] 6 — Edit practices
- [x] 7 — Settings
- [x] 8 — Practice reminders
- [x] 9 — Session selection
- [x] 10 — Review session
- [x] 11 — Practice player
- [x] 12 — Post-practice
- [x] 13 — Level up
- [x] 14 — Journey
- [x] 15 — Your practice so far

## System behaviour
- [x] Offline-first writes + sync queue
- [x] Service worker audio cache (structure in place)
- [x] Invocation audio precache (placeholder)
- [x] Push notification reminders (basic Notification API)
- [x] Day boundary handling
- [x] Deferred journey animation
- [x] Level up once per day rule

## Placeholders (awaiting assets)
- [ ] Plant visuals 0–16 (SVG placeholders in use)
- [ ] Practice illustrations (47) (generic placeholder in use)
- [ ] Guided audio files
- [ ] Invocation audio
- [ ] Post-practice still image
- [ ] Level labels 8–16
- [x] Supabase client + sync service wired
- [x] SQL migration schema (`supabase/migrations/`)
- [x] `.env.example` + `SUPABASE.md` setup guide
- [ ] Supabase project created and migration applied (manual step)
- [ ] `.env.local` filled with real credentials

## First draft gaps to refine
- [ ] Player invocation open/close flow
- [ ] Recent sessions from history (only saved sessions shown)
- [ ] Audio download progress on Added section
- [ ] Figma fidelity pass when node IDs available
- [ ] SW-based scheduled notifications (currently setTimeout fallback)
