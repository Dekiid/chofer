import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { Spacing } from '@/constants/theme';
import { useConta } from '@/state/conta';

/** Aviso que desce do topo dentro da app, como as notificações do telemóvel, com o ícone da marca. */
export function AvisoTopo() {
  const { avisoTopo, marcarAvisosLidos } = useConta();
  if (!avisoTopo) return null;
  return (
    <SafeAreaView edges={['top']} style={estilos.posicao} pointerEvents="box-none">
      <Animated.View key={avisoTopo.id} entering={FadeInUp.duration(250)} exiting={FadeOutUp.duration(200)}>
        <Pressable onPress={marcarAvisosLidos} style={estilos.aviso} accessibilityRole="alert">
          <View style={estilos.icone}>
            <Text style={estilos.c}>c</Text>
            <View style={estilos.ponto} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={estilos.titulo}>{avisoTopo.titulo}</Text>
            <Text style={estilos.texto} numberOfLines={2}>
              {avisoTopo.texto}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  posicao: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 16, padding: Spacing.three, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, elevation: 10 },
  icone: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  c: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: -4 },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E', marginLeft: 1, marginTop: 8 },
  titulo: { color: '#000000', fontSize: 14, fontWeight: '800' },
  texto: { color: '#000000', fontSize: 13 },
});
