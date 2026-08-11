# Illustration setup

Illustrations are **not bundled in git** (large binary assets). The app loads them from `public/illustrations/` at build time.

## Why placeholders appear

If you see grey squares or generic icons instead of practice art, one of these is true:

1. **Files are missing** — `public/illustrations/` is empty or not deployed.
2. **Filename mismatch** — files must match the practice **slug** in `src/data/catalogue.ts` (e.g. `isha-kriya.png`, not `Isha Kriya.png`).
3. **Five practices have no art** — these always show a neutral placeholder until PM supplies assets.

## Step-by-step

### 1. Download from Google Drive

Folder: [illustrations on Drive](https://drive.google.com/drive/folders/1Bj27ODTq-0kBNDdA0r-2xYPb_At_PLV2?usp=sharing)

1. Open the folder in a browser (you need edit/view access).
2. Select all files → **Download** (or use Drive desktop sync).
3. Unzip if needed.

### 2. Rename files to match slugs

Each file must be named `{practice-id}.png` or `{practice-id}.webp`.

Examples:

| Practice name | Filename |
| --- | --- |
| Isha Kriya | `isha-kriya.png` |
| Shambhavi Mahamudra Kriya | `shambhavi.png` |
| Inner Engineering Crash Course | `ie-crash-course.png` |
| Sadhguru's Presence | `sadhguru-presence.png` |

Full slug list: `src/data/catalogue.ts` → `id` field on each practice.

**Chit Shakti files:** if Drive uses `cs-health` style names, rename to `chit-shakti-health`, etc.

### 3. Copy into the repo

```text
public/
  illustrations/
    isha-kriya.png
    shoonya.png
    … (42 files with art)
```

Create the folder if it does not exist:

```bash
mkdir -p public/illustrations
# copy your PNGs/WebPs here
```

### 4. Verify locally

```bash
npm run dev
```

Open Welcome and My practices — each row should show its illustration. Missing files log a failed image load and fall back to the neutral square (not a leaf/sun icon).

### 5. Redeploy both Vercel projects

Push to `main` (or trigger redeploy). Vite copies `public/illustrations/` into `dist/illustrations/` on build.

## Practices without illustrations (pending PM)

These five use a neutral placeholder only — **do not** use generic icons:

| Slug | Practice |
| --- | --- |
| `ardhasiddhasana` | Ardhasiddhasana |
| `bhakti-sadhana` | Bhakti Sadhana |
| `jala-neti` | Jala Neti |
| `knee-rotations` | Knee Rotations |
| `thoppukarnam` | Thoppukarnam |

When PM supplies art, remove the slug from `PRACTICES_WITHOUT_ILLUSTRATION` in `src/data/illustrationMap.ts` and add the file.

## Mapping reference

See `docs/illustration-mapping.md` for the full slug → filename table after Drive review.

## Code path

- Mapping: `src/data/illustrationMap.ts`
- Component: `src/components/PracticeIllustration.tsx`
- URL pattern: `/illustrations/{slug}.png` (fallback `.webp`)
