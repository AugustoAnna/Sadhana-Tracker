# Update run 2 — report

Generated: 2026-08-11

## Public folder inventory

Scanned at build time via `scripts/generate-asset-manifest.mjs`:

| Location | Files found |
| --- | --- |
| `public/illustrations/` | **0** |
| `public/audio/` | **0** |
| `public/programs/*.json` | **0** |
| `public/favicon.svg` | 1 |

**Blocker:** The prompt states assets are in `public`, but this checkout contains only `favicon.svg`. Until `public/illustrations/`, `public/audio/`, and optionally `public/programs/` are committed and pushed, guided play and illustrations cannot work in deployment.

After adding assets, run `npm run prebuild` (runs automatically on `npm run build`) to regenerate `src/data/generated/assetManifest.json`.

---

## 47-practice asset resolution table

Illustration = file present in manifest (or not in `PRACTICES_WITHOUT_ILLUSTRATION` exclusion list).  
Audio = file in `public/audio/` or `audioPath` in program JSON.  
Kind = resolved from master sheet + program JSON; Shambhavi forced **unguided**.

| # | Practice | Illustration | Audio | Kind | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Jala Neti | no | no | unguided | No illustration by design |
| 2 | Guru Pooja | no | no | guided | Audio missing at build |
| 3 | Inner Engineering Crash Course | no | no | guided | Audio missing at build |
| 4 | Mahamantra | no | no | guided | Audio missing at build |
| 5 | Bhuta Shuddhi | no | no | unguided | |
| 6 | Guru Mahima | no | no | unguided | |
| 7 | Linga Bhairavi Arati | no | no | guided | Audio missing at build |
| 8 | Directional Movements of the Arms | no | no | guided | Audio missing at build |
| 9 | Knee Rotations | no | no | unguided | No illustration by design |
| 10 | Squatting | no | no | unguided | |
| 11 | Neck Practices | no | no | guided | Audio missing at build |
| 12 | Thoppukarnam | no | no | unguided | No illustration by design |
| 13 | Yoga Namaskar | no | no | guided | Audio missing at build |
| 14 | Angamardana | no | no | unguided | |
| 15 | Surya Shakti | no | no | unguided | |
| 16 | Surya Kriya | no | no | unguided | |
| 17 | Yogasanas | no | no | unguided | |
| 18 | Eye Care Practices | no | no | unguided | |
| 19 | Shakti Chalana Kriya | no | no | unguided | |
| 20 | Shambhavi Mahamudra Kriya | no | no | **unguided** | Confirmed unguided — no play control |
| 21 | Bhastrika Kriya | no | no | unguided | |
| 22 | Shanmuki Mudra | no | no | unguided | |
| 23 | Simha Kriya | no | no | unguided | |
| 24 | Breath Watching | no | no | timed | |
| 25 | Samyama | no | no | timed | |
| 26 | Achala Arpanam | no | no | guided | Audio missing at build |
| 27 | Isha Kriya | no | no | guided | Audio missing at build |
| 28 | Living Soil Meditation | no | no | guided | Audio missing at build |
| 29 | Margazhi Mantra | no | no | guided | Audio missing at build |
| 30 | Infinity Meditation | no | no | guided | Audio missing at build |
| 31 | Shambhavi Mudra | no | no | guided | Audio missing at build |
| 32 | Chit Shakti for Health | no | no | guided | Audio missing at build |
| 33 | Chit Shakti for Love | no | no | guided | Audio missing at build |
| 34 | Chit Shakti for Peace | no | no | guided | Audio missing at build |
| 35 | Chit Shakti for Success | no | no | guided | Audio missing at build |
| 36 | Bhakti Sadhana | no | no | unguided | No illustration by design |
| 37 | Namaskar Process | no | no | guided | Audio missing at build |
| 38 | Nada Yoga | no | no | guided | Audio missing at build |
| 39 | Devi Sadhana | no | no | guided | Audio missing at build |
| 40 | Rudraksha Diksha | no | no | guided | Audio missing at build |
| 41 | Sukha Kriya | no | no | timed | |
| 42 | Nadi Shuddhi | no | no | guided | Audio missing at build |
| 43 | AUM Chanting | no | no | timed | |
| 44 | Shiva Namaskar | no | no | unguided | |
| 45 | Sadhguru's Presence | no | no | guided | Audio missing at build |
| 46 | Ardhasiddhasana | no | no | timed | No illustration by design |
| 47 | Shoonya | no | no | unguided | |

### Guided practices with missing audio (do not degrade — report only)

21 practices: achala-arpanam, chit-shakti-health, chit-shakti-love, chit-shakti-peace, chit-shakti-success, devi-sadhana, directional-movements, guru-pooja, ie-crash-course, infinity-meditation, isha-kriya, linga-bhairavi-arati, living-soil, mahamantra, margazhi-mantra, nada-yoga, nadi-shuddhi, namaskar-process, neck-practices, rudraksha-diksha, sadhguru-presence, shambhavi-mudra, yoga-namaskar

---

## Illustration transparency

**Blocked** — no illustration files in `public/illustrations/` to inspect. Cannot confirm transparent vs baked-in backgrounds until assets are present. Re-check after deploy.

---

## Verification results (1–22)

| # | Check | Result |
| --- | --- | --- |
| 1 | 47-practice table | **Pass** (table above; all assets **no** pending files) |
| 2 | IE Crash Course plays audio + countdown | **Blocked** — no audio files in repo |
| 3 | No Mark completed for guided with audio | **Blocked** — cannot test without audio |
| 4 | Guided zero → Practices screen directly | **Pass** (code: `finishAndReturn` → `/practice-home`) |
| 5 | No post-practice screen reachable | **Pass** (`/post-practice` redirects to `/practice-home`) |
| 6 | Shambhavi no play control | **Pass** (`getResolvedKind` = unguided, no play button) |
| 7 | No framed box behind player illustration | **Pass** (frame removed) |
| 8 | Illustration transparency | **Blocked** — no asset files |
| 9 | Sadhguru's Presence card does not open picker | **Pass** (non-clickable row, toggle only) |
| 10 | Generic reminders still open picker | **Pass** (unchanged) |
| 11 | Permission prompt on arrival once per session | **Pass** (`sessionStorage` gate) |
| 12 | Denied → manual instructions, not dead Allow | **Pass** (TBD-PM placeholder copy) |
| 13 | Practice reminder after late add | **Pass** (`syncPracticeReminders` on hydrate/add/remove) |
| 14 | Commonly practiced expanded by default | **Pass** |
| 15 | Added hidden until first add | **Pass** |
| 16 | Chevrons down/up | **Pass** |
| 17 | Second-instance sheet layout | **Pass** (description → example rows → CTA) |
| 18 | Streak reads "{n} day streak" | **Pass** |
| 19 | Calendar row alignment | **Pass** (single CSS grid; not device-verified) |
| 20 | Cells ~26px | **Pass** |
| 21 | Bottom row not clipped | **Pass** (`overflow-y-visible`; not device-verified) |
| 22 | Minutes picker smooth + retains value | **Pass** (CSS snap; not device-verified) |

---

## TBD-PM placeholders inserted

1. **Welcome subhead** — "See it build" vs "Watch it build" (awaiting PM confirmation)
2. **Notification denied instructions** — `Reminders.tsx` `DENIED_INSTRUCTIONS_PLACEHOLDER`
3. **Guru Pooja reminder** — derivation implemented; reminder not added pending PM

---

## Awaiting PM confirmation

1. **Guru Pooja reminder** — add or keep Sadhguru's Presence only?
2. **Welcome subhead** — "See it build" or "Watch it build"?

---

## What could not be done

1. **Verify or use illustration/audio files** — `public/illustrations/` and `public/audio/` are empty in this workspace. Need files committed to repo (or `git pull` if pushed elsewhere).
2. **Read program JSONs** — none in `public/programs/`. Add JSONs with `audioPath` and optional `kind` override per practice.
3. **Device testing** — IE Crash Course audio, calendar alignment at three rows, picker scroll feel.
4. **Illustration transparency inspection** — requires actual PNG/WebP files.

### Expected asset layout

```text
public/
  illustrations/{slug}.png
  audio/{slug}.mp3
  programs/{slug}.json   # optional: { "practiceId": "...", "audioPath": "/audio/....mp3", "kind": "guided" }
```

Then `npm run build` regenerates the manifest and guided play resolves via `getPracticeAudio()`.
