import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/texto';
import { usePalette } from '@/constants/use-palette';
import { useLigacao } from '@/data/tempo-real';
import { t } from '@/i18n';

/** Linha pequena com o estado da ligação em tempo real: ajuda a perceber porque é que um pedido não chega. */
export function EstadoServidor() {
  const c = usePalette();
  const l = useLigacao();
  const cor = l.estado === 'ligado' ? c.go : l.estado === 'erro' ? '#DC2626' : c.textSecondary;
  const texto =
    l.estado === 'ligado'
      ? t('Ligado ao servidor')
      : l.estado === 'a_ligar'
        ? t('A ligar ao servidor…')
        : l.estado === 'erro'
          ? t('Sem ligação ao servidor ({detalhe})', { detalhe: l.detalhe ?? t('erro') })
          : t('Modo de demonstração: sem servidor');
  return (
    <View style={estilos.linha}>
      <View style={[estilos.ponto, { backgroundColor: cor }]} />
      <Text style={{ color: c.textSecondary, fontSize: 12, flexShrink: 1 }}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ponto: { width: 7, height: 7, borderRadius: 4 },
});
