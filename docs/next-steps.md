# Next steps — making everything work

This guide covers what is **done in code**, what **you must configure**, and what remains **blocked on PM**.

---

## Quick status

| Area | Status | Your action |
| --- | --- | --- |
| Supabase migration `002_v3_schema.sql` | You ran it ✓ | Verify V1–V9 below |
| Study + lab Vercel deploys | Code on `main` + `lab` | Set `VITE_APP_ENV` + branch tracking per project |
| Illustrations | Code wired | Copy Drive files → `public/illustrations/` |
| Rider spec bugs B1–B6, screens C1–C11, E1–E3 | Implemented in this push | Test on device |
| Audio / altar / diya | Partial | PM assets (see §4) |
| Open TBD-PM items | Pending | PM decisions |

---

## 1. Vercel — two projects, one repo

Projects use branch-based production tracking for stable URLs:

- Study project Production tracks `main`
- Lab project Production tracks `lab`

They also differ by environment variables.

### Study project (25 participants)

| Variable | Value |
| --- | --- |
| `VITE_APP_ENV` | `study` |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key (never service role) |

**Expected behaviour:** No Journey, Sessions, or other flagged features. Instrumentation events fire.

### Lab project (internal testing)

| Variable | Value |
| --- | --- |
| `VITE_APP_ENV` | `lab` |
| Same Supabase URL + anon key | |

**Expected behaviour:** All flags on — Journey, Sessions, `/instrumentation`, etc.

### If lab looks identical to study (bug B4)

The usual cause is **`VITE_APP_ENV` missing or set to `study` on the lab project**.

1. Vercel → lab project → **Settings → Environment Variables**
2. Add or fix `VITE_APP_ENV` = `lab` for Production (and Preview if you use it)
3. **Redeploy** (env vars apply at build time, not runtime)

### Verify after deploy

| URL | Check |
| --- | --- |
| Study | No journey/session entry points |
| Lab | Journey and sessions reachable; `/instrumentation` loads |

Full detail: `docs/vercel-deployments.md`

---

## 2. Illustrations — why they were not showing

The app requests `/illustrations/{slug}.png`. Those files were **never in the repository** — only the mapping code was added.

**Fix:** Follow `docs/illustration-setup.md`:

1. Download the [Drive folder](https://drive.google.com/drive/folders/1Bj27ODTq-0kBNDdA0r-2xYPb_At_PLV2?usp=sharing)
2. Rename each file to match the practice slug (e.g. `shoonya.png`)
3. Copy into `public/illustrations/`
4. Commit + push (or redeploy with files present)

Five practices intentionally have no art until PM supplies them — grey placeholder only.

---

## 3. Supabase verification (V1–V9)

After migration and first app use:

| # | Check | How |
| --- | --- | --- |
| V1 | Anonymous auth works | Open app → Supabase **Authentication** shows anonymous users |
| V2 | `participants` row created | Table Editor → `participants` has row with `auth_user_id` |
| V3 | `environment` column | Study deploy writes `study`; lab writes `lab` |
| V4 | `practice_completed` syncs | Mark a practice → row appears with `local_date`, `minutes` |
| V5 | `events` table | Trigger reminders/player → rows in `events` |
| V6 | `notification_permission` | Tap Allow on reminders → column updates to `granted` / `denied` |
| V7 | RLS allows own rows only | Cannot read another user's rows with anon key |
| V8 | Analysis views | `study_*` views return data filtered by environment |
| V9 | Offline queue | Airplane mode → mark practice → online → row syncs |

SQL to spot-check:

```sql
SELECT environment, notification_permission, name, created_at
FROM participants
ORDER BY created_at DESC
LIMIT 10;
```

---

## 4. Practice player — altar & diya

Rider spec E2 uses production altar/diya assets below the framed illustration. **These are not in the repo.**

Current build: frame + practice illustration + practice name + countdown (altar/diya omitted per spec).

**PM action:** Provide altar and diya image assets, or confirm omission is acceptable for study launch.

---

## 5. Audio for guided practices

Guided practices need cached audio for the player countdown. Without audio + offline cache, the player shows **Mark completed** instead of a timer.

**Pending (Phase 3 in checklist):**

- Map `practices.audio_path` from program JSONs in Supabase
- Precache invocation audio (lab flag)
- Shambhavi decode — TBD-PM

Until audio is seeded, guided player still works via **Mark completed**.

---

## 6. Device testing checklist (rider spec)

Priority order:

### Blocking bugs

| ID | Test |
| --- | --- |
| B1 | Tap **Allow** on notifications (setup + bell icon) → browser prompt appears; grant → confirmation; deny → prompt stays |
| B2 | Minutes picker scrolls, tap selects, value does not snap back |
| B3 | Player close → sheet title "Leaving the session?", **Stay** visible |
| B4 | Lab URL shows flagged features; study does not |
| B5 | After illustrations copied, real art on rows (not leaf/sun icons) |
| B6 | Calendar does not scroll vertically |

### iOS notification note (B1 / E5)

On iOS Safari, notification permission may require **Add to Home Screen** first. If permission cannot be requested from a browser tab, document that — it is not necessarily bug B1.

### Calendar (E1 + E4)

- August-style partial first week column
- All days of current month visible (including future)
- Four neutral states distinguishable
- Today = teal ring over fill
- Legend: 0 → 240+ gradient bar

### Player (E2)

- Practice illustration in frame (not photo)
- Title = practice name
- Negative countdown; zero → post-practice

---

## 7. Open items — owner PM

| # | Item |
| --- | --- |
| 1 | Confirm five practices without illustrations (or supply art) |
| 2 | Exact player gradient values from production (optional) |
| 3 | Altar and diya assets |
| 4 | Default reminder times, post-practice minimum duration, Ardhasiddhasana default minutes |
| 5 | Study + lab public URLs for participant comms |

---

## 8. PWA updates after deploy

Participants may need a **hard refresh** or reinstall until the service worker updates. `vite-plugin-pwa` uses `autoUpdate` + `skipWaiting`.

Tell participants: if the app looks old after a deploy, close all tabs, reopen from home screen, or clear site data once.

---

## 9. What this push includes

- Notification permission: synchronous `Notification.requestPermission()` + `participants.notification_permission` sync
- Minute picker: uncontrolled scroll, settle on release
- Leave session sheet copy and visible Stay button
- Feature flags via `VITE_APP_ENV` (lab must set `lab`)
- Illustration component + mapping (files still need copying)
- Welcome ring layout; My practices screen structure; instance 1st/2nd labels
- Progress: three stat boxes + E1 calendar
- Practice player: illustration frame, practice name, gradient background
- Tracking list: ideal sequence sort (`src/data/idealSequence.ts`)

---

## 10. Recommended order for you

1. **Lab Vercel:** set `VITE_APP_ENV=lab` → redeploy → confirm flags
2. **Study Vercel:** confirm `VITE_APP_ENV=study` → redeploy
3. **Illustrations:** copy Drive folder → `public/illustrations/` → push → redeploy
4. **Supabase:** run V1–V9 spot checks
5. **Phone:** B1, B2, calendar, player on real Android Chrome + iOS (installed PWA)
6. **PM:** close open TBD items before participant invite
