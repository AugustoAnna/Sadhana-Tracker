/**
 * Scans public/illustrations, public/audio, and public/programs/*.json
 * and writes src/data/generated/assetManifest.json for build-time resolution.
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

async function listDir(sub) {
  const dir = join(publicDir, sub);
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function loadPrograms() {
  const files = await listDir('programs');
  const programs = {};
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(publicDir, 'programs', file), 'utf8');
      const data = JSON.parse(raw);
      const id = data.practiceId ?? data.id ?? basename(file, '.json');
      programs[id] = data;
    } catch (e) {
      console.warn(`Skipping invalid program JSON ${file}:`, e.message);
    }
  }
  return programs;
}

async function main() {
  const illustrationFiles = await listDir('illustrations');
  const audioFiles = await listDir('audio');
  const programs = await loadPrograms();

  const illustrations = {};
  for (const file of illustrationFiles) {
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const slug = basename(file, ext);
    if (!illustrations[slug]) illustrations[slug] = [];
    illustrations[slug].push(`/illustrations/${file}`);
  }

  const audio = {};
  for (const file of audioFiles) {
    const ext = extname(file).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;
    const slug = basename(file, ext);
    if (!audio[slug]) audio[slug] = [];
    audio[slug].push(`/audio/${file}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    illustrations,
    audio,
    programs,
    illustrationFileCount: illustrationFiles.length,
    audioFileCount: audioFiles.filter((f) => AUDIO_EXT.has(extname(f).toLowerCase())).length,
    programFileCount: Object.keys(programs).length,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, JSON.stringify(manifest, null, 2));
  console.log(
    `asset manifest: ${manifest.illustrationFileCount} illustration files, ` +
    `${manifest.audioFileCount} audio files, ${manifest.programFileCount} program JSONs`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
