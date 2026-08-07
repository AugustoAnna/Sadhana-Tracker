# Sadhana Tracker PWA

A progressive web app for logging spiritual practice, built for a four-week diary study.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 on a mobile viewport (portrait).

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- Dexie (IndexedDB) for offline persistence
- Zustand for state
- vite-plugin-pwa for service worker
- Mock Supabase sync (awaiting credentials)

## Docs

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — architecture and data model
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) — build progress
- [DESIGN.md](./DESIGN.md) — design tokens and component inventory

## Placeholders (awaiting assets)

- Supabase URL and anon key
- Practice illustrations (47)
- Plant visuals (levels 0–16)
- Level labels 8–16
- Guided practice audio files
- Invocation audio
- Post-practice still image
- Ardhasiddhasana default minutes (using 20)

## Install as PWA

On iOS Safari: Share → Add to Home Screen
On Android Chrome: Menu → Install app

## Push to GitHub

The repo is committed locally on `main`. To publish:

```bash
# 1. Create a new repo at https://github.com/new (name: sadhana-tracker)
# 2. Then run:
git remote add origin https://github.com/YOUR_USERNAME/sadhana-tracker.git
git push -u origin main
```

Or with GitHub CLI (after `winget install GitHub.cli` and `gh auth login`):

```bash
gh repo create sadhana-tracker --public --source=. --push
```

## Supabase

See [SUPABASE.md](./SUPABASE.md) for setup. Quick version:

1. Create a Supabase project
2. Run `supabase/migrations/20260807100000_initial_schema.sql` in the SQL Editor
3. Copy `.env.example` → `.env.local` and add your URL + anon key
4. Restart `npm run dev`
