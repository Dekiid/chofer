import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CATEGORIAS_MOTORISTA } from '@/data/categorias';
import { LOCALIZACAO_PADRAO, type Lugar } from '@/data/lugares';

export type Pagamento = 'mpesa' | 'emola' | 'numerario';

export const PAGAMENTOS: { id: Pagamento; nome: string }[] = [
  { id: 'mpesa', nome: 'M-Pesa' },
  { id: 'emola', nome: 'e-Mola' },
  { id: 'numerario', nome: 'Numerário' },
];

type Pedido = {
  origem: Lugar;
  destino: Lugar | null;
  categoriaId: string;
  pagamento: Pagamento;
  setOrigem: (l: Lugar) => void;
  setDestino: (l: Lugar | null) => void;
  setCategoriaId: (id: string) => void;
  setPagamento: (p: Pagamento) => void;
  limpar: () => void;
};

const PedidoContext = createContext<Pedido | null>(null);

export function PedidoProvider({ children }: { children: ReactNode }) {
  const [origem, setOrigem] = useState<Lugar>(LOCALIZACAO_PADRAO);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [categoriaId, setCategoriaId] = useState(CATEGORIAS_MOTORISTA[0].id);
  const [pagamento, setPagamento] = useState<Pagamento>('mpesa');

  const valor = useMemo(
    () => ({
      origem,
      destino,
      categoriaId,
      pagamento,
      setOrigem,
      setDestino,
      setCategoriaId,
      setPagamento,
      limpar: () => {
        setDestino(null);
        setCategoriaId(CATEGORIAS_MOTORISTA[0].id);
      },
    }),
    [origem, destino, categoriaId, pagamento],
  );

  return <PedidoContext.Provider value={valor}>{children}</PedidoContext.Provider>;
}

export function usePedido(): Pedido {
  const ctx = useContext(PedidoContext);
  if (!ctx) throw new Error('usePedido tem de estar dentro de PedidoProvider');
  return ctx;
}
