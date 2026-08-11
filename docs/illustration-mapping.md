# Illustration mapping

Maps practice slugs to files in `public/illustrations/`. Filenames follow the slug in `src/data/catalogue.ts`.

**Setup:** See `docs/illustration-setup.md` for copying files from Google Drive.

## Practices without illustrations

Awaiting PM confirmation / assets. These render a **neutral square placeholder** only:

| Slug | Practice name |
| --- | --- |
| `ardhasiddhasana` | Ardhasiddhasana |
| `bhakti-sadhana` | Bhakti Sadhana |
| `jala-neti` | Jala Neti |
| `knee-rotations` | Knee Rotations |
| `thoppukarnam` | Thoppukarnam |

## Mapping table (42 with art)

| Slug | Expected filename | Notes |
| --- | --- | --- |
| `achala-arpanam` | `achala-arpanam.png` | |
| `angamardana` | `angamardana.png` | |
| `aum-chanting` | `aum-chanting.png` | |
| `bhastrika-kriya` | `bhastrika-kriya.png` | |
| `bhuta-shuddhi` | `bhuta-shuddhi.png` | |
| `breath-watching` | `breath-watching.png` | |
| `chit-shakti-health` | `chit-shakti-health.png` | Drive may use `cs-health` — rename |
| `chit-shakti-love` | `chit-shakti-love.png` | |
| `chit-shakti-peace` | `chit-shakti-peace.png` | |
| `chit-shakti-success` | `chit-shakti-success.png` | |
| `devi-sadhana` | `devi-sadhana.png` | |
| `directional-movements` | `directional-movements.png` | |
| `eye-care` | `eye-care.png` | |
| `guru-mahima` | `guru-mahima.png` | |
| `guru-pooja` | `guru-pooja.png` | |
| `infinity-meditation` | `infinity-meditation.png` | |
| `ie-crash-course` | `ie-crash-course.png` | |
| `isha-kriya` | `isha-kriya.png` | |
| `linga-bhairavi-arati` | `linga-bhairavi-arati.png` | |
| `living-soil` | `living-soil.png` | |
| `mahamantra` | `mahamantra.png` | |
| `margazhi-mantra` | `margazhi-mantra.png` | |
| `nada-yoga` | `nada-yoga.png` | |
| `nadi-shuddhi` | `nadi-shuddhi.png` | |
| `namaskar-process` | `namaskar-process.png` | |
| `neck-practices` | `neck-practices.png` | |
| `rudraksha-diksha` | `rudraksha-diksha.png` | |
| `sadhguru-presence` | `sadhguru-presence.png` | |
| `samyama` | `samyama.png` | |
| `shakti-chalana` | `shakti-chalana.png` | |
| `shambhavi` | `shambhavi.png` | |
| `shambhavi-mudra` | `shambhavi-mudra.png` | |
| `shanmuki-mudra` | `shanmuki-mudra.png` | |
| `shiva-namaskar` | `shiva-namaskar.png` | |
| `shoonya` | `shoonya.png` | |
| `simha-kriya` | `simha-kriya.png` | |
| `squatting` | `squatting.png` | |
| `sukha-kriya` | `sukha-kriya.png` | |
| `surya-kriya` | `surya-kriya.png` | |
| `surya-shakti` | `surya-shakti.png` | |
| `yoga-namaskar` | `yoga-namaskar.png` | |
| `yogasanas` | `yogasanas.png` | |

Fallback extension: `.webp` if `.png` missing (`src/data/illustrationMap.ts`).

## Unmatched Drive files

After copying from Drive, any file that does not match a slug above should be listed here during review:

| Drive filename | Action |
| --- | --- |
| _(paste after download)_ | Rename to slug or flag PM |

## Review gate (spec §4.2)

Mapping is documented. **Wiring is active** in this build (`PracticeIllustration` + `illustrationMap.ts`). If PM prefers review before wiring, revert `PracticeIllustration` to placeholders only.
