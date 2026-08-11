# Illustration mapping (spec §4.2)

Build-time resolution via `scripts/generate-asset-manifest.mjs` → `src/data/generated/assetManifest.json` → `src/data/practiceAssets.ts`.

## Procedure (§4.2)

1. Place files in `public/illustrations/` named `{practice-slug}.png` or `.webp`.
2. Run `npm run prebuild` to scan and regenerate the manifest.
3. Unmatched Drive filenames are listed below under **Unmatched files**.
4. Five practices have no illustration — neutral placeholder only.

## Practices without illustrations

| Slug | Practice name |
| --- | --- |
| `ardhasiddhasana` | Ardhasiddhasana |
| `bhakti-sadhana` | Bhakti Sadhana |
| `jala-neti` | Jala Neti |
| `knee-rotations` | Knee Rotations |
| `thoppukarnam` | Thoppukarnam |

## Mapping table (42 expected with art)

Slug → filename = `{slug}.png` (fallback `.webp`). Slugs match `src/data/catalogue.ts` `id` field.

| Slug | Expected file |
| --- | --- |
| `achala-arpanam` | `achala-arpanam.png` |
| `angamardana` | `angamardana.png` |
| `aum-chanting` | `aum-chanting.png` |
| `bhastrika-kriya` | `bhastrika-kriya.png` |
| `bhuta-shuddhi` | `bhuta-shuddhi.png` |
| `breath-watching` | `breath-watching.png` |
| `chit-shakti-health` | `chit-shakti-health.png` |
| `chit-shakti-love` | `chit-shakti-love.png` |
| `chit-shakti-peace` | `chit-shakti-peace.png` |
| `chit-shakti-success` | `chit-shakti-success.png` |
| `devi-sadhana` | `devi-sadhana.png` |
| `directional-movements` | `directional-movements.png` |
| `eye-care` | `eye-care.png` |
| `guru-mahima` | `guru-mahima.png` |
| `guru-pooja` | `guru-pooja.png` |
| `infinity-meditation` | `infinity-meditation.png` |
| `ie-crash-course` | `ie-crash-course.png` |
| `isha-kriya` | `isha-kriya.png` |
| `linga-bhairavi-arati` | `linga-bhairavi-arati.png` |
| `living-soil` | `living-soil.png` |
| `mahamantra` | `mahamantra.png` |
| `margazhi-mantra` | `margazhi-mantra.png` |
| `nada-yoga` | `nada-yoga.png` |
| `nadi-shuddhi` | `nadi-shuddhi.png` |
| `namaskar-process` | `namaskar-process.png` |
| `neck-practices` | `neck-practices.png` |
| `rudraksha-diksha` | `rudraksha-diksha.png` |
| `sadhguru-presence` | `sadhguru-presence.png` |
| `samyama` | `samyama.png` |
| `shakti-chalana` | `shakti-chalana.png` |
| `shambhavi` | `shambhavi.png` |
| `shambhavi-mudra` | `shambhavi-mudra.png` |
| `shanmuki-mudra` | `shanmuki-mudra.png` |
| `shiva-namaskar` | `shiva-namaskar.png` |
| `shoonya` | `shoonya.png` |
| `simha-kriya` | `simha-kriya.png` |
| `squatting` | `squatting.png` |
| `sukha-kriya` | `sukha-kriya.png` |
| `surya-kriya` | `surya-kriya.png` |
| `surya-shakti` | `surya-shakti.png` |
| `yoga-namaskar` | `yoga-namaskar.png` |
| `yogasanas` | `yogasanas.png` |

## Unmatched files

Current build scan: **0 illustration files** in `public/illustrations/`. After copying from Drive, re-run prebuild and list any filenames here that do not match a slug.

## Audio (program JSONs)

Guided audio paths resolve from `public/programs/{slug}.json` field `audioPath` or `audio_path`, else first match in `public/audio/{slug}.*`.

See `docs/update-run-2-report.md` for the full 47-practice illustration/audio/kind table.

## Wiring status

**Active** — `PracticeIllustration` and `getPracticeAudio()` use the manifest. Missing files show placeholder (illustrations) or Mark completed fallback when offline (guided audio).
