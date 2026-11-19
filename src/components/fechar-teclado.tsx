import type { ReactNode } from 'react';
import { Keyboard, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * No telemóvel, tocar fora dos campos esconde o teclado (o teclado numérico do iPhone não tem tecla para fechar).
 * Na web não há teclado para esconder, e o clique no campo também chegava aqui e tirava-lhe o foco
 * ao largar o rato; por isso na web é só uma View.
 */
export function FecharTeclado({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (Platform.OS === 'web') return <View style={style}>{children}</View>;
  return (
    <Pressable style={style} onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </Pressable>
  );
}
