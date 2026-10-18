// Renders Google Play store listing images into store/android/.
// Run after changing the logo or retaking screenshots:  node scripts/generate-play-assets.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

import { buildLogoSvg } from '../src/components/brand/logo-svg.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manrope = (weight) =>
  join(root, `node_modules/@expo-google-fonts/manrope/${weight}/Manrope_${weight}.ttf`);

// Feature graphic: 1024 × 500, shown at the top of the Play listing. Matches the app's dark hero.
const LOGO_SIZE = 200;
const logo = buildLogoSvg({ cornerRadius: 14 }).replace(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  `<svg x="${170 - LOGO_SIZE / 2}" y="${250 - LOGO_SIZE / 2}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" viewBox="0 0 64 64">`,
);

const featureGraphic = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <radialGradient id="violet" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#5B4BD6" stop-opacity="0.85"/>
      <stop offset="0.45" stop-color="#5B4BD6" stop-opacity="0.4"/>
      <stop offset="1" stop-color="#5B4BD6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="rose" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8A3F8F" stop-opacity="0.8"/>
      <stop offset="0.45" stop-color="#8A3F8F" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#8A3F8F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="#0F0E22"/>
  <circle cx="880" cy="60" r="360" fill="url(#violet)"/>
  <circle cx="120" cy="470" r="280" fill="url(#rose)"/>
  ${logo}
  <text x="330" y="232" font-family="Manrope" font-weight="800" font-size="68" letter-spacing="-2" fill="#F3F1FF">Relaxation Station</text>
  <text x="333" y="292" font-family="Manrope" font-weight="600" font-size="34" letter-spacing="-0.5" fill="#C9BFFF">Meditations &amp; soothing sounds</text>
  <text x="333" y="345" font-family="Manrope" font-weight="500" font-size="24" fill="#A9A6C4">Free · works offline · plays with your screen locked</text>
</svg>`;

const outDir = join(root, 'store/android');
mkdirSync(outDir, { recursive: true });
const png = new Resvg(featureGraphic, {
  font: {
    fontFiles: [manrope('800ExtraBold'), manrope('600SemiBold'), manrope('500Medium')],
    loadSystemFonts: false,
    defaultFontFamily: 'Manrope',
  },
}).render().asPng();
writeFileSync(join(outDir, 'feature-graphic-1024x500.png'), png);
console.log('wrote store/android/feature-graphic-1024x500.png');

// Phone screenshots. Play rejects images whose long side is more than twice the short side.
// The iPhone shots are 1320 × 2868, so crop the iOS status bar off the top to get 1320 × 2640.
const iosDir = join(root, 'store/screenshots');
const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const CROP_TOP = 228;
for (const file of readdirSync(iosDir).filter((name) => /^0\d-.*\.png$/.test(name))) {
  const data = readFileSync(join(iosDir, file)).toString('base64');
  const cropped = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1320" height="2640">
    <image x="0" y="-${CROP_TOP}" width="1320" height="2868" xlink:href="data:image/png;base64,${data}"/>
  </svg>`;
  writeFileSync(join(shotsDir, file), new Resvg(cropped).render().asPng());
  console.log(`wrote store/android/screenshots/${file}`);
}
