import '@/global.css';

import { Platform } from 'react-native';

/** A calm night-sky palette. Every text/background pair passes WCAG AA contrast. */
export const Colors = {
  light: {
    text: '#1B1838',
    background: '#F6F4FF',
    backgroundElement: '#ECE9FB',
    backgroundSelected: '#DDD8F6',
    textSecondary: '#5E5A78',
    tint: '#4B3FB5',
    onTint: '#FFFFFF',
    danger: '#B42318',
    border: '#DDD8F6',
    heroBackground: '#E6E2FF',
  },
  dark: {
    text: '#F2F0FF',
    background: '#0D0F22',
    backgroundElement: '#1A1C36',
    backgroundSelected: '#272A4A',
    textSecondary: '#ADA9C9',
    tint: '#A99CFF',
    onTint: '#14112E',
    danger: '#FDA29B',
    border: '#272A4A',
    heroBackground: '#151838',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Quicksand gives headings and buttons a soft, rounded look. Body text stays in the system font.
 * Each weight is its own family, so pair these with fontWeight: 'normal'.
 */
export const DisplayFont = {
  medium: 'Quicksand_500Medium',
  semiBold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
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

/**
 * Distance from the bottom safe-area edge to just above the tab bar. iOS 26+ floats the tab bar
 * above the home indicator, so content that sits over the tab bar needs this much clearance.
 */
export const TabBarClearance = Platform.select({ ios: 74, android: 84 }) ?? 0;
export const MaxContentWidth = 800;
