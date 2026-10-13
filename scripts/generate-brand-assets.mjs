// Renders the logo in src/components/brand/logo-svg.ts to the PNGs that app.json points at.
// Run after changing the logo:  node scripts/generate-brand-assets.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

// Node 24 strips TypeScript types on import, so the app's logo source can be used as-is.
import { buildLogoSvg } from '../src/components/brand/logo-svg.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function render(svg, size, outputPath) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(root, outputPath), png);
  console.log(`wrote ${outputPath} (${size}px)`);
}

// iOS masks the icon's corners itself, so the tile is drawn square and full-bleed.
render(buildLogoSvg({ cornerRadius: 0 }), 1024, 'assets/images/icon.png');
render(buildLogoSvg(), 1024, 'assets/images/splash-icon.png');
render(buildLogoSvg(), 48, 'assets/images/favicon.png');

// Google Play store listing icon (512 × 512, full-bleed square; Play rounds the corners).
render(buildLogoSvg({ cornerRadius: 0 }), 512, 'store/android/play-icon-512.png');

// Logo and favicon for the public privacy and support pages in docs/ (GitHub Pages).
render(buildLogoSvg(), 256, 'docs/logo.png');
render(buildLogoSvg(), 48, 'docs/favicon.png');

// Android adaptive icons crop to a central safe zone, so pad the plate into the middle ~60%.
const androidForeground = buildLogoSvg({ withBackground: false }).replace(
  'viewBox="0 0 64 64"',
  'viewBox="-22 -22 108 108"',
);
render(androidForeground, 1024, 'assets/images/android-icon-foreground.png');
