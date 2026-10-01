import * as Location from 'expo-location';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { pedirAutorizacao } from '@/data/avisos-telemovel';
import { useSessao } from '@/state/sessao';

/** Último passo do registo: dá as boas-vindas e pede a localização e os avisos. */
export function BemVindo() {
  const c = usePalette();
  const s = estilos(c);
  const sessao = useSessao();
  const [aPedir, setAPedir] = useState(false);

  async function permitir() {
    setAPedir(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {}
    if (Platform.OS !== 'web') await pedirAutorizacao();
    setAPedir(false);
    sessao.fecharBemVindo();
  }

  return (
    <Modal visible={sessao.bemVindo} animationType="slide" onRequestClose={sessao.fecharBemVindo}>
      <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
        <View style={s.corpo}>
          <View style={s.mapa}>
            <View style={s.halo}>
              <View style={s.pino} />
            </View>
          </View>
          <Text style={s.titulo}>Tudo pronto, {sessao.perfil?.nome}</Text>
          <Text style={s.texto}>Permite a localização para o motorista te encontrar e para sugerirmos o ponto de recolha.</Text>
          <View style={s.linha}>
            <Text style={s.icone}>📍</Text>
            <Text style={s.ponto}>Recolha no sítio onde estás, sem escrever a morada.</Text>
          </View>
          <View style={s.linha}>
            <Text style={s.icone}>🔔</Text>
            <Text style={s.ponto}>Avisos quando o motorista está a caminho e quando chega.</Text>
          </View>
        </View>
        <View style={s.rodape}>
          <BotaoPrincipal texto={aPedir ? 'Um momento…' : 'Permitir localização e avisos'} onPress={permitir} desativado={aPedir} />
          <Text style={s.agoraNao} onPress={sessao.fecharBemVindo}>
            Agora não
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    corpo: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
    mapa: { height: 180, borderRadius: Radius.card, backgroundColor: c.backgroundElement, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.four },
    halo: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34,197,94,0.25)', alignItems: 'center', justifyContent: 'center' },
    pino: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.go, borderWidth: 5, borderColor: '#FFFFFF' },
    titulo: { color: c.text, fontSize: 28, fontWeight: '800', marginBottom: Spacing.two },
    texto: { color: c.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: Spacing.four },
    linha: { flexDirection: 'row', gap: Spacing.three, marginBottom: Spacing.three, alignItems: 'flex-start' },
    icone: { fontSize: 18 },
    ponto: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
    rodape: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.three },
    agoraNao: { color: c.text, fontSize: 15, fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline', paddingVertical: Spacing.two },
  });
}
