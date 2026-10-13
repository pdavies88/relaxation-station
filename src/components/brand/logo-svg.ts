/**
 * The Relaxation Station mark: a crescent moon resting above gentle sound waves, with a few stars,
 * on a deep twilight gradient.
 *
 * This file is the single source for the logo. The app renders it with `SvgXml`, and
 * `scripts/generate-brand-assets.mjs` renders the same markup to the app icon and splash PNGs.
 * Keep it free of imports so Node can load it directly.
 */

export type LogoSvgOptions = {
  /** Corner radius of the tile in 64-unit space. Use 0 for the iOS icon, which iOS masks itself. */
  cornerRadius?: number;
  /** Draw the gradient tile. Turn off for the Android adaptive icon foreground. */
  withBackground?: boolean;
};

export function buildLogoSvg({ cornerRadius = 16, withBackground = true }: LogoSvgOptions = {}): string {
  const background = withBackground
    ? `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#2A2470"/>
      <stop offset="0.55" stop-color="#4B3FB5"/>
      <stop offset="1" stop-color="#2E8FA8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${cornerRadius}" fill="url(#sky)"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${background}
  <circle cx="14" cy="13" r="1.3" fill="#FFF4D6"/>
  <circle cx="50" cy="11" r="1.1" fill="#FFF4D6"/>
  <circle cx="45" cy="22" r="0.9" fill="#FFF4D6" opacity="0.8"/>
  <path d="M9.5 21l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#FFF4D6" opacity="0.9"/>
  <path d="M35 10a14 14 0 1 0 9 25A11.5 11.5 0 0 1 35 10z" fill="#FFD98A"/>
  <g fill="none" stroke-linecap="round" stroke-width="3">
    <path d="M10 44c5.5-4.5 11-4.5 16.5 0s11 4.5 16.5 0 7.5-3.5 11-1.5" stroke="#FFFFFF" opacity="0.95"/>
    <path d="M10 52c5.5-4.5 11-4.5 16.5 0s11 4.5 16.5 0 7.5-3.5 11-1.5" stroke="#A9E4F2" opacity="0.85"/>
  </g>
</svg>`;
}
