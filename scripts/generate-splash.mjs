import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// iPhone launch screens for the installed app. iOS ignores the manifest's
// background_color and shows an apple-touch-startup-image matched by exact
// screen size instead, so each screen needs its own full-size image. Keep this
// list in step with the <link rel="apple-touch-startup-image"> tags in index.html.
const OUT = 'public/splash';
const BACKGROUND = '#141311'; // dark --color-page, same as the manifest's background_color

// Portrait CSS size and pixel ratio (the app is portrait-only).
const IPHONES = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { width: 428, height: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 414, height: 736, ratio: 3 }, // 6/7/8 Plus
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12/13 mini
  { width: 375, height: 667, ratio: 2 }, // 6/7/8, SE 2nd/3rd gen
  { width: 320, height: 568, ratio: 2 }, // SE 1st gen
];

await mkdir(OUT, { recursive: true });

for (const { width, height, ratio } of IPHONES) {
  const w = width * ratio;
  const h = height * ratio;
  await sharp({ create: { width: w, height: h, channels: 3, background: BACKGROUND } })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/iphone-${w}x${h}.png`);
}
