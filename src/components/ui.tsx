import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { Text } from '@/components/texto';

/** Painel que fica por cima do mapa, preso ao fundo do ecrã. */
export function Painel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.background,
          borderTopLeftRadius: Radius.sheet,
          borderTopRightRadius: Radius.sheet,
          paddingHorizontal: Spacing.three,
          paddingBottom: Spacing.three,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 12,
        },
        style,
      ]}>
      <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.backgroundSelected, marginVertical: Spacing.two }} />
      {children}
    </SafeAreaView>
  );
}

/** Verde com texto preto (confirmar, pagar, contactar); «escuro» é o preto do manual, para «Pedir chauffeur». */
export function BotaoPrincipal({ texto, onPress, desativado, escuro }: { texto: string; onPress: () => void; desativado?: boolean; escuro?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado}
      style={{ backgroundColor: escuro ? c.primary : c.go, opacity: desativado ? 0.4 : 1, borderRadius: Radius.botao, paddingVertical: Spacing.three, alignItems: 'center' }}>
      <Text style={{ color: escuro ? c.onPrimary : c.onGo, fontSize: 16, fontWeight: '700' }}>{texto}</Text>
    </Pressable>
  );
}

export function BotaoSecundario({ texto, onPress }: { texto: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: c.backgroundElement, borderRadius: Radius.botao, paddingVertical: Spacing.three, alignItems: 'center' }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{texto}</Text>
    </Pressable>
  );
}

/** Campo de pesquisa da marca: asfalto claro, ponto verde de recolha à esquerda. */
export function CampoPesquisa({ texto, onPress }: { texto: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.botao, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.go }} />
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{texto}</Text>
    </Pressable>
  );
}

export function BotaoVoltar({ onPress }: { onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Voltar"
      style={[estilos.voltar, { backgroundColor: c.background }]}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', marginTop: -2 }}>‹</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  voltar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
