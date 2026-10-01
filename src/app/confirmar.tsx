import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EscolhaHorario } from '@/components/escolha-horario';
import { Mapa } from '@/components/mapa';
import { NotaPagamento } from '@/components/nota-pagamento';
import type { Ponto } from '@/components/mapa-tipos';
import { BotaoPrincipal, BotaoVoltar, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { conflito, formatarDia, formatarHora, minutosOcupado, somarMin } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { eAeroporto, textoPreferencias } from '@/data/extras-viagem';
import { nomeLugar } from '@/data/lugares';
import { lugarNoPonto } from '@/data/moradas';
import { calcularPreco, taxaImediato } from '@/data/viagem';
import { usePedirAgora } from '@/hooks/use-pedir-agora';
import { useTempoConducao } from '@/hooks/use-tempo-conducao';
import { useAgenda } from '@/state/agenda';
import { useConta } from '@/state/conta';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';
import { t } from '@/i18n';

export default function Confirmar() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const conta = useConta();
  const { origem, destino, paragens, viatura, quando, setQuando, rota, rotaACarregar } = pedido;
  const { reservas, estado: estadoAgenda } = useAgenda();
  // Tempo de condução entre as outras reservas do carro e esta viagem: do fim de cada uma até esta recolha,
  // e do destino desta até à recolha seguinte. É a folga que o carro precisa entre reservas.
  const agoraMs = Date.now();
  const pares: [Ponto, Ponto][] = destino
    ? reservas
        .filter((r) => r.viaturaId === viatura.id && r.fim.getTime() > agoraMs)
        .flatMap((r) => [
          ...(r.pontoFim ? [[r.pontoFim, origem] as [Ponto, Ponto]] : []),
          ...(r.pontoInicio ? [[destino, r.pontoInicio] as [Ponto, Ponto]] : []),
        ])
    : [];
  const conducao = useTempoConducao(pares);
  const pedirAgora = usePedirAgora();
  const [aPedir, setAPedir] = useState(false);
  const [erroPedido, setErroPedido] = useState('');
  // Ao tocar no mapa o painel encolhe, para se ver bem o caminho e acertar os pontos.
  const [aberto, setAberto] = useState(true);
  const encolher = () => aberto && setAberto(false);
  // Na web o rato não gera toques, só ponteiros.
  // Puxar o painel encolhido para cima também o abre, além de tocar em "Ver detalhes".
  const puxarParaCima = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30 || g.vy < -0.5) setAberto(true);
      },
    }),
  ).current;
  // E puxar o painel aberto para baixo encolhe-o. Só conta o gesto vertical, para não roubar o deslizar dos dias.
  const puxarParaBaixo = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 30 || g.vy > 0.5) setAberto(false);
      },
    }),
  ).current;
  const aoTocarNoMapa = Platform.OS === 'web' ? { onPointerDown: encolher } : { onTouchStart: encolher };

  if (!destino || !rota) return <Redirect href="/destino" />;

  // Km e tempo pelas estradas (Google), ou a estimativa enquanto a rota não chega.
  const { km, minutos: duracao } = rota;
  const agora = new Date();
  const livreAgora = !conflito(reservas, viatura.id, { inicio: agora, fim: somarMin(agora, minutosOcupado(duracao, viatura.chegadaMin)), pontoFim: destino }, conducao);
  const locais = { pontoInicio: origem, pontoFim: destino };
  const imediato = quando?.tipo === 'imediato';
  // Uma hora escolhida pode ter sido ocupada entretanto; nesse caso deixa de valer.
  const quandoValido =
    quando?.tipo === 'imediato'
      ? livreAgora
      : quando?.tipo === 'agendado' && !conflito(reservas, viatura.id, { inicio: quando.inicio, fim: somarMin(quando.inicio, duracao), ...locais }, conducao);
  const preco = calcularPreco(viatura, km, imediato);

  return (
    <View style={s.ecra}>
      <View style={StyleSheet.absoluteFill} {...aoTocarNoMapa}>
        <Mapa
          origem={origem}
          destino={destino}
          paragens={paragens}
          rota={rota.pontos}
          margemInferior={600}
          onMoverOrigem={async (p) => pedido.setOrigem(await lugarNoPonto(p))}
          onMoverDestino={async (p) => pedido.setDestino(await lugarNoPonto(p))}
          onMoverParagem={async (i, p) => pedido.setParagem(i, await lugarNoPonto(p))}
        />
      </View>

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <BotaoVoltar onPress={() => router.back()} />
      </SafeAreaView>

      {!aberto && (
        <Painel>
          <View {...puxarParaCima.panHandlers}>
            <Pressable onPress={() => setAberto(true)} accessibilityLabel={t('Mostrar os detalhes da viagem')}>
              <View style={s.mini}>
                <View style={{ flex: 1 }}>
                  <View style={s.linhaMini}>
                    <View style={s.pontoRecolha} />
                    <Text style={s.localMini} numberOfLines={1}>{nomeLugar(origem)}</Text>
                  </View>
                  <View style={s.linhaMini}>
                    <View style={s.ponto} />
                    <Text style={s.localMini} numberOfLines={1}>{destino.nome}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.totalMini}>{formatarMzn(preco)}</Text>
                  <Text style={s.detalhes}>{t('Ver detalhes')}</Text>
                </View>
              </View>
            </Pressable>
            {Platform.OS !== 'web' && <Text style={s.dica}>{t('Para acertar a recolha ou o destino, mantém o dedo no ponto e arrasta-o no mapa.')}</Text>}
          </View>
        </Painel>
      )}

      {aberto && (
        <Painel>
          <View {...puxarParaBaixo.panHandlers}>
            <Pressable onPress={() => router.replace({ pathname: '/destino', params: { campo: 'origem' } })} style={s.linha}>
              <View style={s.pontoRecolha} />
              <Text style={s.local} numberOfLines={1}>{nomeLugar(origem)}</Text>
            </Pressable>
            {paragens.map((p, i) => (
              <Pressable key={`${p.id}-${i}`} onPress={() => router.replace('/destino')} style={s.linha}>
                <View style={s.pontoParagem} />
                <Text style={s.local} numberOfLines={1}>{p.nome}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.replace('/destino')} style={s.linha}>
              <View style={s.ponto} />
              <Text style={s.local} numberOfLines={1}>{destino.nome}</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/opcoes')} style={s.opcoes} accessibilityLabel={t('Opções da viagem')}>
              <View style={{ flex: 1 }}>
                <Text style={s.opcoesTitulo}>
                  {pedido.passageiro ? t('Para {nome}', { nome: pedido.passageiro.nome }) : t('Para mim')}
                  {pedido.voo ? ` · ${t('Voo {voo}', { voo: pedido.voo })}` : ''}
                </Text>
                <Text style={s.opcoesTexto} numberOfLines={1}>
                  {textoPreferencias(conta.preferencias).join(' · ') ||
                    (eAeroporto(origem) && !pedido.voo ? t('Junta o número do voo e as tuas preferências') : t('Preferências: silêncio, temperatura, música, malas'))}
                </Text>
              </View>
              <Text style={s.opcoesMudar}>{t('Mudar')}</Text>
            </Pressable>

            <Text style={s.pergunta}>{t('Quando?')}</Text>
            <EscolhaHorario
              viaturaId={viatura.id}
              duracaoMin={duracao}
              locais={locais}
              conducao={conducao}
              reservas={reservas}
              quando={quando}
              onMudar={setQuando}
              livreAgora={livreAgora}
            />

            <View style={s.resumo}>
              <View style={s.linhaResumo}>
                <Text style={s.secundario}>{t('Carro')}</Text>
                <Text style={s.valor}>{nomeViatura(viatura)}</Text>
              </View>
              <View style={s.linhaResumo}>
                <Text style={s.secundario}>{t('Recolha')}</Text>
                <Text style={s.valor}>
                  {quando?.tipo === 'agendado'
                    ? `${formatarDia(quando.inicio, agora)}, ${formatarHora(quando.inicio)}`
                    : imediato
                      ? t('Agora · chega em {n} min', { n: viatura.chegadaMin })
                      : t('Escolhe a hora')}
                </Text>
              </View>
              <View style={s.linhaResumo}>
                <Text style={s.secundario}>{paragens.length ? (paragens.length === 1 ? t('Distância ({n} paragem)', { n: 1 }) : t('Distância ({n} paragens)', { n: paragens.length })) : t('Distância')}</Text>
                <Text style={s.valor}>
                  {rotaACarregar
                    ? t('A calcular a rota…')
                    : rota.fonte === 'estimativa'
                      ? t('{km} km · cerca de {min} min (estimativa)', { km: km.toFixed(1).replace('.', ','), min: duracao })
                      : t('{km} km · cerca de {min} min', { km: km.toFixed(1).replace('.', ','), min: duracao })}
                </Text>
              </View>
              <View style={s.linhaResumo}>
                <Text style={s.secundario}>{t('Preço por km')}</Text>
                <Text style={s.valor}>{formatarMzn(viatura.porKmMzn)}</Text>
              </View>
              {imediato && (
                <View style={s.linhaResumo}>
                  <Text style={s.secundario}>{t('Taxa de pedido imediato')}</Text>
                  <Text style={s.valor}>{formatarMzn(taxaImediato(viatura, km))}</Text>
                </View>
              )}
              <View style={[s.linhaResumo, s.linhaTotal]}>
                <Text style={s.total}>{t('Total')}</Text>
                <Text style={s.total}>{formatarMzn(preco)}</Text>
              </View>
            </View>

            {/* Reservas pagam-se já, para guardar o horário; pedidos para agora pagam-se no fim, como na Uber,
                porque o motorista ainda pode recusar. */}
            {quando && <Text style={s.quandoPaga}>{imediato ? t('Pagas no fim da viagem, por M-Pesa ou e-Mola.') : t('Pagas agora, para reservar o horário.')}</Text>}
            <NotaPagamento />
            {erroPedido ? <Text style={s.avisoAgenda}>{erroPedido}</Text> : null}
            <BotaoPrincipal
              texto={aPedir ? t('A pedir…') : t('Pedir chauffeur')}
              escuro
              onPress={async () => {
                if (!imediato) return router.push('/pagamento');
                setAPedir(true);
                setErroPedido((await pedirAgora()) ?? '');
                setAPedir(false);
              }}
              desativado={!quandoValido || rotaACarregar || aPedir}
            />
          </View>
        </Painel>
      )}
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    opcoes: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, marginTop: Spacing.two },
    opcoesTitulo: { color: c.text, fontSize: 15, fontWeight: '700' },
    opcoesTexto: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
    opcoesMudar: { color: c.text, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
    quandoPaga: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: Spacing.two },
    avisoAgenda: { color: '#D93025', fontSize: 12, marginTop: Spacing.one },
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    ponto: { width: 8, height: 8, backgroundColor: c.text },
    pontoParagem: { width: 8, height: 8, borderWidth: 2, borderColor: c.text },
    local: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
    pergunta: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: Spacing.two, marginBottom: Spacing.two },
    resumo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one, marginVertical: Spacing.three },
    linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
    linhaTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two, marginTop: Spacing.one },
    secundario: { color: c.textSecondary, fontSize: 15 },
    valor: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    total: { color: c.text, fontSize: 22, fontWeight: '800' },
    mini: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.two },
    linhaMini: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 3 },
    localMini: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
    totalMini: { color: c.text, fontSize: 18, fontWeight: '800' },
    detalhes: { color: c.text, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline', marginTop: 2 },
    dica: { color: c.textSecondary, fontSize: 13, paddingBottom: Spacing.one },
  });
}
