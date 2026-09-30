import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/texto';
import { usePalette } from '@/constants/use-palette';

import type { MapaProps } from './mapa-tipos';

// react-native-maps não funciona na web; esta vista só serve para pré-visualizar o layout,
// com os marcadores do manual de identidade em posições fixas.
export function Mapa({ origem, destino }: MapaProps) {
  const cores = usePalette();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.mapa, alignItems: 'center', paddingTop: 60 }]}>
      <Text style={{ color: cores.textSecondary }}>Mapa de Maputo e Matola</Text>
      {origem && destino && <View style={[estilos.rota, { backgroundColor: cores.text }]} />}
      {destino && <View style={[estilos.destino, { backgroundColor: cores.text, borderColor: cores.background }]} />}
      {origem && (
        <View style={estilos.halo}>
          <View style={estilos.recolha} />
        </View>
      )}
    </View>
  );
}

// Recolha a 30% / 24%, destino a 70% / 12% do ecrã; a rota é a linha entre os dois.
const estilos = StyleSheet.create({
  halo: { position: 'absolute', left: '30%', top: '24%', width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.22)', alignItems: 'center', justifyContent: 'center' },
  recolha: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E', borderWidth: 3, borderColor: '#FFFFFF' },
  destino: { position: 'absolute', left: '70%', top: '12%', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderWidth: 3 },
  rota: { position: 'absolute', left: '30%', top: '24%', width: '48%', height: 4, marginTop: -2, transformOrigin: 'left center', transform: [{ rotate: '-33deg' }] },
});
