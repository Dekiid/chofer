import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EscolhaHorario } from '@/components/escolha-horario';
import { Mapa } from '@/components/mapa';
import { BotaoPrincipal, BotaoVoltar, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora, minutosOcupado, reservaQueOcupa, somarMin } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { calcularPreco, taxaImediato } from '@/data/viagem';
import { useAgenda } from '@/state/agenda';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';

export default function Confirmar() {
  const cores = usePalette();
  const s = estilos(cores);
  const { origem, destino, viatura, quando, setQuando, rota, rotaACarregar } = usePedido();
  const { reservas } = useAgenda();

  if (!destino || !rota) return <Redirect href="/destino" />;

  // Km e tempo pelas estradas (Google), ou a estimativa enquanto a rota não chega.
  const { km, minutos: duracao } = rota;
  const agora = new Date();
  const livreAgora = !reservaQueOcupa(reservas, viatura.id, agora, somarMin(agora, minutosOcupado(duracao, viatura.chegadaMin)));
  const imediato = quando?.tipo === 'imediato';
  // Uma hora escolhida pode ter sido ocupada entretanto; nesse caso deixa de valer.
  const quandoValido =
    quando?.tipo === 'imediato'
      ? livreAgora
      : quando?.tipo === 'agendado' && !reservaQueOcupa(reservas, viatura.id, quando.inicio, somarMin(quando.inicio, minutosOcupado(duracao)));
  const preco = calcularPreco(viatura, km, imediato);

  return (
    <View style={s.ecra}>
      <Mapa origem={origem} destino={destino} rota={rota.pontos} margemInferior={600} />

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <BotaoVoltar onPress={() => router.back()} />
      </SafeAreaView>

      <Painel>
        <Pressable onPress={() => router.replace({ pathname: '/destino', params: { campo: 'origem' } })} style={s.linha}>
          <View style={s.pontoRecolha} />
          <Text style={s.local} numberOfLines={1}>{origem.nome}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/destino')} style={s.linha}>
          <View style={s.ponto} />
          <Text style={s.local} numberOfLines={1}>{destino.nome}</Text>
        </Pressable>

        <Text style={s.pergunta}>Quando?</Text>
        <EscolhaHorario
          viaturaId={viatura.id}
          ocupadoMin={minutosOcupado(duracao)}
          reservas={reservas}
          quando={quando}
          onMudar={setQuando}
          livreAgora={livreAgora}
        />

        <View style={s.resumo}>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Carro</Text>
            <Text style={s.valor}>{nomeViatura(viatura)}</Text>
          </View>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Recolha</Text>
            <Text style={s.valor}>
              {quando?.tipo === 'agendado'
                ? `${formatarDia(quando.inicio, agora)}, ${formatarHora(quando.inicio)}`
                : imediato
                  ? `Agora · chega em ${viatura.chegadaMin} min`
                  : 'Escolhe a hora'}
            </Text>
          </View>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Distância</Text>
            <Text style={s.valor}>
              {rotaACarregar ? 'A calcular a rota…' : `${km.toFixed(1).replace('.', ',')} km · cerca de ${duracao} min${rota.fonte === 'estimativa' ? ' (estimativa)' : ''}`}
            </Text>
          </View>
          <View style={s.linhaResumo}>
            <Text style={s.secundario}>Preço por km</Text>
            <Text style={s.valor}>{formatarMzn(viatura.porKmMzn)}</Text>
          </View>
          {imediato && (
            <View style={s.linhaResumo}>
              <Text style={s.secundario}>Taxa de pedido imediato</Text>
              <Text style={s.valor}>{formatarMzn(taxaImediato(viatura, km))}</Text>
            </View>
          )}
          <View style={[s.linhaResumo, s.linhaTotal]}>
            <Text style={s.total}>Total</Text>
            <Text style={s.total}>{formatarMzn(preco)}</Text>
          </View>
        </View>

        <BotaoPrincipal texto="Pedir chauffeur" escuro onPress={() => router.push('/pagamento')} desativado={!quandoValido || rotaACarregar} />
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    ponto: { width: 8, height: 8, backgroundColor: c.text },
    local: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
    pergunta: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: Spacing.two, marginBottom: Spacing.two },
    resumo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one, marginVertical: Spacing.three },
    linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
    linhaTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two, marginTop: Spacing.one },
    secundario: { color: c.textSecondary, fontSize: 15 },
    valor: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    total: { color: c.text, fontSize: 22, fontWeight: '800' },
  });
}
