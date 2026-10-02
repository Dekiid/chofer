import { StyleSheet, View } from 'react-native';

import { metodosTexto } from '@/data/paises';
import { Text } from '@/components/texto';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { t } from '@/i18n';

/** Nota que aparece em todas as viagens: só se paga pela app (M-Pesa ou e-Mola), nunca em dinheiro. */
export function NotaPagamento({ paraMotorista = false }: { paraMotorista?: boolean }) {
  const c = usePalette();
  return (
    <View style={[estilos.nota, { backgroundColor: c.backgroundElement }]} accessibilityRole="text">
      <Text style={[estilos.titulo, { color: c.text }]}>{t('Nota')}</Text>
      <Text style={[estilos.texto, { color: c.textSecondary }]}>
        {paraMotorista
          ? t('Os pagamentos são feitos só pela app, por {metodos}. Não aceites dinheiro do cliente.', { metodos: metodosTexto() })
          : t('Os pagamentos são feitos só pela app, por {metodos}. Não se paga em dinheiro ao motorista.', { metodos: metodosTexto() })}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  nota: { borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginBottom: Spacing.two },
  titulo: { fontSize: 13, fontWeight: '800' },
  texto: { fontSize: 13, lineHeight: 18 },
});
