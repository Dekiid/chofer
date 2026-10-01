import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useGuardado } from '@/data/guardar';

export const TIPOS_AJUDA = [
  { id: 'objeto', nome: 'Esqueci-me de um objeto no carro' },
  { id: 'cobranca', nome: 'Fui cobrado a mais ou mal' },
  { id: 'motorista', nome: 'Queixa sobre o motorista ou o carro' },
  { id: 'seguranca', nome: 'Problema de segurança' },
  { id: 'outro', nome: 'Outro assunto' },
] as const;
export type TipoAjuda = (typeof TIPOS_AJUDA)[number]['id'];

export type PedidoAjuda = {
  id: string;
  tipo: TipoAjuda;
  texto: string;
  viagemId?: string;
  /** Resumo da viagem, para a equipa ver sem abrir a conta do cliente. */
  viagemResumo?: string;
  clienteNome: string;
  clienteTelefone: string;
  criadoEm: Date;
  estado: 'aberto' | 'resolvido';
  resposta?: string;
  reembolsoMzn?: number;
  respondidoEm?: Date;
};

type Suporte = {
  pedidos: PedidoAjuda[];
  criar: (p: Omit<PedidoAjuda, 'id' | 'criadoEm' | 'estado'>) => void;
  /** A equipa responde e, se quiser, devolve dinheiro. */
  responder: (id: string, resposta: string, reembolsoMzn?: number) => void;
};

const Contexto = createContext<Suporte | null>(null);

// Protótipo: os pedidos de ajuda ficam neste telemóvel, onde o cliente os cria e a equipa os vê na Gestão.
// No produto final vão para o Supabase e a resposta chega ao cliente por aviso.
export function SuporteProvider({ children }: { children: ReactNode }) {
  const [pedidos, setPedidos] = useGuardado<PedidoAjuda[]>('chauffeur.suporte', []);
  const valor = useMemo<Suporte>(
    () => ({
      pedidos,
      criar: (p) => setPedidos((l) => [{ ...p, id: `aj-${Date.now()}`, criadoEm: new Date(), estado: 'aberto' }, ...l]),
      responder: (id, resposta, reembolsoMzn) =>
        setPedidos((l) => l.map((p) => (p.id === id ? { ...p, estado: 'resolvido', resposta, reembolsoMzn, respondidoEm: new Date() } : p))),
    }),
    [pedidos, setPedidos],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSuporte(): Suporte {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSuporte tem de estar dentro de SuporteProvider');
  return ctx;
}
