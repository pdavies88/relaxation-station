/**
 * The Relaxation Station mark: a softly glowing orb inside two quiet ripples, like one slow breath,
 * on a deep violet gradient.
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
    ? `<linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1C1650"/>
      <stop offset="0.6" stop-color="#3B2F9E"/>
      <stop offset="1" stop-color="#6A55E0"/>
    </linearGradient>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    ${background}
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#C9BFFF" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#C9BFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb" cx="0.38" cy="0.32" r="0.8">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.45" stop-color="#E4DEFF"/>
      <stop offset="1" stop-color="#A99CFF"/>
    </radialGradient>
  </defs>
  ${withBackground ? `<rect width="64" height="64" rx="${cornerRadius}" fill="url(#tile)"/>` : ''}
  <circle cx="32" cy="32" r="24" fill="url(#glow)"/>
  <circle cx="32" cy="32" r="21" fill="none" stroke="#E4DEFF" stroke-opacity="0.22" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="15.5" fill="none" stroke="#E4DEFF" stroke-opacity="0.45" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="10" fill="url(#orb)"/>
</svg>`;
}
