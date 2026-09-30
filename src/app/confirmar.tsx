import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mapa } from '@/components/mapa';
import { BotaoPrincipal, BotaoVoltar, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { calcularPreco, distanciaKm, duracaoMin } from '@/data/viagem';
import { usePedido } from '@/state/pedido';

export default function Confirmar() {
  const cores = usePalette();
  const s = estilos(cores);
  const { origem, destino, viatura } = usePedido();

  if (!destino) return <Redirect href="/destino" />;

  const km = distanciaKm(origem, destino);
  const preco = calcularPreco(viatura, km);

  return (
    <View style={s.ecra}>
      <Mapa origem={origem} destino={destino} margemInferior={420} />

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <BotaoVoltar onPress={() => router.back()} />
      </SafeAreaView>

      <Painel>
        <Pressable onPress={() => router.replace('/destino')} style={s.linha}>
          <View style={[s.ponto, { borderRadius: 5 }]} />
          <Text style={s.local} numberOfLines={1}>{origem.nome}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/destino')} style={s.linha}>
          <View style={s.ponto} />
          <Text style={s.local} numberOfLines={1}>{destino.nome}</Text>
        </Pressable>

        <View style={s.resumo}>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Carro</Text>
            <Text style={s.valor}>{nomeViatura(viatura)}</Text>
          </View>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Distância</Text>
            <Text style={s.valor}>
              {km.toFixed(1).replace('.', ',')} km · cerca de {duracaoMin(km)} min
            </Text>
          </View>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Preço por km</Text>
            <Text style={s.valor}>{formatarMzn(viatura.porKmMzn)}</Text>
          </View>
          <View style={[s.linhaResumo, s.linhaTotal]}>
            <Text style={s.total}>Total</Text>
            <Text style={s.total}>{formatarMzn(preco)}</Text>
          </View>
        </View>

        <BotaoPrincipal texto="Continuar para pagamento" onPress={() => router.push('/pagamento')} />
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
    ponto: { width: 10, height: 10, backgroundColor: c.text },
    local: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
    resumo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two, marginVertical: Spacing.three },
    linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
    linhaTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two, marginTop: Spacing.one },
    secundario: { color: c.textSecondary, fontSize: 15 },
    valor: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    total: { color: c.text, fontSize: 22, fontWeight: '800' },
  });
}
