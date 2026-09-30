import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mapa } from '@/components/mapa';
import { BotaoPrincipal, BotaoVoltar, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { CATEGORIAS_MOTORISTA, formatarMzn } from '@/data/categorias';
import { distanciaKm, duracaoMin, estimarPreco } from '@/data/viagem';
import { PAGAMENTOS, usePedido } from '@/state/pedido';

export default function Confirmar() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { origem, destino } = pedido;

  if (!destino) return <Redirect href="/destino" />;

  const km = distanciaKm(origem, destino);
  const minutos = duracaoMin(km);
  const escolhida = CATEGORIAS_MOTORISTA.find((c) => c.id === pedido.categoriaId) ?? CATEGORIAS_MOTORISTA[0];

  return (
    <View style={s.ecra}>
      <Mapa origem={origem} destino={destino} margemInferior={480} />

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <BotaoVoltar onPress={() => router.back()} />
      </SafeAreaView>

      <Painel>
        <Pressable onPress={() => router.push('/destino')} style={s.rota}>
          <Text style={s.rotaTexto} numberOfLines={1}>
            {origem.nome} → {destino.nome}
          </Text>
          <Text style={s.rotaDetalhe}>
            {km.toFixed(1).replace('.', ',')} km · cerca de {minutos} min
          </Text>
        </Pressable>

        <ScrollView style={s.lista} contentContainerStyle={{ gap: Spacing.one }}>
          {CATEGORIAS_MOTORISTA.map((c) => {
            const ativa = c.id === escolhida.id;
            return (
              <Pressable key={c.id} onPress={() => pedido.setCategoriaId(c.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>
                    {c.nome} <Text style={s.secundario}>· {c.lugares} lugares</Text>
                  </Text>
                  <Text style={s.secundario}>
                    Chega em {c.chegadaMin} min · {c.descricao}
                  </Text>
                </View>
                <Text style={s.preco}>{formatarMzn(estimarPreco(c, km))}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.pagamentos}>
          {PAGAMENTOS.map((p) => {
            const ativo = p.id === pedido.pagamento;
            return (
              <Pressable key={p.id} onPress={() => pedido.setPagamento(p.id)} style={[s.chip, ativo && s.chipAtivo]}>
                <Text style={[s.chipTexto, ativo && s.chipTextoAtivo]}>{p.nome}</Text>
              </Pressable>
            );
          })}
        </View>

        <BotaoPrincipal texto={`Pedir ${escolhida.nome}`} onPress={() => router.replace('/viagem')} />
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    rota: { marginBottom: Spacing.two },
    rotaTexto: { color: c.text, fontSize: 17, fontWeight: '700' },
    rotaDetalhe: { color: c.textSecondary, marginTop: 2 },
    lista: { maxHeight: 250, marginBottom: Spacing.two },
    cartao: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent' },
    cartaoAtivo: { borderColor: c.primary, backgroundColor: c.backgroundElement },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14, fontWeight: '400', marginTop: 2 },
    preco: { color: c.text, fontSize: 16, fontWeight: '700' },
    pagamentos: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
    chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    chipAtivo: { backgroundColor: c.primary },
    chipTexto: { color: c.text, fontWeight: '600' },
    chipTextoAtivo: { color: c.onPrimary },
  });
}
