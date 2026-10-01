import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EstadoServidor } from '@/components/estado-servidor';
import { Mapa } from '@/components/mapa';
import { PercursoViagem } from '@/components/percurso-viagem';
import { NotaPagamento } from '@/components/nota-pagamento';
import type { Ponto } from '@/components/mapa-tipos';
import { BotaoPrincipal, BotaoSecundario, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarHora, somarMin } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { calcularRota, pontoNaRota, restoDaRota, restoDesde, type Rota } from '@/data/rotas';
import { EMERGENCIA, gerarCodigoRecolha, ligacaoMapa } from '@/data/seguranca';
import { ouvir, publicar, TEMPO_REAL_ATIVO } from '@/data/tempo-real';
import { calcularPreco, distanciaKm, duracaoMin } from '@/data/viagem';
import type { Motorista } from '@/data/motorista';
import { useAgenda } from '@/state/agenda';
import { ELOGIOS, useConta } from '@/state/conta';
import { useSessao } from '@/state/sessao';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';

type Fase = 'procurar' | 'sem_resposta' | 'a_caminho' | 'chegou' | 'em_viagem' | 'concluida';

// Com o servidor ligado, se o motorista não aceitar neste tempo (um pouco mais do que o minuto que ele tem), o cliente pode tentar outra vez ou cancelar.
const TEMPO_ESPERA_MOTORISTA = 75000;

// Durações da simulação, em milissegundos.
const TEMPO_PROCURA = 3000;
const TEMPO_DESLOCACAO = 10000;
const PASSO = 250;

/** Valores rápidos de gorjeta, em meticais. A gorjeta vai toda para o motorista. */
const GORJETAS = [0, 50, 100, 200];

export default function Viagem() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const conta = useConta();
  const sessao = useSessao();
  const agenda = useAgenda();
  const { origem, destino } = pedido;
  const viagemConta = conta.viagemAtual;
  const porPagar = viagemConta?.porPagar === true;

  const [fase, setFase] = useState<Fase>('procurar');
  const [carro, setCarro] = useState<Ponto | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [estrelas, setEstrelas] = useState(0);
  const [elogios, setElogios] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  const [gorjeta, setGorjeta] = useState(0);
  const [sos, setSos] = useState(false);
  // Sem viagem registada (por exemplo, ao abrir este ecrã diretamente), gera-se um código na mesma.
  const [codigoLocal] = useState(gerarCodigoRecolha);
  const codigo = viagemConta?.codigoRecolha ?? codigoLocal;
  // Caminho do motorista até à recolha, pelas estradas quando há rota do Google.
  const [rotaMotorista, setRotaMotorista] = useState<Rota | null>(null);
  // Com o servidor ligado: o motorista real que aceitou, e porque é que o pedido ficou sem resposta.
  const [motoristaReal, setMotoristaReal] = useState<Motorista | null>(null);
  const [motivoSemResposta, setMotivoSemResposta] = useState('');
  const [idLocal] = useState(() => `v-${Date.now()}`);
  const idPedido = viagemConta?.id ?? idLocal;

  // Tempo real: eventos do motorista desta viagem.
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO) return;
    return ouvir((e) => {
      if (!('id' in e) || e.id !== idPedido) return;
      if (e.tipo === 'aceite') {
        setMotoristaReal(e.motorista);
        setCarro(e.posicao);
        calcularRota(e.posicao, origem).then(setRotaMotorista);
        if (!e.agendada) setFase('a_caminho');
      }
      if (e.tipo === 'recusado') {
        setMotivoSemResposta('O motorista não pode fazer esta viagem agora.');
        setFase((f) => (f === 'procurar' ? 'sem_resposta' : f));
      }
      if (e.tipo === 'posicao') setCarro(e.posicao);
      if (e.tipo === 'estado') {
        if (e.motorista) setMotoristaReal(e.motorista);
        if (e.estado === 'em_viagem') setProgresso(0);
        setFase(e.estado);
      }
      if (e.tipo === 'cancelado' && e.por === 'motorista') {
        setMotivoSemResposta('O motorista cancelou a viagem.');
        setFase('sem_resposta');
      }
    });
  }, [idPedido, origem]);

  // Tempo real: enviar o pedido ao motorista do carro escolhido, e esperar que aceite.
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO || fase !== 'procurar' || !destino) return;
    const v = pedido.viatura;
    publicar({
      tipo: 'pedido',
      pedido: {
        id: idPedido,
        viaturaId: v.id,
        viaturaNome: nomeViatura(v),
        origem,
        paragens: pedido.paragens,
        destino,
        km: pedido.rota?.km ?? 0,
        minutos: pedido.rota?.minutos ?? 0,
        precoMzn: viagemConta ? viagemConta.precoMzn - viagemConta.descontoMzn : calcularPreco(v, pedido.rota?.km ?? 0, true),
        codigoRecolha: codigo,
        pagamento: PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome ?? '',
        criadoEm: new Date().toISOString(),
        clienteNome: sessao.perfil?.nome,
        pagaNoFim: viagemConta?.porPagar,
      },
    });
    const t = setTimeout(() => {
      setMotivoSemResposta('O motorista não respondeu a tempo.');
      setFase((f) => (f === 'procurar' ? 'sem_resposta' : f));
    }, TEMPO_ESPERA_MOTORISTA);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o pedido sai uma vez de cada vez que se procura motorista.
  }, [fase]);

  // Procurar motorista e, quando encontrado, colocá-lo a cerca de 2 km da recolha.
  useEffect(() => {
    if (TEMPO_REAL_ATIVO || fase !== 'procurar') return;
    let valido = true;
    const inicio = { latitude: origem.latitude + 0.012, longitude: origem.longitude - 0.012 };
    const espera = new Promise((fim) => setTimeout(fim, TEMPO_PROCURA));
    Promise.all([calcularRota(inicio, origem), espera]).then(([rota]) => {
      if (!valido) return;
      setRotaMotorista(rota);
      setCarro(inicio);
      setProgresso(0);
      setFase('a_caminho');
    });
    return () => {
      valido = false;
    };
  }, [fase, origem]);

  // Mover o carro pela rota até à recolha (a_caminho) ou até ao destino (em_viagem).
  const pontosViagem = pedido.rota?.pontos;
  useEffect(() => {
    if (TEMPO_REAL_ATIVO || (fase !== 'a_caminho' && fase !== 'em_viagem')) return;
    const pontos = fase === 'a_caminho' ? rotaMotorista?.pontos : pontosViagem;
    if (!pontos) return;
    let t = 0;
    const id = setInterval(() => {
      t = Math.min(1, t + PASSO / TEMPO_DESLOCACAO);
      setCarro(pontoNaRota(pontos, t));
      setProgresso(t);
      if (t >= 1) {
        clearInterval(id);
        setFase(fase === 'a_caminho' ? 'chegou' : 'concluida');
      }
    }, PASSO);
    return () => clearInterval(id);
  }, [fase, rotaMotorista, pontosViagem]);

  const viatura = pedido.viatura;
  const motorista = motoristaReal ?? viatura.motorista ?? MOTORISTA_EXEMPLO;
  const primeiroNome = motorista.nome.split(' ')[0];

  // Avisos de cada mudança de fase: dentro da app e no telemóvel.
  const { avisar, atualizarViagem } = conta;
  const faseAvisada = useRef<Fase>('procurar');
  useEffect(() => {
    if (fase === faseAvisada.current || !destino) return;
    faseAvisada.current = fase;
    if (fase === 'a_caminho') avisar(`${primeiroNome} vai a caminho`, `${nomeViatura(viatura)} · ${motorista.matricula}. Código de recolha: ${codigo}.`);
    if (fase === 'chegou') avisar('O teu chauffeur chegou', `${primeiroNome} está à porta num ${nomeViatura(viatura)}. Diz-lhe o código ${codigo}.`);
    if (fase === 'em_viagem' && viagemConta) atualizarViagem(viagemConta.id, { estado: 'em_curso' });
    if (fase === 'concluida') avisar('Chegaste ao destino', `Obrigado por viajares com a Chauffeur. Avalia ${primeiroNome} e vê o recibo.`);
  }, [fase, destino, avisar, atualizarViagem, viagemConta, primeiroNome, viatura, motorista.matricula, codigo]);

  if (!destino) return <Redirect href="/" />;

  const preco = viagemConta ? viagemConta.precoMzn - viagemConta.descontoMzn : calcularPreco(viatura, pedido.rota?.km ?? 0, pedido.quando?.tipo === 'imediato');
  const pagamento = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome;
  // Com o motorista real, o tempo que falta sai da distância até ao ponto seguinte.
  const minutosRestantes = TEMPO_REAL_ATIVO && carro ? duracaoMin(distanciaKm(carro, origem) * 1.3) : Math.max(1, Math.round(viatura.chegadaMin * (1 - progresso)));
  const minutosViagem = TEMPO_REAL_ATIVO && carro ? duracaoMin(distanciaKm(carro, destino) * 1.3) : Math.max(1, Math.round((pedido.rota?.minutos ?? 0) * (1 - progresso)));

  function sair() {
    pedido.limpar();
    router.dismissTo('/');
  }

  function cancelar() {
    if (TEMPO_REAL_ATIVO) publicar({ tipo: 'cancelado', id: idPedido, por: 'cliente' });
    if (viagemConta) {
      atualizarViagem(viagemConta.id, { estado: 'cancelada' });
      // O carro volta a ficar livre na agenda.
      agenda.libertar(viagemConta.id);
    }
    sair();
  }

  function concluir() {
    const avaliacao = estrelas > 0 ? { estrelas, elogios, comentario: comentario.trim() } : undefined;
    if (viagemConta) atualizarViagem(viagemConta.id, { estado: 'concluida', gorjetaMzn: gorjeta, avaliacao });
    // Pedido para agora: paga-se agora, no fim, com a gorjeta incluída.
    if (porPagar && viagemConta) return router.replace({ pathname: '/pagamento', params: { viagem: viagemConta.id } });
    if (gorjeta > 0) avisar('Gorjeta enviada', `${formatarMzn(gorjeta)} por ${pagamento} para ${primeiroNome}. Obrigado!`);
    sair();
  }

  // Estados curtos, como no manual: «Chega em 4 min».
  const titulo: Record<Fase, string> = {
    procurar: TEMPO_REAL_ATIVO ? `À espera de ${primeiroNome}` : 'A procurar motorista',
    sem_resposta: 'Sem motorista',
    a_caminho: `Chega em ${minutosRestantes} min`,
    chegou: 'O teu chauffeur chegou',
    em_viagem: `A caminho de ${destino.nome}`,
    concluida: 'Chegaste ao destino',
  };
  const ligar = () => Linking.openURL(`tel:${motorista.telefone}`);

  // Mensagem para um familiar ou amigo acompanhar: carro, matrícula, motorista, destino, chegada e onde está agora.
  async function partilhar() {
    const chegada = formatarHora(somarMin(new Date(), fase === 'em_viagem' ? minutosViagem : minutosRestantes + (pedido.rota?.minutos ?? 0)));
    const onde = carro ?? origem;
    const texto =
      `Estou numa viagem Chauffeur para ${destino!.nome}.\n` +
      `Carro: ${nomeViatura(viatura)}, matrícula ${motorista.matricula}. Motorista: ${motorista.nome}.\n` +
      `Chegada prevista às ${chegada}.\n` +
      `Onde estou agora: ${ligacaoMapa(onde)}`;
    try {
      await Share.share({ message: texto });
    } catch {
      // Sem partilha disponível (alguns browsers); não há nada a fazer.
    }
  }

  async function partilharLocalizacao() {
    try {
      await Share.share({ message: `Preciso de ajuda. Estou num ${nomeViatura(viatura)} (${motorista.matricula}). A minha localização: ${ligacaoMapa(carro ?? origem)}` });
    } catch {}
  }

  const comMotorista = fase === 'a_caminho' || fase === 'chegou' || fase === 'em_viagem';

  return (
    <View style={s.ecra}>
      <Mapa
        origem={fase === 'em_viagem' || fase === 'concluida' ? undefined : origem}
        // Como no manual: com o motorista a caminho, só o carro e a recolha.
        destino={fase === 'a_caminho' || fase === 'chegou' ? undefined : destino}
        paragens={fase === 'em_viagem' ? pedido.paragens : undefined}
        carro={carro}
        // Com o motorista a caminho, a rota é do carro até à recolha.
        rota={
          fase === 'a_caminho' && rotaMotorista
            ? TEMPO_REAL_ATIVO && carro
              ? restoDesde(rotaMotorista.pontos, carro)
              : restoDaRota(rotaMotorista.pontos, progresso)
            : fase === 'em_viagem' && pontosViagem
              ? TEMPO_REAL_ATIVO && carro
                ? restoDesde(pontosViagem, carro)
                : restoDaRota(pontosViagem, progresso)
              : fase === 'chegou' || fase === 'concluida'
                ? []
                : pontosViagem
        }
        seguirCarro={fase === 'a_caminho' || fase === 'em_viagem'}
        margemInferior={420}
      />

      {fase !== 'concluida' && (
        <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
          <Pressable onPress={() => setSos(true)} style={s.sos} accessibilityLabel="Emergência" hitSlop={8}>
            <Text style={s.sosTexto}>SOS</Text>
          </Pressable>
        </SafeAreaView>
      )}

      <Painel>
        <View style={s.estado}>
          {fase !== 'procurar' && fase !== 'sem_resposta' && <View style={s.pontoEstado} />}
          <Text style={s.titulo}>{titulo[fase]}</Text>
        </View>

        {TEMPO_REAL_ATIVO && (fase === 'procurar' || fase === 'sem_resposta') && (
          <View style={{ marginTop: -Spacing.two, marginBottom: Spacing.two }}>
            <EstadoServidor />
          </View>
        )}
        {fase === 'sem_resposta' ? (
          <Text style={[s.secundario, { marginBottom: Spacing.three }]}>{motivoSemResposta} Podes tentar outra vez ou cancelar o pedido.</Text>
        ) : fase === 'procurar' ? (
          <View style={s.procura}>
            <ActivityIndicator color={cores.text} />
            <Text style={s.secundario}>
              {nomeViatura(viatura)} · {formatarMzn(preco)} {porPagar ? `a pagar no fim por ${pagamento}` : `pago por ${pagamento}`}
            </Text>
          </View>
        ) : (
          <View style={s.motorista}>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{motorista.nome[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>
                {motorista.nome}{' '}
                {motorista.avaliacao !== undefined && <Text style={s.secundario}>★ {motorista.avaliacao.toString().replace('.', ',')}</Text>}
              </Text>
              <Text style={s.secundario}>{nomeViatura(viatura)}</Text>
            </View>
            <Text style={s.matricula}>{motorista.matricula}</Text>
          </View>
        )}

        {/* Recolha e destino à vista durante toda a viagem, como na Uber. */}
        {comMotorista && (
          <PercursoViagem
            origem={origem}
            paragens={pedido.paragens}
            destino={destino}
            etapa={fase === 'em_viagem' ? 'destino' : 'recolha'}
            detalheRecolha={fase === 'a_caminho' ? `${minutosRestantes} min` : fase === 'chegou' ? 'Chegou' : undefined}
            detalheDestino={fase === 'em_viagem' ? `${minutosViagem} min` : undefined}
          />
        )}

        {(fase === 'a_caminho' || fase === 'chegou') && (
          <View style={s.codigo}>
            <View style={{ flex: 1 }}>
              <Text style={s.codigoTitulo}>Código de recolha</Text>
              <Text style={s.secundarioPequeno}>Diz este código ao motorista antes de entrares. Se ele não o souber, não entres.</Text>
            </View>
            <Text style={s.codigoNumero} accessibilityLabel={`Código ${codigo.split('').join(' ')}`}>
              {codigo}
            </Text>
          </View>
        )}

        {(fase === 'a_caminho' || fase === 'chegou' || fase === 'em_viagem') && <NotaPagamento />}

        {comMotorista && (
          <View style={s.acoes}>
            {/* Já dentro do carro não faz sentido ligar ao motorista. */}
            {fase !== 'em_viagem' && <Acao texto="Ligar" onPress={ligar} s={s} />}
            <Acao texto="Mensagem" onPress={() => router.push('/chat')} s={s} contador={conta.naoLidasChat} />
            <Acao texto="Partilhar" onPress={partilhar} s={s} />
          </View>
        )}

        {fase === 'concluida' ? (
          <>
            <Text style={s.total}>
              {formatarMzn(preco + gorjeta)} <Text style={s.secundario}>· {porPagar ? `a pagar por ${pagamento}` : `pago por ${pagamento}`}</Text>
            </Text>
            <Text style={[s.secundario, { marginBottom: Spacing.two }]}>Como foi a viagem com {primeiroNome}?</Text>
            <View style={s.estrelas}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setEstrelas(n)} accessibilityLabel={`${n} estrelas`}>
                  <Text style={[s.estrela, { color: n <= estrelas ? cores.accent : cores.backgroundSelected }]}>★</Text>
                </Pressable>
              ))}
            </View>
            {estrelas > 0 && (
              <>
                <View style={s.chips}>
                  {(estrelas >= 4 ? ELOGIOS : ['Condução perigosa', 'Atrasou', 'Carro sujo', 'Pouco simpático', 'Caminho mais longo']).map((e) => {
                    const ativo = elogios.includes(e);
                    return (
                      <Pressable key={e} onPress={() => setElogios((a) => (ativo ? a.filter((x) => x !== e) : [...a, e]))} style={[s.chip, ativo && s.chipAtivo]}>
                        <Text style={[s.chipTexto, ativo && s.chipTextoAtivo]}>{e}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput value={comentario} onChangeText={setComentario} placeholder="Comentário (opcional)" placeholderTextColor={cores.textSecondary} style={s.comentario} maxLength={200} />
                <Text style={[s.secundario, { marginBottom: Spacing.two }]}>Gorjeta para {primeiroNome}</Text>
                <View style={s.chips}>
                  {GORJETAS.map((g) => (
                    <Pressable key={g} onPress={() => setGorjeta(g)} style={[s.chip, gorjeta === g && s.chipAtivo]}>
                      <Text style={[s.chipTexto, gorjeta === g && s.chipTextoAtivo]}>{g === 0 ? 'Sem gorjeta' : formatarMzn(g)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <View style={{ gap: Spacing.two }}>
              {porPagar ? (
                <BotaoPrincipal texto={`Pagar ${formatarMzn(preco + gorjeta)}`} onPress={concluir} />
              ) : (
                <BotaoPrincipal texto={gorjeta > 0 ? `Concluir e enviar ${formatarMzn(gorjeta)}` : 'Concluir'} onPress={concluir} desativado={estrelas === 0} />
              )}
              {viagemConta && <BotaoSecundario texto="Ver recibo" onPress={() => router.push({ pathname: '/recibo', params: { id: viagemConta.id } })} />}
            </View>
          </>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {fase === 'sem_resposta' && <BotaoPrincipal texto="Tentar outra vez" onPress={() => setFase('procurar')} />}
            {/* Com o motorista real, é ele que começa a viagem quando o cliente lhe diz o código. */}
            {fase === 'chegou' && !TEMPO_REAL_ATIVO && <BotaoPrincipal texto="Já estou no carro" onPress={() => setFase('em_viagem')} />}
            {fase === 'chegou' && TEMPO_REAL_ATIVO && <Text style={[s.secundario, { textAlign: 'center' }]}>A viagem começa quando disseres o código a {primeiroNome}.</Text>}
            {(fase === 'procurar' || fase === 'sem_resposta' || fase === 'a_caminho' || fase === 'chegou') && <BotaoSecundario texto="Cancelar pedido" onPress={cancelar} />}
          </View>
        )}
      </Painel>

      <Modal visible={sos} transparent animationType="fade" onRequestClose={() => setSos(false)} statusBarTranslucent>
        <Pressable style={s.fundoSos} onPress={() => setSos(false)}>
          <Pressable style={s.folhaSos} onPress={() => {}}>
            <Text style={s.tituloSos}>Emergência</Text>
            <Text style={[s.secundario, { marginBottom: Spacing.three }]}>
              {nomeViatura(viatura)} · {motorista.matricula} · {motorista.nome}
            </Text>
            {EMERGENCIA.map((e) => (
              <Pressable key={e.numero} onPress={() => Linking.openURL(`tel:${e.numero}`)} style={s.linhaSos}>
                <Text style={s.nome}>{e.nome}</Text>
                <Text style={s.numeroSos}>{e.numero}</Text>
              </Pressable>
            ))}
            <Pressable onPress={partilharLocalizacao} style={s.linhaSos}>
              <Text style={s.nome}>Enviar a minha localização</Text>
              <Text style={s.secundario}>›</Text>
            </Pressable>
            <View style={{ marginTop: Spacing.three }}>
              <BotaoSecundario texto="Fechar" onPress={() => setSos(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Acao({ texto, onPress, s, contador = 0 }: { texto: string; onPress: () => void; s: ReturnType<typeof estilos>; contador?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.acao, pressed && { opacity: 0.7 }]}>
      <Text style={s.acaoTexto} numberOfLines={1}>
        {texto}
      </Text>
      {contador > 0 && (
        <View style={s.contador}>
          <Text style={s.contadorTexto}>{contador}</Text>
        </View>
      )}
    </Pressable>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    sos: { backgroundColor: '#DC2626', borderRadius: Radius.pill, paddingHorizontal: Spacing.three, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
    sosTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
    estado: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
    pontoEstado: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.go },
    titulo: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
    procura: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.four },
    motorista: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.backgroundSelected, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { color: c.text, fontSize: 20, fontWeight: '800' },
    matricula: { color: c.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, backgroundColor: c.backgroundElement, borderRadius: 6, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, overflow: 'hidden' },
    codigo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, marginBottom: Spacing.three },
    codigoTitulo: { color: c.text, fontSize: 15, fontWeight: '700' },
    codigoNumero: { color: c.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
    acoes: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
    acao: { flex: 1, backgroundColor: c.backgroundElement, borderRadius: Radius.pill, paddingVertical: Spacing.two + 4, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    acaoTexto: { color: c.text, fontSize: 14, fontWeight: '700' },
    contador: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    contadorTexto: { color: '#000000', fontSize: 11, fontWeight: '800' },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    secundarioPequeno: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
    total: { color: c.text, fontSize: 28, fontWeight: '800', marginBottom: Spacing.two },
    estrelas: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
    estrela: { fontSize: 36 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
    chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: c.backgroundElement, borderWidth: 1.5, borderColor: 'transparent' },
    chipAtivo: { borderColor: c.primary },
    chipTexto: { color: c.text, fontSize: 13, fontWeight: '600' },
    chipTextoAtivo: { fontWeight: '800' },
    comentario: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, color: c.text, fontSize: 15, marginBottom: Spacing.three },
    fundoSos: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    folhaSos: { backgroundColor: c.background, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, padding: Spacing.four, paddingBottom: Spacing.five },
    tituloSos: { color: '#DC2626', fontSize: 22, fontWeight: '800', marginBottom: 2 },
    linhaSos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    numeroSos: { color: '#DC2626', fontSize: 17, fontWeight: '800' },
  });
}
