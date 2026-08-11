/**
 * Scans public/illustrations, public/audios/programs.json, and optional local audio files.
 * Writes src/data/generated/assetManifest.json for build-time resolution.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const publicDir = join(root, 'public');
const outDir = join(root, 'src', 'data', 'generated');
const outFile = join(outDir, 'assetManifest.json');

const IMAGE_EXT = new Set(['.png', '.webp', '.jpg', '.jpeg']);
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.wav']);

/** All practice slugs from catalogue.ts */
const CATALOGUE_SLUGS = new Set([
  'achala-arpanam', 'angamardana', 'ardhasiddhasana', 'aum-chanting', 'bhakti-sadhana',
  'bhastrika-kriya', 'bhuta-shuddhi', 'breath-watching', 'chit-shakti-health', 'chit-shakti-love',
  'chit-shakti-peace', 'chit-shakti-success', 'devi-sadhana', 'directional-movements', 'eye-care',
  'guru-mahima', 'guru-pooja', 'infinity-meditation', 'ie-crash-course', 'isha-kriya', 'jala-neti',
  'knee-rotations', 'linga-bhairavi-arati', 'living-soil', 'mahamantra', 'margazhi-mantra',
  'nada-yoga', 'nadi-shuddhi', 'namaskar-process', 'neck-practices', 'rudraksha-diksha',
  'sadhguru-presence', 'samyama', 'shakti-chalana', 'shambhavi', 'shambhavi-mudra',
  'shanmuki-mudra', 'shiva-namaskar', 'shoonya', 'simha-kriya', 'squatting', 'sukha-kriya',
  'surya-kriya', 'surya-shakti', 'thoppukarnam', 'yoga-namaskar', 'yogasanas',
]);

/** Filename stem (after normalization) → catalogue slug when they differ */
const ILLUSTRATION_ALIASES = {
  'inner-engineering-crash-course': 'ie-crash-course',
  'eye-practices': 'eye-care',
  'living-soil-meditation': 'living-soil',
  'cs-for-health': 'chit-shakti-health',
  'cs-for-love': 'chit-shakti-love',
  'cs-for-peace': 'chit-shakti-peace',
  'cs-for-success': 'chit-shakti-success',
  'shambhavi-mahamudra-kriya': 'shambhavi',
  'ardha-siddhasana': 'ardhasiddhasana',
  'squat': 'squatting',
  'shakti-chalana-kriya': 'shakti-chalana',
  'shanmukhi-mudra': 'shanmuki-mudra',
};

/** programs.json meditation keys → practice slug */
const MEDITATION_AUDIO_KEYS = {
  isha_kriya_meditation_audio: 'isha-kriya',
  infinity_meditation_video: 'infinity-meditation',
  chit_shakti_health_audio: 'chit-shakti-health',
  chit_shakti_love_audio: 'chit-shakti-love',
  chit_shakti_peace_audio: 'chit-shakti-peace',
  chit_shakti_success_audio: 'chit-shakti-success',
  sadhguru_presence_audio: 'sadhguru-presence',
  margazhi_mantra_audio: 'margazhi-mantra',
  soil_meditation_audio: 'living-soil',
  ieo_crash_course_audio: 'ie-crash-course',
  rudraksha_diksha_audio: 'rudraksha-diksha',
  guru_pooja_audio: 'guru-pooja',
  achala_arpanam_audio: 'achala-arpanam',
};

/** programs.json practice keys → practice slug */
const PRACTICE_AUDIO_KEYS = {
  health: 'directional-movements',
  success: 'neck-practices',
  peace: 'nadi-shuddhi',
  love: 'namaskar-process',
  joy: 'nada-yoga',
  innerExploration: 'shambhavi-mudra',
  wellbeing: 'yoga-namaskar',
  simhaKriya: 'simha-kriya',
  mahamantra: 'mahamantra',
  presence: 'sadhguru-presence',
  guru: 'guru-pooja',
  rudraksha: 'rudraksha-diksha',
  shivaNamaskar: 'shiva-namaskar',
  devi: 'devi-sadhana',
  margazhi_mantra: 'margazhi-mantra',
  sashtanga: 'living-soil',
};

async function listDir(sub) {
  const dir = join(publicDir, sub);
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

function illustrationStemToSlug(filename) {
  const ext = extname(filename).toLowerCase();
  const stem = basename(filename, ext)
    .replace(/_illustration$/i, '')
    .toLowerCase()
    .replace(/_/g, '-');
  const slug = ILLUSTRATION_ALIASES[stem] ?? stem;
  return CATALOGUE_SLUGS.has(slug) ? slug : null;
}

async function loadProgramsFromAudiosJson() {
  const programs = {};
  const path = join(publicDir, 'audios', 'programs.json');
  try {
    const raw = await readFile(path, 'utf8');
    const data = JSON.parse(raw);
    const yoga = data.yoga ?? data;

    const meditations = yoga.meditations ?? {};
    for (const [key, value] of Object.entries(meditations)) {
      const slug = MEDITATION_AUDIO_KEYS[key];
      const url = value?.en;
      if (slug && url) {
        programs[slug] = { audioPath: url, source: `meditations.${key}` };
      }
    }

    const practices = yoga.practices ?? {};
    for (const [key, value] of Object.entries(practices)) {
      const slug = PRACTICE_AUDIO_KEYS[key];
      const url = value?.en;
      if (slug && url && !programs[slug]) {
        programs[slug] = { audioPath: url, source: `practices.${key}` };
      } else if (slug && url) {
        // prefer meditations entry if already set
      }
    }
  } catch (e) {
    console.warn('Could not load public/audios/programs.json:', e.message);
  }
  return programs;
}

async function main() {
  const illustrationFiles = await listDir('illustrations');
  const audioDirFiles = [
    ...(await listDir('audio')),
    ...(await listDir('audios')),
  ];
  const programs = await loadProgramsFromAudiosJson();

  const illustrations = {};
  const unmatchedIllustrations = [];

  for (const file of illustrationFiles) {
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const slug = illustrationStemToSlug(file);
    const url = `/illustrations/${file}`;
    if (slug) {
      if (!illustrations[slug]) illustrations[slug] = [];
      illustrations[slug].push(url);
    } else {
      unmatchedIllustrations.push(file);
    }
  }

  const audio = {};
  for (const file of audioDirFiles) {
    const ext = extname(file).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;
    const slug = basename(file, ext).toLowerCase();
    if (!CATALOGUE_SLUGS.has(slug)) continue;
    if (!audio[slug]) audio[slug] = [];
    const prefix = (await listDir('audios')).includes(file) ? '/audios' : '/audio';
    audio[slug].push(`${prefix}/${file}`);
  }

  const practicesWithoutIllustration = [...CATALOGUE_SLUGS].filter((id) => !illustrations[id]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    illustrations,
    audio,
    programs,
    practicesWithoutIllustration,
    unmatchedIllustrations,
    illustrationFileCount: illustrationFiles.filter((f) =>
      IMAGE_EXT.has(extname(f).toLowerCase()),
    ).length,
    audioFileCount: audioDirFiles.filter((f) =>
      AUDIO_EXT.has(extname(f).toLowerCase()),
    ).length,
    programFileCount: Object.keys(programs).length,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, JSON.stringify(manifest, null, 2));

  console.log(
    `asset manifest: ${manifest.illustrationFileCount} illustration files → ${Object.keys(illustrations).length} practices`,
  );
  console.log(
    `audio: ${manifest.programFileCount} URLs from programs.json, ${manifest.audioFileCount} local files`,
  );
  if (unmatchedIllustrations.length) {
    console.log(`unmatched illustrations: ${unmatchedIllustrations.join(', ')}`);
  }
  if (practicesWithoutIllustration.length) {
    console.log(`practices without illustration: ${practicesWithoutIllustration.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
