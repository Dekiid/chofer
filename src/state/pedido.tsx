import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Quando } from '@/data/agenda';
import { VIATURAS, type Viatura } from '@/data/categorias';
import { LOCALIZACAO_PADRAO, type Lugar } from '@/data/lugares';
import { aoMudarPais, paisAtual, type CodigoPais } from '@/data/paises';
import type { ReservaDias } from '@/data/reserva';
import { calcularRotaPor, rotaEstimadaPor, type Rota } from '@/data/rotas';
import type { Passageiro } from '@/data/extras-viagem';
import { useInscricoes } from '@/state/inscricoes';

export type Pagamento = 'mpesa' | 'emola' | 'multicaixa' | 'unitel' | 'empresa';

export const PAGAMENTOS: { id: Pagamento; nome: string; prefixos: string; pais?: CodigoPais }[] = [
  { id: 'mpesa', nome: 'M-Pesa', prefixos: '84 ou 85', pais: 'MZ' },
  { id: 'emola', nome: 'e-Mola', prefixos: '86 ou 87', pais: 'MZ' },
  // Angola: simulados até haver fornecedor de pagamentos angolano.
  { id: 'multicaixa', nome: 'Multicaixa Express', prefixos: '9', pais: 'AO' },
  { id: 'unitel', nome: 'Unitel Money', prefixos: '92 ou 93', pais: 'AO' },
  // Só aparece a quem tem conta de empresa: a viagem vai para a fatura do mês.
  { id: 'empresa', nome: 'Fatura da empresa', prefixos: '' },
];

/** Métodos de pagamento do país da conta. */
export const pagamentosDoPais = () => PAGAMENTOS.filter((p) => !p.pais || p.pais === paisAtual().codigo);

type Pedido = {
  /** Onde o carro vai buscar; por defeito a localização do telemóvel, mas pode ser outro sítio (pedir para outra pessoa). */
  origem: Lugar;
  /** Localização do telemóvel, para voltar a ela depois de escolher outro ponto de recolha. */
  localAtual: Lugar;
  destino: Lugar | null;
  /** Paragens pelo caminho, pela ordem (no máximo MAX_PARAGENS). */
  paragens: Lugar[];
  viatura: Viatura;
  /** Modelos de exemplo mais os carros de motoristas aprovados. */
  viaturas: Viatura[];
  pagamento: Pagamento;
  /** Aluguer ou casamento, pagos à diária; null nas viagens com motorista. */
  reserva: ReservaDias | null;
  setReserva: (r: ReservaDias | null) => void;
  /** Hora marcada ou imediato; null enquanto o cliente não escolhe. */
  quando: Quando | null;
  /** Rota da recolha ao destino: começa pela estimativa e passa à do Google quando chega. */
  rota: Rota | null;
  /** true enquanto se espera pela rota do Google; o preço ainda pode mudar. */
  rotaACarregar: boolean;
  setOrigem: (l: Lugar) => void;
  /** Guarda a localização do telemóvel e usa-a como recolha se ainda ninguém escolheu outra. */
  setLocalAtual: (l: Lugar) => void;
  setDestino: (l: Lugar | null) => void;
  /** Põe a paragem na posição i; i igual ao número de paragens acrescenta uma nova. */
  setParagem: (i: number, l: Lugar) => void;
  removerParagem: (i: number) => void;
  setViaturaId: (id: string) => void;
  setPagamento: (p: Pagamento) => void;
  setQuando: (q: Quando | null) => void;
  /** Pedido para outra pessoa; null quando é para quem pede. */
  passageiro: Passageiro | null;
  setPassageiro: (p: Passageiro | null) => void;
  /** Número do voo, nas recolhas no aeroporto. */
  voo: string | null;
  setVoo: (v: string | null) => void;
  limpar: () => void;
};

export const MAX_PARAGENS = 2;

const PedidoContext = createContext<Pedido | null>(null);

export function PedidoProvider({ children }: { children: ReactNode }) {
  const [origem, setOrigem] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const [localAtual, setLocalAtualEstado] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const setLocalAtual = useCallback((l: Lugar) => {
    setLocalAtualEstado(l);
    setOrigem((atual) => (atual.id === LOCALIZACAO_PADRAO.id ? l : atual));
  }, []);
  // Ao entrar com uma conta de outro país, o ponto de partida passa para a cidade desse país.
  useEffect(
    () =>
      // Fora da renderização: o país muda enquanto a sessão se desenha.
      aoMudarPais(() => setTimeout(() => {
        setLocalAtualEstado((l) => (l.id === LOCALIZACAO_PADRAO.id && l.zona !== 'Localização atual' ? { ...LOCALIZACAO_PADRAO } : l));
        setOrigem((l) => (l.id === LOCALIZACAO_PADRAO.id && l.zona !== 'Localização atual' ? { ...LOCALIZACAO_PADRAO } : l));
        setDestino(null);
        setParagens([]);
        setPagamento(pagamentosDoPais()[0].id);
      })),
    [],
  );
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [paragens, setParagens] = useState<Lugar[]>([]);
  const [viaturaId, setViaturaId] = useState(VIATURAS[0].id);
  const [pagamento, setPagamento] = useState<Pagamento>(() => pagamentosDoPais()[0].id);
  const [quando, setQuando] = useState<Quando | null>(null);
  const [passageiro, setPassageiro] = useState<Passageiro | null>(null);
  const [voo, setVoo] = useState<string | null>(null);
  const [reserva, setReserva] = useState<ReservaDias | null>(null);
  const { viaturasAprovadas } = useInscricoes();
  const [rotaGoogle, setRotaGoogle] = useState<{ chave: string; rota: Rota } | null>(null);
  const pontos = useMemo(() => (destino ? [origem, ...paragens, destino] : null), [origem, paragens, destino]);
  const chaveRota = pontos ? pontos.map((p) => `${p.latitude},${p.longitude}`).join('>') : null;

  // Pede a rota pelas estradas sempre que a recolha ou o destino mudam.
  useEffect(() => {
    if (!pontos || !chaveRota) return;
    let valido = true;
    calcularRotaPor(pontos).then((rota) => {
      if (valido) setRotaGoogle({ chave: chaveRota, rota });
    });
    return () => {
      valido = false;
    };
  }, [pontos, chaveRota]);

  const rotaPronta = rotaGoogle && rotaGoogle.chave === chaveRota ? rotaGoogle.rota : null;
  const rota = pontos ? (rotaPronta ?? rotaEstimadaPor(pontos)) : null;
  const rotaACarregar = destino != null && rotaPronta == null;

  const valor = useMemo(() => {
    const viaturas = [...VIATURAS, ...viaturasAprovadas];
    return {
      origem,
      localAtual,
      destino,
      paragens,
      viatura: viaturas.find((v) => v.id === viaturaId) ?? VIATURAS[0],
      viaturas,
      pagamento,
      quando,
      reserva,
      setReserva,
      rota,
      rotaACarregar,
      setOrigem: (l: Lugar) => {
        setOrigem(l);
        setQuando(null);
      },
      setLocalAtual,
      // Mudar o destino ou o carro muda a duração e a agenda, por isso a hora escolhida deixa de valer.
      setDestino: (l: Lugar | null) => {
        setDestino(l);
        setQuando(null);
      },
      setParagem: (i: number, l: Lugar) => {
        setParagens((atual) => (i >= atual.length ? [...atual, l].slice(0, MAX_PARAGENS) : atual.map((p, j) => (j === i ? l : p))));
        setQuando(null);
      },
      removerParagem: (i: number) => {
        setParagens((atual) => atual.filter((_, j) => j !== i));
        setQuando(null);
      },
      setViaturaId: (id: string) => {
        setViaturaId(id);
        setQuando(null);
      },
      setPagamento,
      setQuando,
      passageiro,
      setPassageiro,
      voo,
      setVoo,
      limpar: () => {
        setDestino(null);
        setPassageiro(null);
        setVoo(null);
        setParagens([]);
        setReserva(null);
        setQuando(null);
      },
    };
  }, [origem, localAtual, destino, paragens, viaturaId, pagamento, quando, passageiro, voo, reserva, rota, rotaACarregar, viaturasAprovadas, setLocalAtual]);

  return <PedidoContext.Provider value={valor}>{children}</PedidoContext.Provider>;
}

export function usePedido(): Pedido {
  const ctx = useContext(PedidoContext);
  if (!ctx) throw new Error('usePedido tem de estar dentro de PedidoProvider');
  return ctx;
}
