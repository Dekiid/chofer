import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Quando } from '@/data/agenda';
import { VIATURAS, type Viatura } from '@/data/categorias';
import { LOCALIZACAO_PADRAO, type Lugar } from '@/data/lugares';
import { calcularRota, rotaEstimada, type Rota } from '@/data/rotas';
import { useInscricoes } from '@/state/inscricoes';

export type Pagamento = 'mpesa' | 'emola';

export const PAGAMENTOS: { id: Pagamento; nome: string; prefixos: string }[] = [
  { id: 'mpesa', nome: 'M-Pesa', prefixos: '84 ou 85' },
  { id: 'emola', nome: 'e-Mola', prefixos: '86 ou 87' },
];

type Pedido = {
  /** Onde o carro vai buscar; por defeito a localização do telemóvel, mas pode ser outro sítio (pedir para outra pessoa). */
  origem: Lugar;
  /** Localização do telemóvel, para voltar a ela depois de escolher outro ponto de recolha. */
  localAtual: Lugar;
  destino: Lugar | null;
  viatura: Viatura;
  /** Modelos de exemplo mais os carros de motoristas aprovados. */
  viaturas: Viatura[];
  pagamento: Pagamento;
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
  setViaturaId: (id: string) => void;
  setPagamento: (p: Pagamento) => void;
  setQuando: (q: Quando | null) => void;
  limpar: () => void;
};

const PedidoContext = createContext<Pedido | null>(null);

export function PedidoProvider({ children }: { children: ReactNode }) {
  const [origem, setOrigem] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const [localAtual, setLocalAtualEstado] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const setLocalAtual = useCallback((l: Lugar) => {
    setLocalAtualEstado(l);
    setOrigem((atual) => (atual.id === LOCALIZACAO_PADRAO.id ? l : atual));
  }, []);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [viaturaId, setViaturaId] = useState(VIATURAS[0].id);
  const [pagamento, setPagamento] = useState<Pagamento>('mpesa');
  const [quando, setQuando] = useState<Quando | null>(null);
  const { viaturasAprovadas } = useInscricoes();
  const [rotaGoogle, setRotaGoogle] = useState<{ chave: string; rota: Rota } | null>(null);
  const chaveRota = destino ? `${origem.latitude},${origem.longitude}>${destino.latitude},${destino.longitude}` : null;

  // Pede a rota pelas estradas sempre que a recolha ou o destino mudam.
  useEffect(() => {
    if (!destino || !chaveRota) return;
    let valido = true;
    calcularRota(origem, destino).then((rota) => {
      if (valido) setRotaGoogle({ chave: chaveRota, rota });
    });
    return () => {
      valido = false;
    };
  }, [origem, destino, chaveRota]);

  const rotaPronta = rotaGoogle && rotaGoogle.chave === chaveRota ? rotaGoogle.rota : null;
  const rota = destino ? (rotaPronta ?? rotaEstimada(origem, destino)) : null;
  const rotaACarregar = destino != null && rotaPronta == null;

  const valor = useMemo(() => {
    const viaturas = [...VIATURAS, ...viaturasAprovadas];
    return {
      origem,
      localAtual,
      destino,
      viatura: viaturas.find((v) => v.id === viaturaId) ?? VIATURAS[0],
      viaturas,
      pagamento,
      quando,
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
      setViaturaId: (id: string) => {
        setViaturaId(id);
        setQuando(null);
      },
      setPagamento,
      setQuando,
      limpar: () => {
        setDestino(null);
        setQuando(null);
      },
    };
  }, [origem, localAtual, destino, viaturaId, pagamento, quando, rota, rotaACarregar, viaturasAprovadas, setLocalAtual]);

  return <PedidoContext.Provider value={valor}>{children}</PedidoContext.Provider>;
}

export function usePedido(): Pedido {
  const ctx = useContext(PedidoContext);
  if (!ctx) throw new Error('usePedido tem de estar dentro de PedidoProvider');
  return ctx;
}
