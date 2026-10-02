import { forwardRef } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

/**
 * Text e TextInput com a letra da marca (Manrope). Cada peso é um ficheiro de letra próprio,
 * por isso o fontWeight de cada estilo passa a escolher a família certa.
 */
const FAMILIAS: Record<string, string> = {
  '400': 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_700Bold',
  '700': 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
  '900': 'Manrope_800ExtraBold',
};

function comLetra(style: TextProps['style'], pesoPadrao: string) {
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const peso = plano.fontWeight === 'bold' ? '700' : plano.fontWeight === 'normal' || plano.fontWeight == null ? pesoPadrao : String(plano.fontWeight);
  return [plano, { fontFamily: FAMILIAS[peso] ?? FAMILIAS[pesoPadrao], fontWeight: undefined }];
}

export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={comLetra(style, '500')} />;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={comLetra(style, '500')} />;
});
