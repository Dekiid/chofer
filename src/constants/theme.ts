/**
 * Paleta do Chauffeur, do manual de identidade: preto e branco, asfalto claro nos cartões e o verde
 * de recolha (o ponto do logótipo) como único destaque. Nunca usar o verde como cor de texto sobre branco.
 */

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#5E6360',
    background: '#FFFFFF',
    backgroundElement: '#F3F5F4',
    backgroundSelected: '#E3E8E5',
    primary: '#000000',
    onPrimary: '#FFFFFF',
    accent: '#22C55E',
    /** Botão principal: verde com texto preto. */
    go: '#22C55E',
    onGo: '#000000',
    mapa: '#EEF1EF',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#9BA19E',
    background: '#0B0B0B',
    backgroundElement: '#1B1D1C',
    backgroundSelected: '#2A2D2B',
    primary: '#FFFFFF',
    onPrimary: '#000000',
    accent: '#22C55E',
    go: '#22C55E',
    onGo: '#000000',
    mapa: '#161817',
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
  /** Botões e campos de pesquisa. */
  botao: 10,
  sheet: 20,
  pill: 999,
} as const;
