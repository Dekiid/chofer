import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/texto';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import type { Lugar } from '@/data/lugares';

/**
 * Recolha, paragens e destino da viagem, como na Uber: o ponto para onde o carro vai agora fica em destaque,
 * e a recolha fica riscada depois de o cliente entrar.
 */
export function PercursoViagem({
  origem,
  paragens = [],
  destino,
  etapa,
  detalheRecolha,
  detalheDestino,
}: {
  origem: Lugar;
  paragens?: Lugar[];
  destino: Lugar;
  /** Para onde o carro vai agora. */
  etapa: 'recolha' | 'destino';
  detalheRecolha?: string;
  detalheDestino?: string;
}) {
  const c = usePalette();
  const recolhido = etapa === 'destino';
  const linha = (ponto: 'recolha' | 'paragem' | 'destino', nome: string, rotulo: string, detalhe: string | undefined, atual: boolean, feito = false) => (
    <View style={estilos.linha}>
      <View style={estilos.marca}>
        <View
          style={[
            ponto === 'recolha' ? estilos.pontoRecolha : ponto === 'destino' ? estilos.pontoDestino : estilos.pontoParagem,
            { backgroundColor: ponto === 'recolha' ? c.go : ponto === 'destino' ? c.text : 'transparent', borderColor: c.text },
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[estilos.rotulo, { color: c.textSecondary }]}>{rotulo}</Text>
        <Text
          style={[estilos.nome, { color: feito ? c.textSecondary : c.text }, atual && estilos.atual, feito && estilos.feito]}
          numberOfLines={1}>
          {nome}
        </Text>
      </View>
      {detalhe ? <Text style={[estilos.detalhe, { color: atual ? c.text : c.textSecondary }]}>{detalhe}</Text> : null}
    </View>
  );
  return (
    <View style={[estilos.caixa, { backgroundColor: c.backgroundElement }]} accessibilityLabel={`De ${origem.nome} para ${destino.nome}`}>
      {linha('recolha', origem.nome, recolhido ? 'Recolha feita' : 'Recolha', detalheRecolha, !recolhido, recolhido)}
      <View style={[estilos.traco, { backgroundColor: c.backgroundSelected }]} />
      {paragens.map((p, i) => (
        <View key={`${p.id}-${i}`}>
          {linha('paragem', p.nome, `Paragem ${i + 1}`, undefined, false)}
          <View style={[estilos.traco, { backgroundColor: c.backgroundSelected }]} />
        </View>
      ))}
      {linha('destino', destino.nome, 'Destino', detalheDestino, recolhido)}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginBottom: Spacing.two },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
  marca: { width: 12, alignItems: 'center' },
  pontoRecolha: { width: 10, height: 10, borderRadius: 5, borderWidth: 0 },
  pontoDestino: { width: 10, height: 10, borderWidth: 0 },
  pontoParagem: { width: 10, height: 10, borderWidth: 2 },
  traco: { width: 2, height: 10, marginLeft: 5 },
  rotulo: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nome: { fontSize: 15, fontWeight: '600' },
  atual: { fontWeight: '800' },
  feito: { textDecorationLine: 'line-through' },
  detalhe: { fontSize: 13, fontWeight: '700' },
});
