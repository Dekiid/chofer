import { useColorScheme } from 'react-native';

import { Colors, VIDRO, type Palette } from './theme';

// Com o vidro, os cartões dentro dos painéis ficam translúcidos para deixar ver o que está por trás.
const VIDRO_CLARO: Partial<Palette> = { backgroundElement: 'rgba(0,0,0,0.045)', backgroundSelected: 'rgba(0,0,0,0.09)' };
const VIDRO_ESCURO: Partial<Palette> = { backgroundElement: 'rgba(255,255,255,0.07)', backgroundSelected: 'rgba(255,255,255,0.13)' };
const CLARO: Palette = VIDRO ? { ...Colors.light, ...VIDRO_CLARO } : Colors.light;
const ESCURO: Palette = VIDRO ? { ...Colors.dark, ...VIDRO_ESCURO } : Colors.dark;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? ESCURO : CLARO;
}
