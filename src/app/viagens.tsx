import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { totalPago, useConta, type ViagemFeita } from '@/state/conta';
import { Text } from '@/components/texto';

const ESTADOS: Record<ViagemFeita['estado'], string> = {
  agendada: 'Agendada',
  em_curso: 'Em curso',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

/** Histórico de viagens: as marcadas primeiro, depois as feitas; cada uma abre o recibo. */
export default function Viagens() {
  const cores = usePalette();
  const s = estilos(cores);
  const { viagens } = useConta();
  const agora = new Date();
  const proximas = viagens.filter((v) => v.estado === 'agendada' || v.estado === 'em_curso');
  const passadas = viagens.filter((v) => v.estado === 'concluida' || v.estado === 'cancelada');

  const cartao = (v: ViagemFeita) => (
    <Pressable key={v.id} onPress={() => router.push({ pathname: '/recibo', params: { id: v.id } })} style={s.cartao}>
      <View style={s.linha}>
        <Text style={s.data}>
          {formatarDia(v.recolhaEm, agora)}, {formatarHora(v.recolhaEm)}
        </Text>
        <Text style={[s.estado, v.estado === 'cancelada' && { color: cores.textSecondary }]}>{ESTADOS[v.estado]}</Text>
      </View>
      <Text style={s.percurso} numberOfLines={1}>
        {v.origem.nome} → {v.destino.nome}
      </Text>
      <View style={s.linha}>
        <Text style={s.secundario}>
          {v.viatura}
          {v.avaliacao ? ` · ${'★'.repeat(v.avaliacao.estrelas)}` : ''}
        </Text>
        <Text style={s.valor}>{v.estado === 'cancelada' ? '—' : formatarMzn(totalPago(v))}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>As tuas viagens</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        {proximas.length > 0 && <Text style={s.secao}>Próximas</Text>}
        {proximas.map(cartao)}
        <Text style={s.secao}>Anteriores</Text>
        {passadas.length === 0 && <Text style={s.secundario}>Ainda não fizeste nenhuma viagem.</Text>}
        {passadas.map(cartao)}
      </ScrollView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two },
    secao: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: Spacing.two },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 4 },
    linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
    data: { color: c.text, fontSize: 15, fontWeight: '700' },
    estado: { color: c.text, fontSize: 12, fontWeight: '700' },
    percurso: { color: c.text, fontSize: 14 },
    secundario: { color: c.textSecondary, fontSize: 13, flexShrink: 1 },
    valor: { color: c.text, fontSize: 15, fontWeight: '800' },
  });
}
