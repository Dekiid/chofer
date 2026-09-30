/**
 * Paleta do Chauffeur: preto e branco, com o verde do ponto do logótipo como único destaque.
 */

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#5E5E5E',
    background: '#FFFFFF',
    backgroundElement: '#F3F3F3',
    backgroundSelected: '#E6E6E6',
    primary: '#000000',
    onPrimary: '#FFFFFF',
    accent: '#22C55E',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A6A6A6',
    background: '#0B0B0B',
    backgroundElement: '#1C1C1C',
    backgroundSelected: '#2A2A2A',
    primary: '#FFFFFF',
    onPrimary: '#000000',
    accent: '#22C55E',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const Radius = {
  card: 14,
  sheet: 24,
  pill: 999,
} as const;
