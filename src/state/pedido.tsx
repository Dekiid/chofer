import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Quando } from '@/data/agenda';
import { VIATURAS, type Viatura } from '@/data/categorias';
import { LOCALIZACAO_PADRAO, type Lugar } from '@/data/lugares';
import { useInscricoes } from '@/state/inscricoes';

export type Pagamento = 'mpesa' | 'emola';

export const PAGAMENTOS: { id: Pagamento; nome: string; prefixos: string }[] = [
  { id: 'mpesa', nome: 'M-Pesa', prefixos: '84 ou 85' },
  { id: 'emola', nome: 'e-Mola', prefixos: '86 ou 87' },
];

type Pedido = {
  origem: Lugar;
  destino: Lugar | null;
  viatura: Viatura;
  /** Modelos de exemplo mais os carros de motoristas aprovados. */
  viaturas: Viatura[];
  pagamento: Pagamento;
  /** Hora marcada ou imediato; null enquanto o cliente não escolhe. */
  quando: Quando | null;
  setOrigem: (l: Lugar) => void;
  setDestino: (l: Lugar | null) => void;
  setViaturaId: (id: string) => void;
  setPagamento: (p: Pagamento) => void;
  setQuando: (q: Quando | null) => void;
  limpar: () => void;
};

const PedidoContext = createContext<Pedido | null>(null);

export function PedidoProvider({ children }: { children: ReactNode }) {
  const [origem, setOrigem] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [viaturaId, setViaturaId] = useState(VIATURAS[0].id);
  const [pagamento, setPagamento] = useState<Pagamento>('mpesa');
  const [quando, setQuando] = useState<Quando | null>(null);
  const { viaturasAprovadas } = useInscricoes();

  const valor = useMemo(() => {
    const viaturas = [...VIATURAS, ...viaturasAprovadas];
    return {
      origem,
      destino,
      viatura: viaturas.find((v) => v.id === viaturaId) ?? VIATURAS[0],
      viaturas,
      pagamento,
      quando,
      setOrigem,
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
  }, [origem, destino, viaturaId, pagamento, quando, viaturasAprovadas]);

  return <PedidoContext.Provider value={valor}>{children}</PedidoContext.Provider>;
}

export function usePedido(): Pedido {
  const ctx = useContext(PedidoContext);
  if (!ctx) throw new Error('usePedido tem de estar dentro de PedidoProvider');
  return ctx;
}
