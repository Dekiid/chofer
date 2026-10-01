import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FotoCarro } from '@/components/foto-carro';
import { fotosDaGaleria, GaleriaCarro } from '@/components/galeria-carro';
import { Logo } from '@/components/logo';
import { BotaoPrincipal, CampoPesquisa, Painel } from '@/components/ui';
import { AlternadorModos } from '@/components/alternador-modos';
import { Vidro } from '@/components/vidro';
import { Radius, Spacing, VIDRO, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn, nomeViatura, type Modo, type Viatura } from '@/data/categorias';
import { precoCasamento, type Decoracao } from '@/data/casamento';
import { LOCALIZACAO_PADRAO } from '@/data/lugares';
import { useAgenda } from '@/state/agenda';
import { useConta } from '@/state/conta';
import { useInscricoes } from '@/state/inscricoes';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';
import { t } from '@/i18n';

export default function Inicio() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { naoLidas } = useAgenda();
  const avisos = useInscricoes().inscricoes.filter((i) => i.estado === 'pendente').length + naoLidas;
  const insets = useSafeAreaInsets();
  const { avisosNaoLidos } = useConta();
  const [alturaPainel, setAlturaPainel] = useState(420);
  const ecraJanela = useWindowDimensions();
  // Telemóveis baixos (iPhone SE, Androids pequenos): lista mais curta para sobrar espaço à foto.
  const ecraPequeno = ecraJanela.height < 740;
  // Em ecrãs pequenos a foto encolhe para o nome não subir para cima do logótipo.
  const espacoFoto = ecraJanela.height - insets.top - ALTURA_TOPO - alturaPainel - ALTURA_LEGENDA - ALTURA_NOTA - Spacing.three * 4;
  const alturaFoto = Math.max(90, Math.min((ecraJanela.width - Spacing.three * 2) * (9 / 16), espacoFoto));
  const [modo, setModo] = useState<Modo>('motorista');
  const [decoracao, setDecoracao] = useState<Decoracao>('com');
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  // Para que lado desliza o conteúdo ao mudar de separador: 1 para a direita, -1 para a esquerda.
  const [direcao, setDirecao] = useState(1);
  const lista = pedido.viaturas.filter((v) => disponivel(v, modo));
  // No casamento mostra-se sempre a foto do carro com o visual de casamento, com ou sem decoração escolhida.
  const casamento = pedido.viatura.casamento;
  // A foto de casamento, com cenário, fica um pouco mais pequena que o carro recortado.
  const fotoDecorada = modo === 'casamento' && casamento?.foto ? { foto: casamento.foto, credito: casamento.credito } : undefined;
  // A galeria mostra o carro em si, por isso não abre sobre a foto de casamento.
  const temGaleria = !fotoDecorada && fotosDaGaleria(pedido.viatura).length > 1;

  function mudarModo(m: Modo) {
    if (m === modo) return;
    setDirecao(MODOS.findIndex((x) => x.id === m) > MODOS.findIndex((x) => x.id === modo) ? 1 : -1);
    setModo(m);
    // Nem todos os carros estão para aluguer ou casamentos; se o escolhido não estiver, passa para o primeiro que está.
    if (!disponivel(pedido.viatura, m)) {
      const primeiro = pedido.viaturas.find((v) => disponivel(v, m));
      if (primeiro) pedido.setViaturaId(primeiro.id);
    }
  }

  // Aluguer e casamento seguem o mesmo fluxo, pagos à diária.
  function reservar(m: 'aluguer' | 'casamento') {
    pedido.setReserva({ modo: m, decoracao, inicio: null, dias: 1 });
    router.push('/reserva');
  }

  function preco(v: Viatura): { valor: number; unidade: string; descricao: string } {
    if (modo === 'aluguer') return { valor: v.porDiaMzn ?? 0, unidade: t('/dia'), descricao: t('{tipo} · {n} lugares · sem motorista', { tipo: t(v.tipo), n: v.lugares }) };
    if (modo === 'casamento' && v.casamento)
      return { valor: precoCasamento(v.casamento, decoracao), unidade: t('/dia'), descricao: t('{tipo} · {n} lugares', { tipo: t(v.tipo), n: v.lugares }) };
    return { valor: v.porKmMzn, unidade: '/km', descricao: t('{tipo} · {n} lugares · chega em {min} min', { tipo: t(v.tipo), n: v.lugares, min: v.chegadaMin }) };
  }

  // Usa a localização real como ponto de recolha quando a pessoa autoriza.
  const { setLocalAtual } = pedido;
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocalAtual({ ...LOCALIZACAO_PADRAO, zona: 'Localização atual', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // Sem localização, fica o ponto padrão na Baixa.
      }
    })();
  }, [setLocalAtual]);

  return (
    <View style={s.ecra}>
      {/* Nome e foto ficam centrados no espaço entre o logótipo e o painel, em qualquer tamanho de ecrã. */}
      <View style={[s.ecraCarro, { backgroundColor: cores.backgroundElement, paddingTop: insets.top + ALTURA_TOPO, paddingBottom: alturaPainel }]}>
        <View style={s.legenda} pointerEvents="none">
          <Text style={s.nomeCarro}>{nomeViatura(pedido.viatura)}</Text>
          <Text style={s.descricao}>{t(pedido.viatura.tipo)}</Text>
        </View>
        <Pressable onPress={() => temGaleria && setGaleriaAberta(true)} disabled={!temGaleria} accessibilityLabel={temGaleria ? t('Ver mais fotos do carro') : undefined}>
          <FotoCarro
            viatura={pedido.viatura}
            style={[s.foto, { height: fotoDecorada ? alturaFoto * 0.82 : alturaFoto }]}
            ilustracao={fotoDecorada && { ...fotoDecorada, etiqueta: decoracao === 'com' ? t('Decorado para casamento') : t('Exemplo com decoração') }}
          />
        </Pressable>
        {temGaleria && (
          <Pressable onPress={() => setGaleriaAberta(true)} style={s.verFotos} hitSlop={8}>
            <Text style={s.verFotosTexto}>{t('Ver mais fotos')}</Text>
          </Pressable>
        )}
      </View>

      <GaleriaCarro viatura={pedido.viatura} visivel={galeriaAberta} onFechar={() => setGaleriaAberta(false)} />

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <Logo altura={30} />
        {/* Conta do cliente: viagens, recibos, locais guardados, convites e avisos. */}
        <Pressable onPress={() => router.push('/conta')} style={[s.contaPosicao, { top: insets.top + Spacing.two }]} accessibilityLabel={t('A tua conta')}>
          <Vidro interativo style={s.gestao}>
            <Text style={s.textoGestao}>{t('Conta')}</Text>
            {avisosNaoLidos > 0 && (
              <View style={s.contador}>
                <Text style={s.textoContador}>{avisosNaoLidos}</Text>
              </View>
            )}
          </Vidro>
        </Pressable>
        {/* Só para a equipa; no produto final a aprovação fica no painel de gestão. */}
        <Pressable onPress={() => router.push('/gestao')} style={[s.gestaoPosicao, { top: insets.top + Spacing.two }]}>
          <Vidro interativo style={s.gestao}>
            <Text style={s.textoGestao}>{t('Gestão')}</Text>
            {avisos > 0 && (
              <View style={s.contador}>
                <Text style={s.textoContador}>{avisos}</Text>
              </View>
            )}
          </Vidro>
        </Pressable>
      </SafeAreaView>

      <Painel onLayout={(e) => setAlturaPainel(e.nativeEvent.layout.height)}>
        {/* O conteúdo entra a deslizar do lado da opção escolhida. */}
        <Animated.View key={modo} entering={(direcao > 0 ? SlideInRight : SlideInLeft).duration(260)}>
          <Text style={s.pergunta}>{t(MODOS.find((m) => m.id === modo)?.pergunta ?? '')}</Text>
          {modo === 'casamento' && (
            <View style={s.decoracoes}>
              {(['com', 'sem'] as const).map((d) => (
                <Pressable key={d} onPress={() => setDecoracao(d)} style={[s.decoracao, decoracao === d && s.opcaoModoAtiva]}>
                  <Text style={[s.textoModo, decoracao === d && s.textoModoAtivo]}>{d === 'com' ? t('Com decoração') : t('Sem decoração')}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <ScrollView style={[s.lista, modo === 'casamento' && s.listaCasamento, ecraPequeno && s.listaPequena]} contentContainerStyle={s.listaConteudo} scrollIndicatorInsets={{ right: 1 }}>
            {lista.map((v) => {
              const ativa = v.id === pedido.viatura.id;
              const p = preco(v);
              return (
                <Pressable key={v.id} onPress={() => pedido.setViaturaId(v.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome}>{nomeViatura(v)}</Text>
                    <Text style={s.descricao}>{p.descricao}</Text>
                  </View>
                  <Text style={s.preco}>
                    {formatarMzn(p.valor)}
                    <Text style={s.lugares}>{p.unidade}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {modo === 'motorista' ? (
            <>
              <CampoPesquisa texto={t('Para onde vamos?')} onPress={() => router.push('/destino')} />
              <Pressable onPress={() => router.push('/inscricao')} style={s.inscrever}>
                <Text style={s.descricao}>
                  {t('Tens um carro premium?')} <Text style={s.textoInscrever}>{t('Inscreve-te como motorista')}</Text>
                </Text>
              </Pressable>
            </>
          ) : modo === 'aluguer' ? (
            <BotaoPrincipal texto={t('Alugar {carro}', { carro: nomeViatura(pedido.viatura) })} onPress={() => reservar('aluguer')} />
          ) : (
            <>
              <BotaoPrincipal texto={t('Reservar {carro}', { carro: nomeViatura(pedido.viatura) })} onPress={() => reservar('casamento')} />
              <Text style={[s.descricao, s.notaCasamento]}>
                {decoracao === 'com' ? t('Com motorista e decoração de flores e fitas.') : t('Com motorista, sem decoração.')}
              </Text>
            </>
          )}
        </Animated.View>

        {/* Seletor em baixo, como na Uber; a marca preta desliza para a opção escolhida. */}
        <AlternadorModos opcoes={MODOS.map((m) => ({ ...m, nome: t(m.nome) }))} valor={modo} onMudar={mudarModo} style={s.alternador} />
      </Painel>
    </View>
  );
}

// Espaço do logótipo no topo, abaixo da barra de estado.
const ALTURA_TOPO = 52;
const ALTURA_LEGENDA = 54;
// Espaço da nota "Ver mais fotos" por baixo da foto.
const ALTURA_NOTA = 16;

const MODOS: { id: Modo; nome: string; pergunta: string }[] = [
  { id: 'motorista', nome: 'Com motorista', pergunta: 'Escolhe o teu carro' },
  { id: 'aluguer', nome: 'Aluguer', pergunta: 'Escolhe o carro para alugar' },
  { id: 'casamento', nome: 'Casamento', pergunta: 'Carro para o teu casamento' },
];

function disponivel(v: Viatura, modo: Modo): boolean {
  if (modo === 'aluguer') return v.porDiaMzn !== undefined;
  if (modo === 'casamento') return v.casamento?.foto !== undefined;
  return !v.soCasamento;
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    ecraCarro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', gap: Spacing.three },
    // Todas as fotos estão em 16:9, com o carro a ocupar a mesma largura.
    foto: { alignSelf: 'center', maxWidth: '100%', marginHorizontal: Spacing.three, aspectRatio: 16 / 9 },
    legenda: { alignItems: 'center' },
    verFotos: { alignSelf: 'center', marginTop: -Spacing.two },
    verFotosTexto: { color: c.textSecondary, fontSize: 11, textDecorationLine: 'underline' },
    nomeCarro: { color: c.text, fontSize: 24, fontWeight: '800' },
    // Logótipo ao centro; a pastilha da gestão fica à direita, sem o empurrar.
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Spacing.two + 4, alignItems: 'center' },
    contador: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    textoContador: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    gestaoPosicao: { position: 'absolute', right: Spacing.three },
    contaPosicao: { position: 'absolute', left: Spacing.three },
    gestao: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, overflow: 'hidden', ...(VIDRO ? {} : { backgroundColor: c.backgroundElement, borderWidth: 0 }) },
    textoGestao: { color: c.text, fontSize: 14, fontWeight: '600' },
    inscrever: { alignItems: 'center', paddingTop: Spacing.three },
    textoInscrever: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
    alternador: { marginTop: Spacing.three },
    opcaoModoAtiva: { backgroundColor: c.primary },
    textoModo: { color: c.textSecondary, fontWeight: '600' },
    textoModoAtivo: { color: c.onPrimary },
    decoracoes: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
    decoracao: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    notaCasamento: { textAlign: 'center', paddingTop: Spacing.two, fontSize: 13 },
    pergunta: { color: c.text, fontSize: 20, fontWeight: '700', marginBottom: Spacing.two },
    // A lista avança sobre a margem do painel e ganha a mesma folga à direita:
    // os cartões ficam alinhados e o indicador de scroll corre na margem, sem tapar o texto.
    lista: { marginBottom: Spacing.three, maxHeight: 250, marginRight: -Spacing.three + Spacing.one },
    listaConteudo: { gap: Spacing.one, paddingRight: Spacing.three - Spacing.one },
    // A escolha da decoração e a nota ocupam espaço; a lista encolhe para o painel não tapar a foto.
    listaCasamento: { maxHeight: 180 },
    listaPequena: { maxHeight: 140 },
    cartao: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent' },
    cartaoAtivo: { borderColor: c.primary, backgroundColor: c.backgroundElement },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    lugares: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    descricao: { color: c.textSecondary, marginTop: 2 },
    preco: { color: c.text, fontSize: 16, fontWeight: '700' },
  });
}
