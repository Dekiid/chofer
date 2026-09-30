import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/constants/use-palette';

// react-native-maps não funciona na web; esta vista só serve para pré-visualizar o layout.
export function Mapa() {
  const cores = usePalette();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.backgroundSelected, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: cores.textSecondary }}>Mapa de Maputo e Matola</Text>
    </View>
  );
}
