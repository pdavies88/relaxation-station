import '@/global.css';

import { Platform } from 'react-native';

/**
 * Clean neutral surfaces with a soft violet accent. Every text/background pair passes WCAG AA contrast.
 * The aura colors paint the glowing gradients behind the hero and the player.
 */
export const Colors = {
  light: {
    text: '#16142B',
    background: '#FAF9FD',
    backgroundElement: '#F1EFF8',
    backgroundSelected: '#E5E1F4',
    textSecondary: '#5F5B76',
    tint: '#4B3FB5',
    onTint: '#FFFFFF',
    danger: '#B42318',
    border: '#E5E1F4',
    heroBackground: '#EEEBFA',
    auraPrimary: '#A99CFF',
    auraSecondary: '#F0C6E8',
    /** Raised controls that sit on a tinted surface, such as the player's stop button. */
    controlSurface: '#FFFFFF',
  },
  dark: {
    text: '#F3F1FF',
    background: '#0A0A16',
    backgroundElement: '#15152A',
    backgroundSelected: '#22223F',
    textSecondary: '#A9A6C4',
    tint: '#A99CFF',
    onTint: '#14112E',
    danger: '#FDA29B',
    border: '#22223F',
    heroBackground: '#0F0E22',
    auraPrimary: '#5B4BD6',
    auraSecondary: '#8A3F8F',
    controlSurface: '#22223F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Manrope gives headings and buttons a clean, modern look. Body text stays in the system font.
 * Each weight is its own family, so pair these with fontWeight: 'normal'.
 */
export const DisplayFont = {
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

export const MaxContentWidth = 800;
