import { Image } from 'expo-image';
import { useColorScheme, type StyleProp, type ImageStyle } from 'react-native';

const POSITIVO = require('../../assets/marca/logo-positivo.png');
const NEGATIVO = require('../../assets/marca/logo-negativo.png');

/** Logótipo oficial: texto preto no modo claro, branco no modo escuro. */
export function Logo({ altura = 28, style }: { altura?: number; style?: StyleProp<ImageStyle> }) {
  const escuro = useColorScheme() === 'dark';
  // Os ficheiros têm 720 × 150.
  return (
    <Image
      source={escuro ? NEGATIVO : POSITIVO}
      style={[{ height: altura, width: (altura * 720) / 150 }, style]}
      contentFit="contain"
      accessibilityLabel="Chauffeur"
    />
  );
}
