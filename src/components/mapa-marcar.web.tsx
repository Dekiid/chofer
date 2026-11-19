import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { usePalette } from '@/constants/use-palette';

import type { MapaMarcarProps } from './mapa-marcar';

// Na web não há mapa verdadeiro: uma grelha de ruas que se arrasta, só para pré-visualizar o gesto.
const GRAUS_POR_PX = 0.00002;
const QUADRA = 60;

export function MapaMarcar({ inicial, onMexer, onMover }: MapaMarcarProps) {
  const cores = usePalette();
  const [desvio, setDesvio] = useState({ x: 0, y: 0 });
  const base = useRef({ x: 0, y: 0 });
  const arrasto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onMexer(),
      onPanResponderMove: (_, g) => setDesvio({ x: base.current.x + g.dx, y: base.current.y + g.dy }),
      onPanResponderRelease: (_, g) => {
        base.current = { x: base.current.x + g.dx, y: base.current.y + g.dy };
        onMover({ latitude: inicial.latitude + base.current.y * GRAUS_POR_PX, longitude: inicial.longitude - base.current.x * GRAUS_POR_PX });
      },
    }),
  ).current;

  const ox = ((desvio.x % QUADRA) + QUADRA) % QUADRA;
  const oy = ((desvio.y % QUADRA) + QUADRA) % QUADRA;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.mapa, overflow: 'hidden' }]} {...arrasto.panHandlers}>
      {Array.from({ length: 20 }, (_, i) => (
        <View key={`v${i}`} style={[estilos.rua, { backgroundColor: cores.backgroundSelected, left: ox + (i - 1) * QUADRA, top: 0, bottom: 0, width: 3 }]} />
      ))}
      {Array.from({ length: 30 }, (_, i) => (
        <View key={`h${i}`} style={[estilos.rua, { backgroundColor: cores.backgroundSelected, top: oy + (i - 1) * QUADRA, left: 0, right: 0, height: 3 }]} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  rua: { position: 'absolute' },
});
