import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/texto';
import { Vidro } from '@/components/vidro';
import { Radius, Spacing, VIDRO } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';

type Opcao<T extends string> = { id: T; nome: string };

type Props<T extends string> = {
  opcoes: readonly Opcao<T>[];
  valor: T;
  onMudar: (id: T) => void;
  style?: StyleProp<ViewStyle>;
};

const MOLA = { damping: 22, stiffness: 260, mass: 0.8 };

/** Seletor em pílula com a marca preta a deslizar para a opção escolhida, como na Uber. */
export function AlternadorModos<T extends string>({ opcoes, valor, onMudar, style }: Props<T>) {
  const c = usePalette();
  const [largura, setLargura] = useState(0);
  const indice = Math.max(0, opcoes.findIndex((o) => o.id === valor));
  const larguraOpcao = largura > 0 ? (largura - Spacing.one * 2) / opcoes.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(indice * larguraOpcao, MOLA);
  }, [indice, larguraOpcao, x]);

  const marca = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Vidro style={[estilos.caixa, !VIDRO && { backgroundColor: c.backgroundElement, borderWidth: 0 }, style]} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {larguraOpcao > 0 && <Animated.View pointerEvents="none" style={[estilos.marca, { width: larguraOpcao, backgroundColor: c.primary }, marca]} />}
      {opcoes.map((o) => {
        const ativa = o.id === valor;
        return (
          <Pressable key={o.id} onPress={() => onMudar(o.id)} style={estilos.opcao} accessibilityRole="tab" accessibilityState={{ selected: ativa }}>
            <Text style={[estilos.texto, { color: ativa ? c.onPrimary : c.textSecondary }]}>{o.nome}</Text>
          </Pressable>
        );
      })}
    </Vidro>
  );
}

const estilos = StyleSheet.create({
  caixa: { flexDirection: 'row', borderRadius: Radius.pill, padding: Spacing.one, overflow: 'hidden' },
  marca: { position: 'absolute', top: Spacing.one, bottom: Spacing.one, left: Spacing.one, borderRadius: Radius.pill },
  opcao: { flex: 1, paddingVertical: Spacing.two + 2, alignItems: 'center' },
  texto: { fontWeight: '700', fontSize: 14 },
});
