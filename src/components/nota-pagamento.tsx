import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/texto';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';

/** Nota que aparece em todas as viagens: só se paga pela app (M-Pesa ou e-Mola), nunca em dinheiro. */
export function NotaPagamento({ paraMotorista = false }: { paraMotorista?: boolean }) {
  const c = usePalette();
  return (
    <View style={[estilos.nota, { backgroundColor: c.backgroundElement }]} accessibilityRole="text">
      <Text style={[estilos.titulo, { color: c.text }]}>Nota</Text>
      <Text style={[estilos.texto, { color: c.textSecondary }]}>
        {paraMotorista
          ? 'Os pagamentos são feitos só pela app, por M-Pesa ou e-Mola. Não aceites dinheiro do cliente.'
          : 'Os pagamentos são feitos só pela app, por M-Pesa ou e-Mola. Não se paga em dinheiro ao motorista.'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  nota: { borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginBottom: Spacing.two },
  titulo: { fontSize: 13, fontWeight: '800' },
  texto: { fontSize: 13, lineHeight: 18 },
});
