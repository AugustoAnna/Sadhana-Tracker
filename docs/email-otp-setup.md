# Email sign-in (OTP) — setup runbook

How sign-in codes get from Supabase to a participant's inbox, which services
are involved, and how to rebuild the whole thing from scratch. Written so that
someone who was not there can redo it in an afternoon.

## The pieces

| Layer | Service | Plan | What it does | Account / where to log in |
|---|---|---|---|---|
| Auth | **Supabase Auth**, project `mmzzcigydnelnxdhmoqw` | Free | Creates users, issues the 6–10-digit code, verifies it, keeps sessions | supabase.com → project → Authentication |
| Email delivery | **Resend** | Free (3,000 emails/month, 100/day) | SMTP relay Supabase hands the email to; signs it (DKIM) for the sending domain | resend.com |
| Sending domain + DNS | **deSEC** (`desec.io`), domain **`sadhana-tracker.dedyn.io`** | Free | Holds the DNS records Resend needs; the address participants see is `noreply@sadhana-tracker.dedyn.io` | desec.io → Domains |
| App hosting | **Vercel** | Hobby | Serves the PWA on `*.vercel.app`. Not involved in email at all | — |

No custom domain is owned and nobody on the team has DNS access elsewhere, which
is why a free `dedyn.io` name is the sending domain. Everything else follows from
that. The app code that talks to Supabase is in `src/services/auth.ts`,
`src/stores/authStore.ts` and `src/screens/SignIn.tsx`.

### Why these choices

- **Codes, not links.** Most participants use the app installed on the iPhone
  home screen. A confirmation link opens in Safari, not in the installed app, so
  the session lands in the wrong place. A code is typed inside the app (iOS
  autofills it from Mail).
- **Resend, not Supabase's built-in mailer.** The built-in one sends 2 emails an
  hour and only to the project's own team members. Not usable for participants.
- **Not Google Workspace SMTP.** Would have been simplest (no domain needed), but
  App Passwords are disabled by the Workspace admin.
- **deSEC / dedyn.io.** Free DNS with a free name. Trade-offs: dynDNS-style names
  carry a little spam-filter suspicion, and unused names expire (see *Keeping the
  domain alive*). A real domain (~$10/yr, or an Isha subdomain via IT) is the
  better long-term option; switching later is a dashboard change, not a deploy.

## Rebuilding from scratch

### 1. deSEC domain

1. Sign up at desec.io (email + password). Verify the email.
2. **Register a dynDNS domain** → `sadhana-tracker.dedyn.io`. One `dedyn.io`
   name per account; everything else lives as records inside it.
3. Ignore the "Configure your router" screen — that is for home users pointing
   the name at a changing IP. Keep the token it shows (it is the API token; the
   keep-alive workflow below needs one like it).
4. Log in: desec.io/login. Forgotten password: desec.io/reset-password.

> New `dedyn.io` names take **hours** to become resolvable by public DNS: the
> zone is signed immediately but the parent's DNSSEC link (DS record) is
> published later. Until then every resolver answers `SERVFAIL` even though the
> records are correct on `ns1.desec.io`. Confirmed normal by deSEC staff. Wait.

### 2. Resend domain + DNS records

1. resend.com → **Domains → Add Domain** → `sadhana-tracker.dedyn.io`.
   Region: `ap-northeast-1` (Tokyo; closest to India — there is no India
   region). Custom Return-Path: `send` (default). Tracking subdomain: **off**.
   Do **not** enable Receiving.
2. Resend shows four records. Add them in deSEC → Domains →
   `sadhana-tracker.dedyn.io` → *Add record set*. deSEC's **Subname** field is
   relative to the domain, so drop the `.sadhana-tracker` Resend shows:

   | Subname | Type | Content (deSEC) | Notes |
   |---|---|---|---|
   | `resend._domainkey` | TXT | `"p=MIGf…"` — Resend's full DKIM value | **wrap in double quotes** |
   | `rsend` | CNAME | `rsend-apne1.forge.rmta.net.` | trailing dot; host differs per region |
   | `send` | CNAME | `send.forge.rmta.net.` | trailing dot |
   | `_dmarc` | TXT | `"v=DMARC1; p=none;"` | optional but helps inbox placement |

   Because `send` and `rsend` are CNAMEs, nothing else may exist on those names.
   Copy the exact values Resend displays — they may differ from the above.
3. Back in Resend → **Enable Sending**. Turns green once public DNS resolves
   (see the propagation note above).
4. **API Keys → Create**: name `supabase-auth`, permission *Sending access*,
   domain `sadhana-tracker.dedyn.io`. Copy the `re_…` key — it is shown once.

### 3. Supabase Auth

All under **Authentication** in the dashboard.

1. **Emails → SMTP Settings** → *Enable Custom SMTP*:

   | Field | Value |
   |---|---|
   | Sender email | `noreply@sadhana-tracker.dedyn.io` |
   | Sender name | `Sadhana Tracker` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` (literally) |
   | Password | the Resend API key |

   Custom SMTP must be on before the dashboard lets you edit templates.
2. **Emails → Templates** — three templates must contain `{{ .Token }}`
   (that is what makes Supabase send a code instead of a link). Supabase picks
   the template from the account's state, so all three get the same body:

   | Template | Fires when |
   |---|---|
   | **Confirm signup** | a brand-new email signs in for the first time (`signInWithOtp` creates the user through the signup path) |
   | **Magic Link** | an existing email signs in again (new device, after sign-out) |
   | **Change Email Address** | a pre-email anonymous participant attaches an email (`updateUser({ email })`) |

   ```html
   <h2>Your Sadhana Tracker code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in 30 minutes. If you didn’t request it, you can ignore this email.</p>
   ```

   Subject: `Your Sadhana Tracker code`. Leave `{{ .ConfirmationURL }}` out.
3. **Sign In / Providers → Email**: *Email OTP expiration* `1800` (30 min).
   *Email OTP Length* may be 6–10; the app accepts any of them.
4. **Rate Limits** → *Rate limit for sending emails*: raise from the 30/hour
   default to ~100/hour (Resend's free tier caps at 100/day anyway).
5. **Sign In / Providers → Anonymous sign-ins** → **off**, but only once the
   email build is in production. The previous build creates anonymous sessions
   for new installs and breaks if this is switched earlier.
6. SQL editor: run `supabase/migrations/006_participant_email.sql`
   (adds `participants.email`, refreshes the analysis views).

### 4. Verify

```bash
D=sadhana-tracker.dedyn.io
dig +short @1.1.1.1 CNAME send.$D              # send.forge.rmta.net.
dig +short @1.1.1.1 TXT resend._domainkey.$D   # "p=MIGf…"
dig +short @ns1.desec.io DS $D                  # two DS lines once DNSSEC is linked
```

Then sign in on a phone with a real address:

- the email arrives from `Sadhana Tracker <noreply@sadhana-tracker.dedyn.io>`
  within a minute (check spam the first time) and contains a **code**;
- Resend → **Emails** lists it as *Delivered*;
- Supabase → Authentication → Users shows the user with the email;
- `participants.email` is filled after the first sync.

## Operating it

### Keeping the domain alive

deSEC deletes `dedyn.io` names that have not been touched for **six months**,
after a **warning email four weeks before** (the email has a one-click "still
in use" link). Any DNS record write counts as activity — confirmed by deSEC
staff on talk.desec.io. A four-week study never gets near the limit; the risk is
the long tail.

`.github/workflows/desec-keepalive.yml` runs on the 1st of every month and

1. checks from public DNS that the three Resend records still resolve, failing
   loudly (GitHub emails the repo owner) if one is missing;
2. writes a `_keepalive` TXT record with today's date via deSEC's API, which
   resets the inactivity clock.

It needs one repository secret, **`DESEC_TOKEN`**: deSEC → *Token management*
→ create a token (name it `github-keepalive`) → GitHub repo → Settings →
Secrets and variables → Actions → *New repository secret*. Run the workflow
once by hand (*Actions → Keep deSEC domain alive → Run workflow*) to confirm.

Two caveats: GitHub pauses scheduled workflows in **public** repositories after
60 days without commits (it emails first; re-enable from the Actions tab), and
the deSEC warning email goes to the deSEC account's address — make sure
someone reads that inbox.

### What breaks if the domain disappears

Only sending new codes. Everyone already signed in keeps working (sessions do
not touch the domain), no data is lost (`participants` and `auth.users` are in
Supabase), and Phase-2 passkeys are bound to the app's Vercel origin, not to
this domain. Point Supabase's SMTP sender at another verified domain and new
sign-ins resume.

### Limits to keep in mind

- Resend free: 100 emails/day, 3,000/month. Roughly 1.5 emails per sign-in.
- Supabase: one code per address per 60 s; the app enforces the same cooldown.
- The receiving side looks up the DNS records at delivery time; a deSEC outage
  delays codes or lands them in spam, it does not break the app.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Email contains a **link**, no code | The template that fired lacks `{{ .Token }}` — usually *Confirm signup* (first-time email) or *Change Email Address* (linking) | Add the token body to all three templates |
| Code has 8 (or 10) digits | *Email OTP Length* setting | Fine — the app accepts 6–10 |
| "Email address not authorized" | Custom SMTP not enabled; Supabase's own mailer only delivers to team members | Enable custom SMTP |
| Nothing arrives, Resend shows nothing | SMTP credentials wrong, or the domain is not *Verified* in Resend | Re-check host/port/username `resend`/API key; check the domain status |
| `SERVFAIL` from public DNS, records fine on `ns1.desec.io` | New `dedyn.io` name, DNSSEC link not yet published | Wait (hours) |
| Code arrives late or in spam | Sending-domain reputation / DMARC lookups | Add the `_dmarc` record; tell participants to check spam; long term, move to a real domain |
| "Too many attempts" | 60 s per-address limit or the hourly rate limit | Wait; raise *Rate Limits* if it is the hourly cap |

## Moving to a real domain later

Verify the new domain in Resend (same four records, on that domain's DNS),
change *Sender email* in Supabase SMTP settings, done. No deploy, no code
change, existing sessions unaffected. Keep `sadhana-tracker.dedyn.io` verified
for a few days in case something still references it.
