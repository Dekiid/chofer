import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { nomeViatura, type Viatura } from '@/data/categorias';

/** Foto real do modelo escolhido, com o crédito exigido pela licença. */
export function FotoCarro({ viatura, style }: { viatura: Viatura; style?: StyleProp<ViewStyle> }) {
  const cores = usePalette();
  const [falhou, setFalhou] = useState<string | null>(null);

  return (
    <View style={[estilos.moldura, { backgroundColor: cores.backgroundSelected }, style]}>
      {falhou === viatura.id ? (
        <View style={estilos.centro}>
          <Text style={{ color: cores.textSecondary }}>{nomeViatura(viatura)}</Text>
        </View>
      ) : (
        <Image
          source={viatura.foto}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          accessibilityLabel={`Foto de um ${nomeViatura(viatura)}`}
          onError={() => setFalhou(viatura.id)}
        />
      )}
      <Pressable onPress={() => WebBrowser.openBrowserAsync(viatura.credito.pagina)} style={estilos.credito}>
        <Text style={estilos.creditoTexto}>
          Foto: {viatura.credito.autor} · {viatura.credito.licenca}
        </Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  moldura: { overflow: 'hidden', borderRadius: Radius.sheet },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  credito: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  creditoTexto: { color: '#FFFFFF', fontSize: 11 },
});
