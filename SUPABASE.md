# Supabase Setup

**Project:** `sadhana tracker`  
**URL:** https://mmzzcigydnelnxdhmoqw.supabase.co

V3 schema (participants, practices, participant_practices, practice_completed, reminders, events) with passwordless email sign-in and per-user RLS.

## Auth

Everyone signs in with their name, their email and a code (Supabase email OTP). There are no passwords and no anonymous sign-in. The `participants.email` column mirrors `auth.users.email` and is the account's human-readable identity; `participants.id` stays the uuid the other tables reference.

Full setup runbook (services, DNS records, templates, keep-alive, troubleshooting): [`docs/email-otp-setup.md`](docs/email-otp-setup.md).

Flow: Welcome → *Get started* → name + email → code → straight into onboarding (new participant) or home with history restored (returning participant). The client lives in `src/services/auth.ts`, `src/stores/authStore.ts` and `src/screens/SignIn.tsx`:

- `signInWithOtp({ email, shouldCreateUser: true })` → `verifyOtp({ type: 'email' })` for a fresh or returning participant.
- Devices still holding a pre-email **anonymous** session see the same screen as "Keep your progress": `updateUser({ email })` → `verifyOtp({ type: 'email_change' })`. The auth user id does not change, so every row they already have stays attached.
- The name typed at sign-in is applied after the server restore, so it wins over a stale local or placeholder name.
- On sign-in the app records the account as the owner of the local IndexedDB (`localStorage.sadhana_owner_user_id`). If a different account later signs in on the same device the local database is wiped, then `restoreFromServer()` pulls that account's history down.
- **Two accounts for one person** (the email already has a permanent account because it was used on another device before the anonymous phone linked it): the app offers *Continue with that account*. It sends a sign-in code for the existing account and, once verified, calls the **`merge-anonymous-account`** Edge Function with the anonymous session's token; the function verifies both tokens and runs `merge_participants()` (migration 007) to move every row onto the permanent participant, stamping the old row `merged_into`. If the merge fails the anonymous session is restored and nothing changes. Deploy with `supabase functions deploy merge-anonymous-account`.
- Sign out (Reminders → Account) drains the sync queue, drops the session on this device only, and wipes the local database.
- **Passkeys**: right after a code sign-in the app offers "Sign in faster next time?" once per device (`registerPasskey()`); the sign-in screen shows a "Sign in with Face ID / fingerprint" button where the browser supports it (`signInWithPasskey()`), which goes through the same restore/hydrate completion as a code; Reminders → Account has *Set up / Turn off* for this device. The passkey never replaces email — it is the fast door, email is identity and recovery.

### Dashboard checklist

Everything below is in **Authentication** on the Supabase dashboard and has to be done once per project.

1. **Sign In / Providers → Email**: keep the provider enabled. Set *Email OTP expiration* (default 1 hour; 30 minutes is plenty). *Email OTP Length* can stay at whatever it is (6–10) — the app accepts any length in that range; just keep the template text honest about it.
   **Per-address send interval** (Authentication → Rate Limits, or the *minimum interval between emails* field under Emails → SMTP Settings — `smtp_max_frequency` in the Management API): how long the same address must wait between codes, default 60 s. A new code always **replaces** the previous one, so this is purely anti-abuse; **lower it** so a participant who mistyped something can request a fresh code right away. The app shows a matching countdown on the code step (`VITE_OTP_RESEND_SECONDS`, default 60 — keep the two equal), clears it when the participant taps *Change details*, and if the server still refuses shows exactly the wait it reports.
2. **Sign In / Providers → Anonymous sign-ins**: **disable once this build is in production** (the previous build creates anonymous sessions for new installs, so not before). Existing anonymous sessions keep working until they link an email.
3. **Emails → Templates**: three templates must contain `{{ .Token }}` — that is what makes Supabase send a code instead of a link. Supabase picks the template from the account's state, so all three carry the same body:

   | Template | Fires when |
   |---|---|
   | **Confirm signup** | a brand-new email signs in for the first time (`signInWithOtp` creates the user and routes through the signup path) |
   | **Magic Link** | an existing email signs in again (new device, after sign-out) |
   | **Change Email Address** | an anonymous participant attaches an email (`updateUser({ email })`) |

   ```html
   <h2>Your Sadhana Tracker code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in 30 minutes. If you didn’t request it, you can ignore this email.</p>
   ```

   Leave `{{ .ConfirmationURL }}` out — a link opens Safari rather than the installed app.
4. **Emails → SMTP Settings**: enable custom SMTP. The built-in mailer is limited to 2 emails/hour and only delivers to your own team — it is not usable for participants. Any provider works (Resend, Postmark, SES…); the free Resend tier covers a study comfortably. Once custom SMTP is on, raise **Rate Limits → Emails sent** as needed.
5. **URL Configuration**: not needed for codes (no redirect).
6. **Passkeys** (Face ID / Touch ID / fingerprint sign-in) — **Authentication → Passkeys**:
   - *Enable Passkey authentication*: on.
   - *Relying Party Display Name*: `Sadhana Tracker`.
   - *Relying Party ID*: the **bare hostname participants use**, e.g. `sadhana-tracker-preview.vercel.app` (no `https://`, no path).
   - *Relying Party Origins*: `https://<that hostname>` — up to five, each must be that hostname or a subdomain of it.

   Constraints worth knowing: a passkey is bound to the origin it was registered on, so **changing the production hostname later invalidates every passkey** (email codes still work). Because `vercel.app` is a public suffix, `sadhana-tracker-lab.vercel.app` and `sadhana-tracker-preview.vercel.app` are *not* subdomains of each other — one Supabase project can serve passkeys for one of them at a time. Per-deployment preview URLs (`…-lr5gz47k4-….vercel.app`) will never match; test passkeys on the hostname set as RP ID. Supabase marks the feature experimental; the exact `@supabase/supabase-js` pin is what keeps the client calls stable. Anonymous users cannot register a passkey — the app only offers one after the email step.

### Existing anonymous users

Participants from the anonymous build are **kept**, not deleted. Their session
stays valid after anonymous sign-ins are disabled; on next open the app asks
for name + email ("Keep your progress") and attaches the email to the same
auth user, so all their rows stay where they are. Nothing needs to be run against `auth.users`.
(Deleting a row there would cascade through `participants` into every practice,
reminder and event row for that person.)

### SDK version

`@supabase/supabase-js` is pinned to an exact version in `package.json` — see
the comment in `src/services/supabase.ts`. Bump it on purpose and re-run
`npm test`; don't let a caret or Dependabot move it.

## Local config

`.env.local` is configured with project credentials (gitignored). To recreate:

```bash
cp .env.example .env.local
```

Fill from **Project Settings → API** in the [Supabase dashboard](https://supabase.com/dashboard/project/mmzzcigydnelnxdhmoqw/settings/api).

## Tables

| Table | Purpose |
|---|---|
| `participants` | One row per anonymous auth user (name, platform, segment, environment) |
| `practices` | Read-only practice catalogue (seeded — see below) |
| `participant_practices` | Practices added to the participant's list |
| `practice_completed` | Every logged practice session |
| `reminders` | Reminder slots (current state only — no history) |
| `push_subscriptions` | One row per device that granted Web Push |
| `reminder_sends` | One row per push attempt: status from the push service, plus `delivered_at` / `tapped_at` reported back by the service worker. `reminder_sends_daily` view rolls it up. |
| `events` | Instrumentation events |

Analysis views: `study_participants`, `study_practice_completed`, `study_practices_added`, `study_events`, `study_participant_profile`.

## Migrations

Applied via the Supabase SQL editor. Local SQL mirror:

```
supabase/migrations/001_study_build.sql
supabase/migrations/002_v3_schema.sql
supabase/migrations/003_seed_practices.sql
supabase/migrations/004_push_subscriptions.sql
supabase/migrations/006_participant_email.sql          (participants.email + view refresh)
supabase/migrations/007_merge_participants.sql         (merge_participants() + participants.merged_into)
supabase/migrations/20260807100000_initial_schema.sql   (v2, superseded)
```

## Seed the practice catalogue

The `practices` table is a read-only catalogue referenced by `participant_practices.practice_id` and `practice_completed.practice_id` (FK). It is **not** seeded by any migration, so it must be seeded once via the SQL editor — otherwise every `participant_practices` / `practice_completed` insert fails the FK and those tables stay empty.

Run this in the Supabase SQL editor:

```sql
insert into practices (id, name, kind, default_minutes, illustration, audio_path, allows_second_instance, sort_order)
values
  ('achala-arpanam', 'Achala Arpanam', 'guided', 12, '/illustrations/Achala-arpanam_illustration.webp', 'https://images-sgex-prod.sadhguru.org/static-exclusive/assets/en/media/achala-arpanam-practice.mp3', true, 0),
  ('angamardana', 'Angamardana', 'unguided', 40, '/illustrations/Angamardana_illustration.webp', NULL, true, 1),
  ('ardhasiddhasana', 'Ardhasiddhasana', 'timed', 20, '/illustrations/Ardha-siddhasana_illustration.webp', NULL, false, 2),
  ('aum-chanting', 'AUM Chanting', 'timed', 20, '/illustrations/Aum-chanting_illustration.webp', NULL, false, 3),
  ('bhakti-sadhana', 'Bhakti Sadhana', 'unguided', 13, '/illustrations/Bhakti-sadhana_illustration.webp', NULL, true, 4),
  ('bhastrika-kriya', 'Bhastrika Kriya', 'unguided', 12, '/illustrations/Bhastrika-kriya_illustration.webp', NULL, true, 5),
  ('bhuta-shuddhi', 'Bhuta Shuddhi', 'unguided', 10, '/illustrations/Bhuta-shuddhi_illustration.webp', NULL, true, 6),
  ('breath-watching', 'Breath Watching', 'timed', 40, '/illustrations/Breath-watching_illustration.webp', NULL, false, 7),
  ('chit-shakti-health', 'Chit Shakti for Health', 'guided', 19, '/illustrations/placeholder.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/yoga-chit-shakti-health_en.mp3', true, 8),
  ('chit-shakti-love', 'Chit Shakti for Love', 'guided', 17, '/illustrations/Cs-for-love_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/yoga-chit-shakti-love_en.mp3', true, 9),
  ('chit-shakti-peace', 'Chit Shakti for Peace', 'guided', 19, '/illustrations/Cs-for-peace_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/yoga-chit-shakti-peace_en.mp3', true, 10),
  ('chit-shakti-success', 'Chit Shakti for Success', 'guided', 19, '/illustrations/Cs-for-success_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/yoga-chit-shakti-success_en.mp3', true, 11),
  ('devi-sadhana', 'Devi Sadhana', 'guided', 8, '/illustrations/Devi-sadhana_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/achala-arpanam-practice.mp3', true, 12),
  ('directional-movements', 'Directional Movements of the Arms', 'guided', 6, '/illustrations/Directional-movements_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_directional-movement-guided_en.mp3', true, 13),
  ('eye-care', 'Eye Care Practices', 'unguided', 10, '/illustrations/Eye-practices_illustration.webp', NULL, true, 14),
  ('guru-mahima', 'Guru Mahima', 'unguided', 6, '/illustrations/Guru-mahima_illustration.webp', NULL, true, 15),
  ('guru-pooja', 'Guru Pooja', 'guided', 6, '/illustrations/Guru-pooja_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/guru-pooja-audio_en.mp3', true, 16),
  ('infinity-meditation', 'Infinity Meditation', 'guided', 15, '/illustrations/Infinity-meditation_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/infinity-meditation_en.mp4', true, 17),
  ('ie-crash-course', 'Inner Engineering Crash Course', 'guided', 2, '/illustrations/Inner-engineering-crash-course_illustration.webp', 'https://images-sgex-prod.sadhguru.org/static-exclusive/assets/en/media/ie-rules-audio_en.m4a', true, 18),
  ('isha-kriya', 'Isha Kriya', 'guided', 14, '/illustrations/Isha-kriya_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/isha-kriya-meditation_en.mp3', true, 19),
  ('jala-neti', 'Jala Neti', 'unguided', 10, '/illustrations/Jala-neti_illustration.webp', NULL, true, 20),
  ('knee-rotations', 'Knee Rotations', 'unguided', 2, '/illustrations/Knee-rotations_illustration.webp', NULL, true, 21),
  ('linga-bhairavi-arati', 'Linga Bhairavi Arati', 'guided', 2, '/illustrations/Linga-bhairavi-arati_illustration.webp', NULL, true, 22),
  ('living-soil', 'Living Soil Meditation', 'guided', 12, '/illustrations/Living-soil-meditation_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/soil-meditation_en.mp3', true, 23),
  ('mahamantra', 'Mahamantra', 'guided', 21, '/illustrations/Mahamantra_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/sadhguru_app/chants/high/Mahamantra/mahamantra.mp3', true, 24),
  ('margazhi-mantra', 'Margazhi Mantra', 'guided', 15, '/illustrations/Margazhi-mantra_illustration.webp', 'https://images-sgex-prod.sadhguru.org/static-exclusive/assets/en/media/margazhi_mantra_en.mp3', true, 25),
  ('nada-yoga', 'Nada Yoga', 'guided', 6, '/illustrations/Nada-yoga_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_nada-yoga-guided_en.mp3', true, 26),
  ('nadi-shuddhi', 'Nadi Shuddhi', 'guided', 4, '/illustrations/Nadi-shuddhi_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_nadi-shuddhi-guided_en.mp3', true, 27),
  ('namaskar-process', 'Namaskar Process', 'guided', 4, '/illustrations/Namaskar-process_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_namaskar-process-guided_en.mp3', true, 28),
  ('neck-practices', 'Neck Practices', 'guided', 7, '/illustrations/Neck-practices_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_neck-practices-guided_en.mp3', true, 29),
  ('rudraksha-diksha', 'Rudraksha Diksha', 'guided', 4, '/illustrations/Rudraksha-diksha_illustration.webp', 'https://images-sgex-prod.sadhguru.org/static-exclusive/assets/common/media/rd-yoga-yoga-yogeshwaraya.mp3', true, 30),
  ('samyama', 'Samyama', 'timed', 30, '/illustrations/Samyama_illustration.webp', NULL, false, 31),
  ('shakti-chalana', 'Shakti Chalana Kriya', 'unguided', 45, '/illustrations/Shakti-chalana-kriya_illustration.webp', NULL, true, 32),
  ('shambhavi', 'Shambhavi Mahamudra Kriya', 'unguided', 21, '/illustrations/Shambhavi-mahamudra-kriya_illustration.webp', NULL, true, 33),
  ('shambhavi-mudra', 'Shambhavi Mudra', 'guided', 4, '/illustrations/Shambhavi-mudra_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_shambhavi-mudra-guided_en.mp3', true, 34),
  ('shanmuki-mudra', 'Shanmuki Mudra', 'unguided', 16, '/illustrations/Shanmukhi-mudra_illustration.webp', NULL, true, 35),
  ('shiva-namaskar', 'Shiva Namaskar', 'unguided', 10, '/illustrations/Shiva-namaskar_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/sadhguru_app/siva_nam_Chant_Audio_new.mp3', true, 36),
  ('shoonya', 'Shoonya', 'unguided', 15, '/illustrations/Shoonya_illustration.webp', NULL, true, 37),
  ('simha-kriya', 'Simha Kriya', 'unguided', 3, '/illustrations/Simha-kriya_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/simha-kriya-guided_en.mp3', true, 38),
  ('squatting', 'Squatting', 'unguided', 1, '/illustrations/Squatting_illustration.webp', NULL, true, 39),
  ('sukha-kriya', 'Sukha Kriya', 'timed', 20, '/illustrations/Sukha-kriya_illustration.webp', NULL, false, 40),
  ('surya-kriya', 'Surya Kriya', 'unguided', 15, '/illustrations/Surya-kriya_illustration.webp', NULL, true, 41),
  ('surya-shakti', 'Surya Shakti', 'unguided', 12, '/illustrations/Surya-shakti_illustration.webp', NULL, true, 42),
  ('thoppukarnam', 'Thoppukarnam', 'unguided', 2, '/illustrations/placeholder.webp', NULL, true, 43),
  ('yoga-namaskar', 'Yoga Namaskar', 'guided', 4, '/illustrations/Yoga-namaskar_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/en/media/v3_yoga-namaskar-guided_en.mp3', true, 44),
  ('yogasanas', 'Yogasanas', 'unguided', 50, '/illustrations/Yogasanas_illustration.webp', NULL, true, 45),
  ('sadhguru-presence', 'Sadhguru''s Presence', 'guided', 10, '/illustrations/Sadhguru-presence_illustration.webp', 'https://images-sgex-prod.sadhguru.org/sgapp/assets/common/media/brahmananda-swarupa.mp3', true, 46)
on conflict (id) do nothing;
```

Verify: `select count(*) from practices;` → `47`.

## Security note

RLS restricts each user to their own rows (`auth_user_id = auth.uid()`); clients authenticate via email OTP. Never expose the service role key to the client.
