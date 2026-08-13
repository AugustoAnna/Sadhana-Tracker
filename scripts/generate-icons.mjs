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

async function onBackground(input, size, contentSize) {
  const offset = Math.round((size - contentSize) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([
      {
        input,
        top: offset,
        left: offset,
        resize: { width: contentSize, height: contentSize },
      },
    ])
    .png()
    .toBuffer();
}

await sharp(square).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
await sharp(square).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
await sharp(square)
  .resize(180, 180)
  .flatten({ background: BACKGROUND })
  .png()
  .toFile(`${OUT}/apple-touch-icon.png`);
await onBackground(square, 512, Math.round(512 * 0.8)).then((b) =>
  sharp(b).toFile(`${OUT}/icon-maskable-512.png`),
);

console.log(`Generated icons in ${OUT}`);
