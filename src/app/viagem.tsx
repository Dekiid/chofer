import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
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
import { custoCancelar, custoFalta, type Cancelamento } from '@/data/cancelamento';
import { devePartilhar, textoPreferencias } from '@/data/extras-viagem';
import { avisarMotoristaPorPush } from '@/data/push';
import { ouvir, publicar, TEMPO_REAL_ATIVO } from '@/data/tempo-real';
import { calcularPreco, distanciaKm, duracaoMin } from '@/data/viagem';
import type { Motorista } from '@/data/motorista';
import { useAgenda } from '@/state/agenda';
import { formatarNota, useAvaliacoes } from '@/state/avaliacoes';
import { ELOGIOS, useConta } from '@/state/conta';
import { useSessao } from '@/state/sessao';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';
import { t } from '@/i18n';

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
  const avaliacoes = useAvaliacoes();
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
  const faltaRef = useRef<() => void>(() => {});

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
        setMotivoSemResposta(t('O motorista não pode fazer esta viagem agora.'));
        setFase((f) => (f === 'procurar' ? 'sem_resposta' : f));
      }
      if (e.tipo === 'posicao') setCarro(e.posicao);
      if (e.tipo === 'estado') {
        if (e.motorista) setMotoristaReal(e.motorista);
        if (e.estado === 'em_viagem') setProgresso(0);
        setFase(e.estado);
      }
      if (e.tipo === 'cancelado' && e.por === 'motorista' && e.motivo === 'falta') {
        faltaRef.current();
        return;
      }
      if (e.tipo === 'cancelado' && e.por === 'motorista') {
        setMotivoSemResposta(t('O motorista cancelou a viagem.'));
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
        clienteTelefone: sessao.perfil?.telefone,
        pagaNoFim: viagemConta?.porPagar,
        passageiro: viagemConta?.passageiro ?? pedido.passageiro ?? undefined,
        preferencias: viagemConta?.preferencias ?? conta.preferencias,
        voo: viagemConta?.voo ?? pedido.voo ?? undefined,
      },
    });
    // Com a app do motorista fechada, o aviso chega por push (precisa da versão de desenvolvimento).
    avisarMotoristaPorPush(v.id, 'Novo pedido para agora', `${origem.nome} → ${destino.nome}. Tens 1 minuto para aceitar.`, { id: idPedido });
    const limite = setTimeout(() => {
      setMotivoSemResposta(t('O motorista não respondeu a tempo.'));
      setFase((f) => (f === 'procurar' ? 'sem_resposta' : f));
    }, TEMPO_ESPERA_MOTORISTA);
    return () => clearTimeout(limite);
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
    let fracao = 0;
    const id = setInterval(() => {
      fracao = Math.min(1, fracao + PASSO / TEMPO_DESLOCACAO);
      setCarro(pontoNaRota(pontos, fracao));
      setProgresso(fracao);
      if (fracao >= 1) {
        clearInterval(id);
        setFase(fase === 'a_caminho' ? 'chegou' : 'concluida');
      }
    }, PASSO);
    return () => clearInterval(id);
  }, [fase, rotaMotorista, pontosViagem]);

  const viatura = pedido.viatura;
  const motorista = motoristaReal ?? viatura.motorista ?? MOTORISTA_EXEMPLO;
  const primeiroNome = motorista.nome.split(' ')[0];
  const notaMotorista = avaliacoes.mediaMotorista(motorista.telefone);

  // Avisos de cada mudança de fase: dentro da app e no telemóvel.
  const { avisar, atualizarViagem } = conta;
  const faseAvisada = useRef<Fase>('procurar');
  useEffect(() => {
    if (fase === faseAvisada.current || !destino) return;
    faseAvisada.current = fase;
    // Partilha automática com os contactos de confiança (sempre, ou só à noite).
    if (fase === 'a_caminho' && conta.contactosConfianca.length > 0 && devePartilhar(conta.partilhaAuto, new Date()))
      avisar(t('Viagem partilhada'), t('{nomes} recebem o percurso, o carro e o motorista desta viagem.', { nomes: conta.contactosConfianca.map((c) => c.nome).join(', ') }));
    if (fase === 'a_caminho') avisar(t('{nome} vai a caminho', { nome: primeiroNome }), t('{viatura} · {matricula}. Código de recolha: {codigo}.', { viatura: nomeViatura(viatura), matricula: motorista.matricula, codigo }));
    if (fase === 'chegou') avisar(t('O teu chauffeur chegou'), t('{nome} está à porta num {viatura}. Diz-lhe o código {codigo}.', { nome: primeiroNome, viatura: nomeViatura(viatura), codigo }));
    if (fase === 'em_viagem' && viagemConta) atualizarViagem(viagemConta.id, { estado: 'em_curso' });
    if (fase === 'concluida') avisar(t('Chegaste ao destino'), t('Obrigado por viajares com a Chauffeur. Avalia {nome} e vê o recibo.', { nome: primeiroNome }));
  }, [fase, destino, avisar, atualizarViagem, viagemConta, primeiroNome, viatura, motorista.matricula, codigo]);

  if (!destino) return <Redirect href="/" />;

  const preco = viagemConta ? viagemConta.precoMzn - viagemConta.descontoMzn : calcularPreco(viatura, pedido.rota?.km ?? 0, pedido.quando?.tipo === 'imediato');
  const nomeMetodo = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome;
  const pagamento = nomeMetodo && t(nomeMetodo);
  // Com o motorista real, o tempo que falta sai da distância até ao ponto seguinte.
  const minutosRestantes = TEMPO_REAL_ATIVO && carro ? duracaoMin(distanciaKm(carro, origem) * 1.3) : Math.max(1, Math.round(viatura.chegadaMin * (1 - progresso)));
  const minutosViagem = TEMPO_REAL_ATIVO && carro ? duracaoMin(distanciaKm(carro, destino) * 1.3) : Math.max(1, Math.round((pedido.rota?.minutos ?? 0) * (1 - progresso)));

  function sair() {
    pedido.limpar();
    router.dismissTo('/');
  }

  // Quanto custa cancelar agora (regras em src/data/cancelamento.ts).
  const aceite = fase === 'a_caminho' || fase === 'chegou';
  const [aceiteEm, setAceiteEm] = useState<number | null>(null);
  useEffect(() => {
    if (aceite && aceiteEm == null) setAceiteEm(Date.now());
  }, [aceite, aceiteEm]);
  const [confirmarCancelar, setConfirmarCancelar] = useState<Cancelamento | null>(null);

  // O motorista esperou e o cliente não apareceu.
  useEffect(() => {
    faltaRef.current = () => {
      if (!viagemConta) return sair();
      const c = custoFalta(viagemConta);
      atualizarViagem(viagemConta.id, { estado: 'cancelada', porPagar: false, taxaCancelamentoMzn: c.taxaMzn, reembolsoMzn: 0, motivoCancelamento: 'falta' });
      agenda.libertar(viagemConta.id);
      avisar(t('Falta de comparência'), `${c.texto} ${formatarMzn(c.taxaMzn)}.`);
      sair();
    };
  });

  function pedirCancelar() {
    const c = viagemConta ? custoCancelar(viagemConta, new Date(), aceite, aceiteEm ?? undefined) : null;
    if (c && (c.taxaMzn > 0 || c.reembolsoMzn > 0)) setConfirmarCancelar(c);
    else cancelar(c);
  }

  function cancelar(c: Cancelamento | null) {
    if (TEMPO_REAL_ATIVO) publicar({ tipo: 'cancelado', id: idPedido, por: 'cliente' });
    if (viagemConta) {
      atualizarViagem(viagemConta.id, {
        estado: 'cancelada',
        porPagar: false,
        taxaCancelamentoMzn: c?.taxaMzn ?? 0,
        reembolsoMzn: c?.reembolsoMzn ?? 0,
        motivoCancelamento: 'cliente',
      });
      if (c && c.taxaMzn > 0) avisar(t('Viagem cancelada'), t('Taxa de cancelamento: {valor}, por {pagamento}.', { valor: formatarMzn(c.taxaMzn), pagamento: pagamento ?? '' }));
      else if (c && c.reembolsoMzn > 0) avisar(t('Viagem cancelada'), t('Devolvemos {valor} por {pagamento}.', { valor: formatarMzn(c.reembolsoMzn), pagamento: pagamento ?? '' }));
      // O carro volta a ficar livre na agenda.
      agenda.libertar(viagemConta.id);
    }
    sair();
  }

  function concluir() {
    const avaliacao = estrelas > 0 ? { estrelas, elogios, comentario: comentario.trim() } : undefined;
    // A avaliação chega ao motorista, que a vê nas suas avaliações (sem o nome do cliente).
    if (avaliacao) avaliacoes.avaliarMotorista(motorista.telefone, { ...avaliacao, em: new Date().toISOString(), viagemId: idPedido });
    if (viagemConta) atualizarViagem(viagemConta.id, { estado: 'concluida', gorjetaMzn: gorjeta, avaliacao });
    // Pedido para agora: paga-se agora, no fim, com a gorjeta incluída.
    if (porPagar && viagemConta) return router.replace({ pathname: '/pagamento', params: { viagem: viagemConta.id } });
    if (gorjeta > 0) avisar(t('Gorjeta enviada'), t('{valor} por {pagamento} para {nome}. Obrigado!', { valor: formatarMzn(gorjeta), pagamento: pagamento ?? '', nome: primeiroNome }));
    sair();
  }

  // Estados curtos, como no manual: «Chega em 4 min».
  const titulo: Record<Fase, string> = {
    procurar: TEMPO_REAL_ATIVO ? t('À espera de {nome}', { nome: primeiroNome }) : t('A procurar motorista'),
    sem_resposta: t('Sem motorista'),
    a_caminho: t('Chega em {n} min', { n: minutosRestantes }),
    chegou: t('O teu chauffeur chegou'),
    em_viagem: t('A caminho de {destino}', { destino: destino.nome }),
    concluida: t('Chegaste ao destino'),
  };
  const ligar = () => Linking.openURL(`tel:${motorista.telefone}`);

  // Mensagem para um familiar ou amigo acompanhar: carro, matrícula, motorista, destino, chegada e onde está agora.
  async function partilhar() {
    const chegada = formatarHora(somarMin(new Date(), fase === 'em_viagem' ? minutosViagem : minutosRestantes + (pedido.rota?.minutos ?? 0)));
    const onde = carro ?? origem;
    const texto =
      t('Estou numa viagem Chauffeur para {destino}.', { destino: destino!.nome }) + '\n' +
      t('Carro: {viatura}, matrícula {matricula}. Motorista: {motorista}.', { viatura: nomeViatura(viatura), matricula: motorista.matricula, motorista: motorista.nome }) + '\n' +
      t('Chegada prevista às {hora}.', { hora: chegada }) + '\n' +
      t('Onde estou agora: {ligacao}', { ligacao: ligacaoMapa(onde) });
    try {
      await Share.share({ message: texto });
    } catch {
      // Sem partilha disponível (alguns browsers); não há nada a fazer.
    }
  }

  async function partilharLocalizacao() {
    try {
      await Share.share({ message: t('Preciso de ajuda. Estou num {viatura} ({matricula}). A minha localização: {ligacao}', { viatura: nomeViatura(viatura), matricula: motorista.matricula, ligacao: ligacaoMapa(carro ?? origem) }) });
    } catch {}
  }

  const comMotorista = fase === 'a_caminho' || fase === 'chegou' || fase === 'em_viagem';
  const passageiro = viagemConta?.passageiro ?? pedido.passageiro;
  const prefs = textoPreferencias(viagemConta?.preferencias ?? conta.preferencias);

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
          <Pressable onPress={() => setSos(true)} style={s.sos} accessibilityLabel={t('Emergência')} hitSlop={8}>
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
          <Text style={[s.secundario, { marginBottom: Spacing.three }]}>{motivoSemResposta} {t('Podes tentar outra vez ou cancelar o pedido.')}</Text>
        ) : fase === 'procurar' ? (
          <View style={s.procura}>
            <ActivityIndicator color={cores.text} />
            <Text style={s.secundario}>
              {nomeViatura(viatura)} · {formatarMzn(preco)} {porPagar ? t('a pagar no fim por {pagamento}', { pagamento: pagamento ?? '' }) : t('pago por {pagamento}', { pagamento: pagamento ?? '' })}
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
                <Text style={s.secundario}>{notaMotorista ? `★ ${formatarNota(notaMotorista.media)}` : t('Novo')}</Text>
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
            detalheRecolha={fase === 'a_caminho' ? `${minutosRestantes} min` : fase === 'chegou' ? t('Chegou') : undefined}
            detalheDestino={fase === 'em_viagem' ? `${minutosViagem} min` : undefined}
          />
        )}

        {(fase === 'a_caminho' || fase === 'chegou') && (
          <View style={s.codigo}>
            <View style={{ flex: 1 }}>
              <Text style={s.codigoTitulo}>{t('Código de recolha')}</Text>
              <Text style={s.secundarioPequeno}>{t('Diz este código ao motorista antes de entrares. Se ele não o souber, não entres.')}</Text>
            </View>
            <Text style={s.codigoNumero} accessibilityLabel={t('Código {codigo}', { codigo: codigo.split('').join(' ') })}>
              {codigo}
            </Text>
          </View>
        )}

        {passageiro && (fase === 'a_caminho' || fase === 'chegou') && (
          <View style={s.extras}>
            <Text style={[s.secundarioPequeno, { flex: 1 }]}>{t('Vai {nome}. Envia-lhe o código {codigo} e o carro.', { nome: passageiro.nome, codigo })}</Text>
            <Text
              style={s.ligacaoExtras}
              onPress={() =>
                Linking.openURL(
                  sms(
                    [passageiro.telefone],
                    t('O teu Chauffeur vai a caminho: {viatura}, matrícula {matricula}, motorista {motorista}. Código de recolha: {codigo}.', {
                      viatura: nomeViatura(viatura),
                      matricula: motorista.matricula,
                      motorista: motorista.nome,
                      codigo,
                    }),
                  ),
                )
              }>
              {t('Enviar por SMS')}
            </Text>
          </View>
        )}
        {comMotorista && prefs.length > 0 && <Text style={[s.secundarioPequeno, { marginBottom: Spacing.one }]}>{prefs.join(' · ')}</Text>}

        {(fase === 'a_caminho' || fase === 'chegou' || fase === 'em_viagem') && <NotaPagamento />}

        {comMotorista && (
          <View style={s.acoes}>
            {/* Já dentro do carro não faz sentido ligar ao motorista. */}
            {fase !== 'em_viagem' && <Acao texto={t('Ligar')} onPress={ligar} s={s} />}
            <Acao texto={t('Mensagem')} onPress={() => router.push('/chat')} s={s} contador={conta.naoLidasChat} />
            <Acao texto={t('Partilhar')} onPress={partilhar} s={s} />
          </View>
        )}

        {fase === 'concluida' ? (
          <>
            <Text style={s.total}>
              {formatarMzn(preco + gorjeta)} <Text style={s.secundario}>· {porPagar ? t('a pagar por {pagamento}', { pagamento: pagamento ?? '' }) : t('pago por {pagamento}', { pagamento: pagamento ?? '' })}</Text>
            </Text>
            <Text style={[s.secundario, { marginBottom: Spacing.two }]}>{t('Como foi a viagem com {nome}?', { nome: primeiroNome })}</Text>
            <View style={s.estrelas}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setEstrelas(n)} accessibilityLabel={n === 1 ? t('{n} estrela', { n }) : t('{n} estrelas', { n })}>
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
                        <Text style={[s.chipTexto, ativo && s.chipTextoAtivo]}>{t(e)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput value={comentario} onChangeText={setComentario} placeholder={t('Comentário (opcional)')} placeholderTextColor={cores.textSecondary} style={s.comentario} maxLength={200} />
                <Text style={[s.secundario, { marginBottom: Spacing.two }]}>{t('Gorjeta para {nome}', { nome: primeiroNome })}</Text>
                <View style={s.chips}>
                  {GORJETAS.map((g) => (
                    <Pressable key={g} onPress={() => setGorjeta(g)} style={[s.chip, gorjeta === g && s.chipAtivo]}>
                      <Text style={[s.chipTexto, gorjeta === g && s.chipTextoAtivo]}>{g === 0 ? t('Sem gorjeta') : formatarMzn(g)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <View style={{ gap: Spacing.two }}>
              {porPagar ? (
                <BotaoPrincipal texto={t('Pagar {valor}', { valor: formatarMzn(preco + gorjeta) })} onPress={concluir} />
              ) : (
                <BotaoPrincipal texto={gorjeta > 0 ? t('Concluir e enviar {valor}', { valor: formatarMzn(gorjeta) }) : t('Concluir')} onPress={concluir} desativado={estrelas === 0} />
              )}
              {viagemConta && <BotaoSecundario texto={t('Ver recibo')} onPress={() => router.push({ pathname: '/recibo', params: { id: viagemConta.id } })} />}
            </View>
          </>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {fase === 'sem_resposta' && <BotaoPrincipal texto={t('Tentar outra vez')} onPress={() => setFase('procurar')} />}
            {/* Com o motorista real, é ele que começa a viagem quando o cliente lhe diz o código. */}
            {fase === 'chegou' && !TEMPO_REAL_ATIVO && <BotaoPrincipal texto={t('Já estou no carro')} onPress={() => setFase('em_viagem')} />}
            {fase === 'chegou' && TEMPO_REAL_ATIVO && <Text style={[s.secundario, { textAlign: 'center' }]}>{t('A viagem começa quando disseres o código a {nome}.', { nome: primeiroNome })}</Text>}
            {(fase === 'procurar' || fase === 'sem_resposta' || fase === 'a_caminho' || fase === 'chegou') &&
              (confirmarCancelar ? (
                <View style={{ gap: Spacing.two }}>
                  <Text style={s.secundario}>{confirmarCancelar.texto}</Text>
                  <BotaoPrincipal
                    escuro
                    texto={confirmarCancelar.taxaMzn > 0 ? t('Cancelar e pagar {valor}', { valor: formatarMzn(confirmarCancelar.taxaMzn) }) : t('Cancelar pedido')}
                    onPress={() => cancelar(confirmarCancelar)}
                  />
                  <BotaoSecundario texto={t('Manter a viagem')} onPress={() => setConfirmarCancelar(null)} />
                </View>
              ) : (
                <BotaoSecundario texto={t('Cancelar pedido')} onPress={pedirCancelar} />
              ))}
          </View>
        )}
      </Painel>

      <Modal visible={sos} transparent animationType="fade" onRequestClose={() => setSos(false)} statusBarTranslucent>
        <Pressable style={s.fundoSos} onPress={() => setSos(false)}>
          <Pressable style={s.folhaSos} onPress={() => {}}>
            <Text style={s.tituloSos}>{t('Emergência')}</Text>
            <Text style={[s.secundario, { marginBottom: Spacing.three }]}>
              {nomeViatura(viatura)} · {motorista.matricula} · {motorista.nome}
            </Text>
            {EMERGENCIA.map((e) => (
              <Pressable key={e.numero} onPress={() => Linking.openURL(`tel:${e.numero}`)} style={s.linhaSos}>
                <Text style={s.nome}>{t(e.nome)}</Text>
                <Text style={s.numeroSos}>{e.numero}</Text>
              </Pressable>
            ))}
            {conta.contactosConfianca.length > 0 && (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    sms(
                      conta.contactosConfianca.map((c) => c.telefone),
                      t('Preciso de ajuda. Estou num {viatura} ({matricula}). A minha localização: {ligacao}', { viatura: nomeViatura(viatura), matricula: motorista.matricula, ligacao: ligacaoMapa(carro ?? origem) }),
                    ),
                  )
                }
                style={s.linhaSos}>
                <Text style={s.nome}>{t('Avisar contactos de confiança')}</Text>
                <Text style={s.secundario}>{conta.contactosConfianca.map((c) => c.nome).join(', ')}</Text>
              </Pressable>
            )}
            <Pressable onPress={partilharLocalizacao} style={s.linhaSos}>
              <Text style={s.nome}>{t('Enviar a minha localização')}</Text>
              <Text style={s.secundario}>›</Text>
            </Pressable>
            <View style={{ marginTop: Spacing.three }}>
              <BotaoSecundario texto={t('Fechar')} onPress={() => setSos(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Abre a app de SMS com a mensagem pronta (no iPhone o separador é diferente). */
const sms = (numeros: string[], corpo: string) => `sms:${numeros.join(',')}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(corpo)}`;

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
    extras: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
    ligacaoExtras: { color: c.text, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
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
