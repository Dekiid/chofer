import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/texto';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';

const BOLA = 52;
const MARGEM = 4;
// Tem de arrastar quase até ao fim; antes disso, a bola volta ao início.
const LIMITE = 0.85;

/**
 * Botão de deslizar, como na Uber: para aceitar ou recusar um pedido é preciso arrastar a bola até ao fim,
 * para não aceitar sem querer com um toque.
 */
export function BotaoDeslizar({ texto, onConfirmar, tipo = 'principal' }: { texto: string; onConfirmar: () => void; tipo?: 'principal' | 'secundario' }) {
  const c = usePalette();
  const [largura, setLargura] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const maximo = Math.max(0, largura - BOLA - MARGEM * 2);
  // O gesto é criado uma vez; estas referências dão-lhe a largura e a ação atuais.
  const curso = useRef(0);
  const confirmar = useRef(onConfirmar);
  useEffect(() => {
    curso.current = maximo;
    confirmar.current = onConfirmar;
  });

  const arrasto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Dentro de uma lista, o deslizar não passa para o scroll a meio do gesto.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(curso.current, Math.max(0, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (curso.current > 0 && g.dx >= curso.current * LIMITE) {
          Animated.timing(x, { toValue: curso.current, duration: 120, useNativeDriver: false }).start(() => {
            confirmar.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;

  const principal = tipo === 'principal';
  const fundo = principal ? c.go : c.backgroundElement;
  const corTexto = principal ? '#000000' : c.text;
  const opacidadeTexto = x.interpolate({ inputRange: [0, Math.max(1, maximo * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      style={[estilos.calha, { backgroundColor: fundo }]}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={texto}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onConfirmar()}>
      <Animated.Text style={[estilos.texto, { color: corTexto, opacity: opacidadeTexto }]} numberOfLines={1}>
        {texto}
      </Animated.Text>
      <Animated.View {...arrasto.panHandlers} style={[estilos.bola, SEM_GESTOS_DO_BROWSER, { backgroundColor: principal ? '#000000' : c.primary, transform: [{ translateX: x }] }]}>
        <Text style={[estilos.seta, { color: principal ? c.go : c.onPrimary }]}>»</Text>
      </Animated.View>
    </View>
  );
}

// Na web, o browser não pode tratar o arrasto como scroll.
const SEM_GESTOS_DO_BROWSER = (Platform.OS === 'web' ? { touchAction: 'none' } : {}) as ViewStyle;

const estilos = StyleSheet.create({
  calha: { height: BOLA + MARGEM * 2, borderRadius: Radius.pill, justifyContent: 'center', overflow: 'hidden' },
  texto: { position: 'absolute', left: BOLA + MARGEM * 2, right: MARGEM * 2, textAlign: 'center', fontSize: 16, fontWeight: '800', fontFamily: 'Manrope_800ExtraBold' },
  bola: { position: 'absolute', left: MARGEM, width: BOLA, height: BOLA, borderRadius: BOLA / 2, alignItems: 'center', justifyContent: 'center' },
  seta: { fontSize: 24, fontWeight: '800', marginTop: -2 },
});
