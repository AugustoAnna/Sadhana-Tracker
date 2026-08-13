import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'public/icons/icon-master.png';
const OUT = 'public/icons';
const BACKGROUND = '#FDFBF5';

await mkdir(OUT, { recursive: true });

const image = sharp(SRC);
const { width, height } = await image.metadata();

const square = await image
  .resize({ width: Math.min(width, height), height: Math.min(width, height), fit: 'cover' })
  .png()
  .toBuffer();

const outputs = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of outputs) {
  await sharp(square).resize(size, size).png().toFile(`${OUT}/${file}`);
}

const safeScale = 0.8;
const safeSize = Math.round(512 * safeScale);
await sharp({
  create: { width: 512, height: 512, channels: 4, background: BACKGROUND },
})
  .composite([
    {
      input: square,
      top: Math.round((512 - safeSize) / 2),
      left: Math.round((512 - safeSize) / 2),
      resize: { width: safeSize, height: safeSize },
    },
  ])
  .png()
  .toFile(`${OUT}/icon-maskable-512.png`);

console.log(`Generated icons in ${OUT}`);
