import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { nomeViatura, type CreditoFoto, type Viatura } from '@/data/categorias';
import { Text } from '@/components/texto';
import { t } from '@/i18n';

type Props = {
  viatura: Viatura;
  style?: StyleProp<ViewStyle>;
  /** Mostra outra foto no lugar da do carro, por exemplo um exemplo de decoração de casamento. */
  ilustracao?: { foto: ImageSourcePropType; credito?: CreditoFoto; etiqueta: string };
};

/** Foto real do modelo escolhido, com o crédito exigido pela licença. */
export function FotoCarro({ viatura, style, ilustracao }: Props) {
  const cores = usePalette();
  const [falhou, setFalhou] = useState<string | null>(null);
  const foto = ilustracao?.foto ?? viatura.foto;
  const credito = ilustracao ? ilustracao.credito : viatura.credito;
  // Carro recortado: aparece solto sobre o fundo do ecrã, sem moldura nem cenário.
  const solto = !ilustracao && viatura.semFundo;

  return (
    <View style={[estilos.moldura, !solto && { backgroundColor: cores.backgroundSelected, borderRadius: Radius.sheet }, style]}>
      {falhou === viatura.id ? (
        <View style={estilos.centro}>
          <Text style={{ color: cores.textSecondary }}>{nomeViatura(viatura)}</Text>
        </View>
      ) : (
        <Image
          source={foto}
          style={StyleSheet.absoluteFill}
          contentFit={solto ? 'contain' : 'cover'}
          transition={250}
          accessibilityLabel={ilustracao ? ilustracao.etiqueta : t('Foto do {carro}', { carro: nomeViatura(viatura) })}
          onError={() => setFalhou(viatura.id)}
        />
      )}
      {ilustracao && (
        <View style={estilos.etiqueta} pointerEvents="none">
          <Text style={estilos.etiquetaTexto}>{ilustracao.etiqueta}</Text>
        </View>
      )}
      {credito && (
        <Pressable onPress={() => WebBrowser.openBrowserAsync(credito.pagina)} style={[estilos.credito, solto && estilos.creditoSolto]}>
          <Text style={[estilos.creditoTexto, solto && { color: cores.textSecondary }]}>
            {t('Foto: {autor} · {licenca}', { autor: credito.autor, licenca: credito.licenca })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  moldura: { overflow: 'hidden' },
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
  creditoSolto: { backgroundColor: 'transparent', bottom: 0, right: 0 },
  etiqueta: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  etiquetaTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
