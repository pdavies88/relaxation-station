// Renders Google Play store listing images into store/android/.
// Run after changing the logo or retaking screenshots:  node scripts/generate-play-assets.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

import { buildLogoSvg } from '../src/components/brand/logo-svg.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const quicksand = (weight) =>
  join(root, `node_modules/@expo-google-fonts/quicksand/${weight}/Quicksand_${weight}.ttf`);

// Feature graphic: 1024 × 500, shown at the top of the Play listing. Matches the app's hero.
const LOGO_SIZE = 220;
const logo = buildLogoSvg().replace(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  `<svg x="${150 - LOGO_SIZE / 2}" y="${250 - LOGO_SIZE / 2}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" viewBox="0 0 64 64">`,
);

const dots = [
  [520, 70, 4, '#FFF4D6'], [960, 90, 6, '#FFD98A'], [880, 430, 5, '#A9E4F2'],
  [610, 450, 3, '#FFF4D6'], [40, 60, 4, '#FFD98A'], [70, 455, 5, '#A9E4F2'],
  [990, 300, 3, '#FFF4D6'], [330, 470, 4, '#FFD98A'], [760, 40, 3, '#FFF4D6'], [430, 30, 2, '#FFF4D6'],
];

const featureGraphic = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#151838"/>
      <stop offset="1" stop-color="#2A2470"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  ${dots.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.8"/>`).join('\n  ')}
  <circle cx="150" cy="250" r="140" fill="#F2F0FF" opacity="0.12"/>
  ${logo}
  <text x="330" y="235" font-family="Quicksand" font-weight="700" font-size="72" fill="#F2F0FF">Relaxation Station</text>
  <text x="334" y="305" font-family="Quicksand" font-weight="500" font-size="38" fill="#C5BCFF">Meditations &amp; soothing sounds</text>
  <text x="334" y="360" font-family="Quicksand" font-weight="500" font-size="25" fill="#ADA9C9">Free · works offline · plays with your screen locked</text>
</svg>`;

const outDir = join(root, 'store/android');
mkdirSync(outDir, { recursive: true });
const png = new Resvg(featureGraphic, {
  font: { fontFiles: [quicksand('700Bold'), quicksand('500Medium')], loadSystemFonts: false, defaultFontFamily: 'Quicksand' },
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
