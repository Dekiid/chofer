import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Vibration } from 'react-native';

import type { Ponto } from '@/components/mapa-tipos';
import { avisarNoTelemovel } from '@/data/avisos-telemovel';
import { formatarDia, formatarHora } from '@/data/agenda';
import { COMISSAO, nomeViatura, type Viatura } from '@/data/categorias';
import { LOCALIZACAO_PADRAO, LUGARES } from '@/data/lugares';
import { MOTORISTA_EXEMPLO, type Motorista } from '@/data/motorista';
import { calcularRota, calcularRotaPor, pontoNaRota, rotaEstimadaPor, type Rota } from '@/data/rotas';
import { gerarCodigoRecolha } from '@/data/seguranca';
import { pararPedido, tocarPedido } from '@/data/som-pedido';
import { ouvir, publicar, TEMPO_REAL_ATIVO, type PedidoMotorista } from '@/data/tempo-real';
import { calcularPreco, distanciaKm } from '@/data/viagem';
import { usePedido } from '@/state/pedido';

export type FaseMotorista = 'a_recolha' | 'chegou' | 'em_viagem' | 'concluida';
export type ViagemMotorista = { pedido: PedidoMotorista; fase: FaseMotorista; rota: Rota | null };

/** Tempo para aceitar um pedido (1 minuto, decisão do Flavio). Depois fica recusado. */
export const TEMPO_PARA_ACEITAR = 60000;
// Condução simulada (para testar sem sair de casa): duração de cada troço.
const SIMULACAO_RECOLHA = 20000;
const SIMULACAO_VIAGEM = 30000;
const PASSO = 500;
// A posição vai para o cliente no máximo de 2 em 2 segundos.
const INTERVALO_POSICAO = 2000;

/** O que o motorista recebe: o valor pago pelo cliente menos a comissão da plataforma. */
export const ganhoMotorista = (p: PedidoMotorista) => Math.round(p.precoMzn * (1 - COMISSAO));

type ModoMotorista = {
  viatura: Viatura | null;
  escolherViatura: (id: string | null) => void;
  eu: Motorista;
  online: boolean;
  setOnline: (v: boolean) => void;
  posicao: Ponto;
  /** Move o carro sozinho pela rota, para testar sem conduzir. */
  simular: boolean;
  setSimular: (v: boolean) => void;
  pedidoNovo: PedidoMotorista | null;
  expiraEm: number | null;
  viagem: ViagemMotorista | null;
  /** Reservas novas à espera de resposta do motorista (não expiram ao fim de 1 minuto). */
  pendentes: PedidoMotorista[];
  /** Reservas aceites, por data. */
  agendadas: PedidoMotorista[];
  /** Viagens concluídas hoje, para a lista de pedidos feitos. */
  feitas: { pedido: PedidoMotorista; concluidaEm: string }[];
  aceitarReserva: (id: string) => void;
  recusarReserva: (id: string) => void;
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
  cancelarViagem: () => void;
  fecharResumo: () => void;
  simularPedido: () => void;
};

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
  const [agendadas, setAgendadas] = useState<PedidoMotorista[]>([]);
  const [pendentes, setPendentes] = useState<PedidoMotorista[]>([]);
  const [feitas, setFeitas] = useState<{ pedido: PedidoMotorista; concluidaEm: string }[]>([]);
  const [ganhosHoje, setGanhosHoje] = useState(0);
  const [viagensHoje, setViagensHoje] = useState(0);

  // Os eventos chegam fora do ciclo do React; estas referências têm sempre o estado atual.
  const atual = useRef({ online, viaturaId, pedidoNovo, viagem, posicao, eu, simular });
  useEffect(() => {
    atual.current = { online, viaturaId, pedidoNovo, viagem, posicao, eu, simular };
  });

  const receber = useCallback((p: PedidoMotorista) => {
    setPedidoNovo(p);
    setExpiraEm(Date.now() + TEMPO_PARA_ACEITAR);
    Vibration.vibrate([0, 400, 200, 400]);
    avisarNoTelemovel('Novo pedido', `${p.origem.nome} → ${p.destino.nome} · recebes ${ganhoMotorista(p)} MT`);
  }, []);

  // Reserva nova: vai para os pendentes, com um toque curto (não repete) e um aviso.
  const receberReserva = useCallback((p: PedidoMotorista) => {
    setPendentes((l) => (l.some((x) => x.id === p.id) ? l : [...l, p].sort(porData)));
    tocarPedido(false);
    Vibration.vibrate([0, 300, 150, 300]);
    avisarNoTelemovel('Nova reserva', `${p.recolhaEm ? `${formatarDia(new Date(p.recolhaEm), new Date())}, ${formatarHora(new Date(p.recolhaEm))} · ` : ''}${p.origem.nome} → ${p.destino.nome}`);
  }, []);

  // Pedidos e cancelamentos dos clientes.
  useEffect(
    () =>
      ouvir((e) => {
        const a = atual.current;
        if (e.tipo === 'pedido') {
          if (e.pedido.viaturaId !== a.viaturaId) return;
          // Reservas chegam mesmo offline; pedidos para agora só com o motorista online e livre.
          if (e.pedido.recolhaEm) receberReserva(e.pedido);
          else if (a.online && !a.viagem && !a.pedidoNovo) receber(e.pedido);
        }
        if (e.tipo === 'cancelado' && e.por === 'cliente') {
          if (a.pedidoNovo?.id === e.id) setPedidoNovo(null);
          if (a.viagem?.pedido.id === e.id) {
            setViagem(null);
            Vibration.vibrate();
            avisarNoTelemovel('Viagem cancelada', 'O cliente cancelou a viagem.');
          }
          setAgendadas((l) => l.filter((p) => p.id !== e.id));
          setPendentes((l) => l.filter((p) => p.id !== e.id));
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
      const destino = outros[Math.floor(Math.random() * outros.length)];
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
    if (TEMPO_REAL_ATIVO || !online || viagem || pedidoNovo) return;
    const t = setTimeout(simularPedido, 5000);
    return () => clearTimeout(t);
  }, [online, viagem, pedidoNovo, simularPedido]);

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
        if (!v) setPedidoNovo(null);
      },
      posicao,
      simular,
      setSimular,
      pedidoNovo,
      expiraEm,
      viagem,
      pendentes,
      agendadas,
      feitas,
      aceitarReserva: (id) => {
        const p = pendentes.find((x) => x.id === id);
        if (!p) return;
        publicar({ tipo: 'aceite', id, motorista: eu, posicao, agendada: true });
        setPendentes((l) => l.filter((x) => x.id !== id));
        setAgendadas((l) => [...l, p].sort(porData));
      },
      recusarReserva: (id) => {
        publicar({ tipo: 'recusado', id });
        setPendentes((l) => l.filter((x) => x.id !== id));
      },
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
        publicar({ tipo: 'estado', id, estado: 'a_caminho', motorista: eu });
        iniciarViagem(p);
      },
      cheguei: () => {
        if (!viagem) return;
        publicar({ tipo: 'estado', id: viagem.pedido.id, estado: 'chegou' });
        if (simular) setPosicao(viagem.pedido.origem);
        setViagem({ ...viagem, fase: 'chegou', rota: null });
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
        setGanhosHoje((g) => g + ganhoMotorista(viagem.pedido));
        setViagensHoje((n) => n + 1);
        setFeitas((l) => [{ pedido: viagem.pedido, concluidaEm: new Date().toISOString() }, ...l]);
        setViagem({ ...viagem, fase: 'concluida', rota: null });
      },
      cancelarViagem: () => {
        if (!viagem) return;
        publicar({ tipo: 'cancelado', id: viagem.pedido.id, por: 'motorista' });
        setViagem(null);
      },
      fecharResumo: () => setViagem(null),
      simularPedido,
    }),
    [viatura, eu, online, posicao, simular, pedidoNovo, expiraEm, viagem, pendentes, agendadas, feitas, ganhosHoje, viagensHoje, iniciarViagem, simularPedido, simularReserva],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

const porData = (x: PedidoMotorista, y: PedidoMotorista) => (x.recolhaEm ?? '').localeCompare(y.recolhaEm ?? '');

export function useModoMotorista(): ModoMotorista {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useModoMotorista tem de estar dentro de ModoMotoristaProvider');
  return ctx;
}
