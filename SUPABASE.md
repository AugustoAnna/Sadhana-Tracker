# Supabase Setup

**Project:** `sadhana tracker`  
**URL:** https://mmzzcigydnelnxdhmoqw.supabase.co

V3 schema (participants, practices, participant_practices, practice_completed, reminders, events) with anonymous auth and per-user RLS.

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

RLS restricts each user to their own rows (`auth_user_id = auth.uid()`); clients authenticate via anonymous sign-in. Never expose the service role key to the client.
