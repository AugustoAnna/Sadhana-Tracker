# Vercel deployments — study and lab

Two Vercel projects deploy from the same repository, but each tracks a different production branch so both environments keep a stable URL:

- Study project tracks `main`
- Lab project tracks `lab`

They also differ in environment variables.

| Vercel project name (suggested) | Audience | `VITE_APP_ENV` | Purpose |
| --- | --- | --- | --- |
| `sadhana-study` (or `sadhana-preview`) | 25 study participants | `study` | Research build — flags off, instrumentation on |
| `sadhana-lab` | Internal team | `lab` | Full feature set for testing |

URLs are **TBD-PM** (open item #7 in spec §11).

## Shared environment variables (both projects)

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Same anon key |

⊘ Never set `service_role` in Vercel or any client-readable variable.

## Per-project variable

| Project | Variable | Value |
| --- | --- | --- |
| Study | `VITE_APP_ENV` | `study` |
| Lab | `VITE_APP_ENV` | `lab` |

## Branch tracking model (current)

| Project | Vercel environment | Branch tracking | Deploy target |
| --- | --- | --- | --- |
| Study (`sadhana-preview` / `sadhana-study`) | Production | `main` | Stable study production URL |
| Lab (`sadhana-lab`) | Production | `lab` | Stable lab production URL |

This avoids shipping lab changes to study/production while still giving lab a fixed URL.

## Configure or change branch tracking

In Vercel, this setting is now in **Environments** (not in Git settings):

1. Open the project (`sadhana-lab` or study project)
2. Go to **Settings -> Environments**
3. Click **Production**
4. Open **Branch Tracking**
5. Set the branch (`lab` for lab project, `main` for study project)
6. Save

After changing branch tracking, push a commit to that branch (or redeploy) to confirm.

### If we rename the lab branch later

1. Create and push the new branch
2. Update lab project **Production -> Branch Tracking** to the new branch name
3. Push once to the new branch to trigger deploys
4. Optionally delete old lab branch after validation

## Create projects in Vercel dashboard

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. Create the **study** project:
   - Name: `sadhana-study` (or your preferred name)
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Production branch tracking: `main` (Settings -> Environments -> Production)
   - Environment variables: add all three (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV=study`)
3. Repeat for the **lab** project with `VITE_APP_ENV=lab` and production branch tracking `lab`.
4. After first deploy from each project, write one test row and confirm it lands in the correct `environment` bucket in Supabase (V1/V2).

## Optional: CLI setup

If you install the Vercel CLI (`npm i -g vercel`), link each project from the repo root:

```bash
# Study project
vercel link --project sadhana-study
vercel env add VITE_APP_ENV          # enter: study
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Lab project (re-link or use a second checkout)
vercel link --project sadhana-lab
vercel env add VITE_APP_ENV          # enter: lab
# same Supabase URL and anon key
```

## PWA update note

Both deployments use `vite-plugin-pwa` with `autoUpdate`, `skipWaiting`, and `clientsClaim`. After a new deploy, participants may need a hard refresh or PWA reinstall until the service worker updates. Vercel “deployed X ago” reflects the last build for **that** project — confirm you are opening the study URL, not the lab URL (or an old single-project URL).

## Verification after setup

| Check | How |
| --- | --- |
| Study flags off | Open study URL — no session/journey entry points |
| Lab flags on | Open lab URL — sessions, journey, etc. reachable |
| Environment isolation | Insert from each deploy; query `study_*` views |
