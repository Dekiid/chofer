import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { VIATURAS, type Viatura } from '@/data/categorias';
import { LOCALIZACAO_PADRAO, type Lugar } from '@/data/lugares';

export type Pagamento = 'mpesa' | 'emola';

export const PAGAMENTOS: { id: Pagamento; nome: string; prefixos: string }[] = [
  { id: 'mpesa', nome: 'M-Pesa', prefixos: '84 ou 85' },
  { id: 'emola', nome: 'e-Mola', prefixos: '86 ou 87' },
];

type Pedido = {
  origem: Lugar;
  destino: Lugar | null;
  viatura: Viatura;
  pagamento: Pagamento;
  setOrigem: (l: Lugar) => void;
  setDestino: (l: Lugar | null) => void;
  setViaturaId: (id: string) => void;
  setPagamento: (p: Pagamento) => void;
  limpar: () => void;
};

const PedidoContext = createContext<Pedido | null>(null);

export function PedidoProvider({ children }: { children: ReactNode }) {
  const [origem, setOrigem] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [viaturaId, setViaturaId] = useState(VIATURAS[0].id);
  const [pagamento, setPagamento] = useState<Pagamento>('mpesa');

  const valor = useMemo(
    () => ({
      origem,
      destino,
      viatura: VIATURAS.find((v) => v.id === viaturaId) ?? VIATURAS[0],
      pagamento,
      setOrigem,
      setDestino,
      setViaturaId,
      setPagamento,
      limpar: () => setDestino(null),
    }),
    [origem, destino, viaturaId, pagamento],
  );

  return <PedidoContext.Provider value={valor}>{children}</PedidoContext.Provider>;
}

export function usePedido(): Pedido {
  const ctx = useContext(PedidoContext);
  if (!ctx) throw new Error('usePedido tem de estar dentro de PedidoProvider');
  return ctx;
}
