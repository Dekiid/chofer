import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/constants/use-palette';

import type { MapaProps } from './mapa-tipos';

// react-native-maps não funciona na web; esta vista só serve para pré-visualizar o layout.
export function Mapa(_props: MapaProps) {
  const cores = usePalette();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.backgroundSelected, alignItems: 'center', paddingTop: 120 }]}>
      <Text style={{ color: cores.textSecondary }}>Mapa de Maputo e Matola</Text>
    </View>
  );
}
