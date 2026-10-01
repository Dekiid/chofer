import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Vibration } from 'react-native';

import type { Ponto } from '@/components/mapa-tipos';
import { avisarNoTelemovel } from '@/data/avisos-telemovel';
import { formatarDia, formatarHora } from '@/data/agenda';
import { COMISSAO, nomeViatura, type Viatura } from '@/data/categorias';
import { useGuardado } from '@/data/guardar';
import { LOCALIZACAO_PADRAO, LUGARES, nomeLugar, type Lugar } from '@/data/lugares';
import { comecarLocalizacaoFundo, pararLocalizacaoFundo } from '@/data/localizacao-fundo';
import { MOTORISTA_EXEMPLO, type Motorista } from '@/data/motorista';
import { calcularRota, calcularRotaPor, pontoNaRota, rotaEstimadaPor, type Rota } from '@/data/rotas';
import { gerarCodigoRecolha } from '@/data/seguranca';
import { registarPushMotorista } from '@/data/push';
import { pararPedido, tocarPedido } from '@/data/som-pedido';
import { ouvir, publicar, TEMPO_REAL_ATIVO, type PedidoMotorista } from '@/data/tempo-real';
import { calcularPreco, distanciaKm } from '@/data/viagem';
import { useAgenda } from '@/state/agenda';
import { usePedido } from '@/state/pedido';
import { useSessao } from '@/state/sessao';
import { t } from '@/i18n';

export type FaseMotorista = 'a_recolha' | 'chegou' | 'em_viagem' | 'concluida';
export type ViagemMotorista = { pedido: PedidoMotorista; fase: FaseMotorista; rota: Rota | null; /** Hora a que chegou à recolha, para a espera. */ chegouEm?: number };

/** Tempo para aceitar um pedido (1 minuto, decisão do Flavio). Depois fica recusado. */
export const TEMPO_PARA_ACEITAR = 60000;
// Condução simulada (para testar sem sair de casa): duração de cada troço.
const SIMULACAO_RECOLHA = 20000;
const SIMULACAO_VIAGEM = 30000;
const PASSO = 500;
// A posição vai para o cliente no máximo de 2 em 2 segundos.
const INTERVALO_POSICAO = 2000;

/** Modo «ir para casa»: no máximo duas vezes por dia, como na Uber. */
export const MAX_IR_PARA_CASA_POR_DIA = 2;
/** Com «ir para casa», só chegam pedidos cujo destino fica pelo menos isto mais perto de casa. */
const APROXIMA_KM = 1;

/** O pedido deixa o motorista mais perto de casa? */
export const aproximaDeCasa = (p: PedidoMotorista, posicao: Ponto, casa: Ponto) => distanciaKm(p.destino, casa) <= distanciaKm(posicao, casa) - APROXIMA_KM;

/** O que o motorista recebe: o valor pago pelo cliente menos a comissão da plataforma. */
export const ganhoMotorista = (p: PedidoMotorista) => Math.round(p.precoMzn * (1 - COMISSAO));

type ModoMotorista = {
  viatura: Viatura | null;
  escolherViatura: (id: string | null) => void;
  eu: Motorista;
  online: boolean;
  setOnline: (v: boolean) => void;
  /** Turno em curso, ou null. */
  turno: Turno | null;
  /** Em pausa: continua online, mas não recebe pedidos para agora. */
  emPausa: boolean;
  pausar: () => void;
  retomar: () => void;
  /** Fica offline, fecha o turno e devolve o resumo. */
  terminarTurno: () => ResumoTurno | null;
  turnos: ResumoTurno[];
  posicao: Ponto;
  /** Move o carro sozinho pela rota, para testar sem conduzir. */
  simular: boolean;
  setSimular: (v: boolean) => void;
  pedidoNovo: PedidoMotorista | null;
  expiraEm: number | null;
  viagem: ViagemMotorista | null;
  /** Reservas do carro, por data. Já estão pagas e a agenda garante que o carro está livre, por isso ficam confirmadas logo. */
  agendadas: PedidoMotorista[];
  /** Viagens concluídas, guardadas neste telemóvel, para os pedidos feitos e os ganhos. */
  feitas: { pedido: PedidoMotorista; concluidaEm: string }[];
  simularReserva: () => void;
  ganhosHoje: number;
  viagensHoje: number;
  aceitar: () => void;
  recusar: () => void;
  comecarAgendada: (id: string) => void;
  cheguei: () => void;
  /** Começa a viagem se o código do cliente estiver certo. */
  comecar: (codigo: string) => boolean;
  terminar: () => void;
  /** Cancela a viagem; com 'falta', o cliente não apareceu depois da espera. */
  cancelarViagem: (motivo?: 'falta') => void;
  fecharResumo: () => void;
  simularPedido: () => void;
  /** Ir para casa: só recebe pedidos para agora que o aproximam de casa. */
  casa: Lugar | null;
  setCasa: (l: Lugar | null) => void;
  irParaCasa: boolean;
  /** Liga o modo; devolve false se já usou as vezes do dia. */
  ligarIrParaCasa: () => boolean;
  desligarIrParaCasa: () => void;
  usosCasaHoje: number;
};

/** Turno aberto: começa quando o motorista fica online e acaba quando ele o termina. */
export type Turno = { inicio: string; pausas: { inicio: string; fim?: string }[] };
/** Resumo de um turno terminado, guardado para o motorista rever. */
export type ResumoTurno = {
  inicio: string;
  fim: string;
  minutosOnline: number;
  minutosPausa: number;
  viagens: number;
  ganhosMzn: number;
  km: number;
};

/** Minutos de pausa de um turno, contando a pausa em curso até agora. */
export function minutosPausa(turno: Turno, ate = Date.now()) {
  return Math.round(turno.pausas.reduce((t, p) => t + ((p.fim ? new Date(p.fim).getTime() : ate) - new Date(p.inicio).getTime()), 0) / 60000);
}

/** Depois de tantas horas a trabalhar, a app pede ao motorista para descansar. */
export const HORAS_ATE_DESCANSO = 10;

const Contexto = createContext<ModoMotorista | null>(null);

export function ModoMotoristaProvider({ children }: { children: ReactNode }) {
  const { viaturas } = usePedido();
  const [viaturaId, setViaturaId] = useState<string | null>(null);
  const viatura = viaturas.find((v) => v.id === viaturaId) ?? null;
  const eu = viatura?.motorista ?? MOTORISTA_EXEMPLO;
  const [online, setOnline] = useState(false);
  const [posicao, setPosicao] = useState<Ponto>(LOCALIZACAO_PADRAO);
  const [simular, setSimular] = useState(true);
  const [pedidoNovo, setPedidoNovo] = useState<PedidoMotorista | null>(null);
  const [expiraEm, setExpiraEm] = useState<number | null>(null);
  const [viagem, setViagem] = useState<ViagemMotorista | null>(null);
  // Reservas que chegaram em direto (ou simuladas).
  const [recebidas, setAgendadas] = useState<PedidoMotorista[]>([]);
  // Reservas já começadas, para não voltarem à lista.
  const [comecadas, setComecadas] = useState<string[]>([]);
  const { reservas } = useAgenda();
  // Mais as que estão guardadas na agenda do servidor: aparecem mesmo que a app do motorista estivesse fechada quando o cliente pagou.
  const limiteAtraso = Date.now() - 60 * 60000;
  const doServidor = reservas
    .filter((r) => r.viaturaId === viaturaId && r.pedido?.recolhaEm && new Date(r.pedido.recolhaEm).getTime() > limiteAtraso)
    .map((r) => r.pedido!);
  const agendadas = [...recebidas, ...doServidor.filter((p) => !recebidas.some((x) => x.id === p.id))]
    .filter((p) => !comecadas.includes(p.id))
    .sort(porData);
  // As viagens feitas ficam guardadas neste telemóvel, por motorista, para o ecrã de ganhos.
  const { perfil } = useSessao();
  const [feitas, setFeitas] = useGuardado<{ pedido: PedidoMotorista; concluidaEm: string }[]>(
    perfil?.telefone ? `chauffeur.motorista.${perfil.telefone}.feitas` : null,
    [],
  );
  const deHoje = feitas.filter((f) => new Date(f.concluidaEm).toDateString() === new Date().toDateString());
  const chaveMotorista = perfil?.telefone ? `chauffeur.motorista.${perfil.telefone}` : null;
  const [turno, setTurno] = useGuardado<Turno | null>(chaveMotorista && `${chaveMotorista}.turno`, null);
  const [turnos, setTurnos] = useGuardado<ResumoTurno[]>(chaveMotorista && `${chaveMotorista}.turnos`, []);
  const emPausa = turno?.pausas.some((p) => !p.fim) ?? false;
  const [casa, setCasa] = useGuardado<Lugar | null>(chaveMotorista && `${chaveMotorista}.casa`, null);
  const [usosCasa, setUsosCasa] = useGuardado<{ dia: string; n: number }>(chaveMotorista && `${chaveMotorista}.casa-usos`, { dia: '', n: 0 });
  const [irParaCasa, setIrParaCasa] = useState(false);
  const hoje = new Date().toDateString();
  const usosCasaHoje = usosCasa.dia === hoje ? usosCasa.n : 0;
  const ganhosHoje = deHoje.reduce((t, f) => t + ganhoMotorista(f.pedido), 0);
  const viagensHoje = deHoje.length;

  // Os eventos chegam fora do ciclo do React; estas referências têm sempre o estado atual.
  const atual = useRef({ online, emPausa, viaturaId, pedidoNovo, viagem, posicao, eu, simular, casa: irParaCasa ? casa : null });
  useEffect(() => {
    atual.current = { online, emPausa, viaturaId, pedidoNovo, viagem, posicao, eu, simular, casa: irParaCasa ? casa : null };
  });

  const receber = useCallback((p: PedidoMotorista) => {
    setPedidoNovo(p);
    setExpiraEm(Date.now() + TEMPO_PARA_ACEITAR);
    Vibration.vibrate([0, 400, 200, 400]);
    avisarNoTelemovel(t('Novo pedido'), t('{origem} → {destino} · recebes {valor} MT', { origem: nomeLugar(p.origem), destino: nomeLugar(p.destino), valor: ganhoMotorista(p) }));
  }, []);

  // Reserva nova: fica logo na agenda do motorista (o cliente já pagou e o carro estava livre), com um toque curto e um aviso.
  const receberReserva = useCallback((p: PedidoMotorista) => {
    setAgendadas((l) => (l.some((x) => x.id === p.id) ? l : [...l, p].sort(porData)));
    tocarPedido(false);
    Vibration.vibrate([0, 300, 150, 300]);
    avisarNoTelemovel(t('Nova reserva confirmada'), `${p.recolhaEm ? `${formatarDia(new Date(p.recolhaEm), new Date())}, ${formatarHora(new Date(p.recolhaEm))} · ` : ''}${nomeLugar(p.origem)} → ${nomeLugar(p.destino)}`);
  }, []);

  // Pedidos e cancelamentos dos clientes.
  useEffect(
    () =>
      ouvir((e) => {
        const a = atual.current;
        if (e.tipo === 'pedido') {
          if (e.pedido.viaturaId !== a.viaturaId) return;
          // Reservas chegam mesmo offline e ficam confirmadas; pedidos para agora só com o motorista online e livre.
          if (e.pedido.recolhaEm) receberReserva(e.pedido);
          // Com «ir para casa», os pedidos que o afastam de casa não aparecem.
          else if (a.online && !a.emPausa && !a.viagem && !a.pedidoNovo && (!a.casa || aproximaDeCasa(e.pedido, a.posicao, a.casa))) receber(e.pedido);
        }
        if (e.tipo === 'cancelado' && e.por === 'cliente') {
          if (a.pedidoNovo?.id === e.id) setPedidoNovo(null);
          if (a.viagem?.pedido.id === e.id) {
            setViagem(null);
            pararLocalizacaoFundo();
            Vibration.vibrate();
            avisarNoTelemovel(t('Viagem cancelada'), t('O cliente cancelou a viagem.'));
          }
          setAgendadas((l) => l.filter((p) => p.id !== e.id));
        }
      }),
    [receber, receberReserva],
  );

  // O toque repete enquanto o pedido está no ecrã.
  useEffect(() => {
    if (!pedidoNovo) return;
    tocarPedido();
    return pararPedido;
  }, [pedidoNovo]);

  // O pedido deixa de valer ao fim do tempo para aceitar.
  useEffect(() => {
    if (!pedidoNovo || !expiraEm) return;
    const t = setTimeout(() => {
      publicar({ tipo: 'recusado', id: pedidoNovo.id });
      setPedidoNovo(null);
    }, expiraEm - Date.now());
    return () => clearTimeout(t);
  }, [pedidoNovo, expiraEm]);

  // GPS do telemóvel enquanto está online ou numa viagem. Na simulação, durante a condução, manda a simulação.
  const precisaGps = online || viagem != null;
  useEffect(() => {
    if (!precisaGps || Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | null = null;
    let ativo = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !ativo) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 }, (l) => {
        const a = atual.current;
        const aConduzirSimulado = a.simular && a.viagem && (a.viagem.fase === 'a_recolha' || a.viagem.fase === 'em_viagem');
        if (!aConduzirSimulado) setPosicao({ latitude: l.coords.latitude, longitude: l.coords.longitude });
      });
      if (!ativo) sub.remove();
    })();
    return () => {
      ativo = false;
      sub?.remove();
    };
  }, [precisaGps]);

  // Condução simulada ao longo da rota.
  const pontosRota = viagem?.rota?.pontos;
  const faseViagem = viagem?.fase;
  useEffect(() => {
    if (!simular || !pontosRota || (faseViagem !== 'a_recolha' && faseViagem !== 'em_viagem')) return;
    const duracao = faseViagem === 'a_recolha' ? SIMULACAO_RECOLHA : SIMULACAO_VIAGEM;
    let t = 0;
    const id = setInterval(() => {
      t = Math.min(1, t + PASSO / duracao);
      setPosicao(pontoNaRota(pontosRota, t));
      if (t >= 1) clearInterval(id);
    }, PASSO);
    return () => clearInterval(id);
  }, [simular, pontosRota, faseViagem]);

  // A posição vai para o cliente enquanto a viagem decorre.
  const ultimaPosicao = useRef(0);
  const idViagem = viagem && viagem.fase !== 'concluida' ? viagem.pedido.id : null;
  useEffect(() => {
    if (!idViagem || Date.now() - ultimaPosicao.current < INTERVALO_POSICAO) return;
    ultimaPosicao.current = Date.now();
    publicar({ tipo: 'posicao', id: idViagem, posicao });
  }, [idViagem, posicao]);

  // Sem servidor, o primeiro pedido simulado chega pouco depois de ficar online.
  const iniciarViagem = useCallback(async (pedido: PedidoMotorista) => {
    setViagem({ pedido, fase: 'a_recolha', rota: null });
    // Com a app em segundo plano, a posição continua a ir para o cliente (precisa da versão de desenvolvimento).
    if (!atual.current.simular) comecarLocalizacaoFundo(pedido.id);
    const rota = await calcularRota(atual.current.posicao, pedido.origem);
    setViagem((v) => (v?.pedido.id === pedido.id && v.fase === 'a_recolha' ? { ...v, rota } : v));
  }, []);

  // Pedido de demonstração: recolha perto do motorista; para agora ou, numa reserva, para amanhã.
  const pedidoDemo = useCallback(
    (reserva: boolean): PedidoMotorista | null => {
      const a = atual.current;
      const v = viaturas.find((x) => x.id === a.viaturaId);
      if (!v) return null;
      // A recolha é um dos lugares mais perto do motorista; o destino, qualquer outro.
      const perto = [...LUGARES].sort((x, y) => distanciaKm(a.posicao, x) - distanciaKm(a.posicao, y)).slice(0, 4);
      const origem = perto[Math.floor(Math.random() * perto.length)];
      const outros = LUGARES.filter((l) => l.id !== origem.id);
      // Com «ir para casa», o pedido de demonstração vai para perto de casa.
      const paraCasa = a.casa && !reserva ? outros.filter((l) => distanciaKm(l, a.casa!) <= distanciaKm(origem, a.casa!) - APROXIMA_KM) : [];
      const escolha = paraCasa.length > 0 ? paraCasa : a.casa && !reserva ? [a.casa] : outros;
      const destino = escolha[Math.floor(Math.random() * escolha.length)];
      const rota = rotaEstimadaPor([origem, destino]);
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      amanha.setHours(8 + Math.floor(Math.random() * 10), Math.random() < 0.5 ? 0 : 30, 0, 0);
      return {
        id: `demo-${Date.now()}`,
        viaturaId: v.id,
        viaturaNome: nomeViatura(v),
        origem,
        paragens: [],
        destino,
        km: rota.km,
        minutos: rota.minutos,
        precoMzn: calcularPreco(v, rota.km, !reserva),
        recolhaEm: reserva ? amanha.toISOString() : undefined,
        codigoRecolha: gerarCodigoRecolha(),
        pagamento: 'M-Pesa',
        criadoEm: new Date().toISOString(),
      };
    },
    [viaturas],
  );

  const simularPedido = useCallback(() => {
    const a = atual.current;
    if (a.viagem || a.pedidoNovo) return;
    const p = pedidoDemo(false);
    if (p) receber(p);
  }, [pedidoDemo, receber]);

  const simularReserva = useCallback(() => {
    const p = pedidoDemo(true);
    if (p) receberReserva(p);
  }, [pedidoDemo, receberReserva]);

  useEffect(() => {
    if (TEMPO_REAL_ATIVO || !online || emPausa || viagem || pedidoNovo) return;
    const t = setTimeout(simularPedido, 5000);
    return () => clearTimeout(t);
  }, [online, emPausa, viagem, pedidoNovo, simularPedido]);

  const valor = useMemo<ModoMotorista>(
    () => ({
      viatura,
      escolherViatura: (id) => {
        setViaturaId(id);
        if (!id) setOnline(false);
      },
      eu,
      online,
      setOnline: (v) => {
        setOnline(v);
        // Ficar online abre o turno, se ainda não houver um.
        if (v && !turno) setTurno({ inicio: new Date().toISOString(), pausas: [] });
        // Para receber pedidos com a app fechada.
        if (v && viatura && perfil?.telefone) registarPushMotorista(viatura.id, perfil.telefone);
        if (!v) setPedidoNovo(null);
      },
      turno,
      emPausa,
      pausar: () => {
        if (!turno || emPausa) return;
        setPedidoNovo(null);
        setTurno({ ...turno, pausas: [...turno.pausas, { inicio: new Date().toISOString() }] });
      },
      retomar: () => {
        if (!turno) return;
        setTurno({ ...turno, pausas: turno.pausas.map((p) => (p.fim ? p : { ...p, fim: new Date().toISOString() })) });
      },
      terminarTurno: () => {
        setOnline(false);
        setPedidoNovo(null);
        if (!turno) return null;
        const fim = new Date();
        const doTurno = feitas.filter((f) => f.concluidaEm >= turno.inicio);
        const pausa = minutosPausa(turno, fim.getTime());
        const resumo: ResumoTurno = {
          inicio: turno.inicio,
          fim: fim.toISOString(),
          minutosPausa: pausa,
          minutosOnline: Math.max(0, Math.round((fim.getTime() - new Date(turno.inicio).getTime()) / 60000) - pausa),
          viagens: doTurno.length,
          ganhosMzn: doTurno.reduce((t, f) => t + ganhoMotorista(f.pedido), 0),
          km: Math.round(doTurno.reduce((t, f) => t + f.pedido.km, 0) * 10) / 10,
        };
        setTurnos((l) => [resumo, ...l].slice(0, 60));
        setTurno(null);
        return resumo;
      },
      turnos,
      posicao,
      simular,
      setSimular,
      pedidoNovo,
      expiraEm,
      viagem,
      agendadas,
      feitas,
      simularReserva,
      ganhosHoje,
      viagensHoje,
      aceitar: () => {
        if (!pedidoNovo) return;
        const agendada = pedidoNovo.recolhaEm != null;
        publicar({ tipo: 'aceite', id: pedidoNovo.id, motorista: eu, posicao, agendada });
        setPedidoNovo(null);
        if (agendada) setAgendadas((l) => [...l, pedidoNovo].sort(porData));
        else iniciarViagem(pedidoNovo);
      },
      recusar: () => {
        if (!pedidoNovo) return;
        publicar({ tipo: 'recusado', id: pedidoNovo.id });
        setPedidoNovo(null);
      },
      comecarAgendada: (id) => {
        const p = agendadas.find((x) => x.id === id);
        if (!p || viagem) return;
        setAgendadas((l) => l.filter((x) => x.id !== id));
        setComecadas((l) => [...l, id]);
        publicar({ tipo: 'estado', id, estado: 'a_caminho', motorista: eu });
        iniciarViagem(p);
      },
      cheguei: () => {
        if (!viagem) return;
        publicar({ tipo: 'estado', id: viagem.pedido.id, estado: 'chegou' });
        if (simular) setPosicao(viagem.pedido.origem);
        setViagem({ ...viagem, fase: 'chegou', rota: null, chegouEm: Date.now() });
      },
      comecar: (codigo) => {
        if (!viagem || codigo !== viagem.pedido.codigoRecolha) return false;
        const { pedido } = viagem;
        publicar({ tipo: 'estado', id: pedido.id, estado: 'em_viagem' });
        setViagem({ ...viagem, fase: 'em_viagem', rota: null });
        calcularRotaPor([pedido.origem, ...pedido.paragens, pedido.destino]).then((rota) =>
          setViagem((v) => (v?.pedido.id === pedido.id && v.fase === 'em_viagem' ? { ...v, rota } : v)),
        );
        return true;
      },
      terminar: () => {
        if (!viagem) return;
        publicar({ tipo: 'estado', id: viagem.pedido.id, estado: 'concluida' });
        if (simular) setPosicao(viagem.pedido.destino);
        pararLocalizacaoFundo();
        setFeitas((l) => [{ pedido: viagem.pedido, concluidaEm: new Date().toISOString() }, ...l]);
        setViagem({ ...viagem, fase: 'concluida', rota: null });
        // Chegou perto de casa: o modo desliga-se sozinho.
        if (irParaCasa && casa && distanciaKm(viagem.pedido.destino, casa) < 1.5) {
          setIrParaCasa(false);
          avisarNoTelemovel(t('Chegaste perto de casa'), t('O modo ir para casa desligou-se.'));
        }
      },
      cancelarViagem: (motivo) => {
        if (!viagem) return;
        publicar({ tipo: 'cancelado', id: viagem.pedido.id, por: 'motorista', motivo });
        pararLocalizacaoFundo();
        setViagem(null);
      },
      fecharResumo: () => setViagem(null),
      simularPedido,
      casa,
      setCasa,
      irParaCasa,
      ligarIrParaCasa: () => {
        if (!casa || usosCasaHoje >= MAX_IR_PARA_CASA_POR_DIA) return false;
        setUsosCasa({ dia: hoje, n: usosCasaHoje + 1 });
        setIrParaCasa(true);
        return true;
      },
      desligarIrParaCasa: () => setIrParaCasa(false),
      usosCasaHoje,
    }),
    [viatura, perfil, eu, online, turno, setTurno, emPausa, turnos, setTurnos, posicao, simular, pedidoNovo, expiraEm, viagem, agendadas, feitas, setFeitas, ganhosHoje, viagensHoje, iniciarViagem, simularPedido, simularReserva, casa, setCasa, irParaCasa, usosCasaHoje, setUsosCasa, hoje],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

const porData = (x: PedidoMotorista, y: PedidoMotorista) => (x.recolhaEm ?? '').localeCompare(y.recolhaEm ?? '');

export function useModoMotorista(): ModoMotorista {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useModoMotorista tem de estar dentro de ModoMotoristaProvider');
  return ctx;
}
