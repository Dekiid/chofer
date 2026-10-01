import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useGuardado } from '@/data/guardar';
import { enviarAjuda, lerRespostasAjuda } from '@/data/servidor-painel';
import { useConta } from '@/state/conta';
import { useSessao } from '@/state/sessao';
import { t } from '@/i18n';
import { formatarMzn } from '@/data/categorias';

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
  /** O reembolso já entrou na carteira do cliente. */
  creditado?: boolean;
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
  const telefone = useSessao().perfil?.telefone;
  const abertos = pedidos.some((p) => p.estado === 'aberto' && p.clienteTelefone === telefone);

  // Com o servidor ligado, a resposta dada no painel web chega a este telemóvel.
  useEffect(() => {
    if (!telefone || !abertos) return;
    const ler = () =>
      lerRespostasAjuda(telefone).then((lista) =>
        setPedidos((l) =>
          l.map((p) => {
            const r = lista.find((x) => x.id === p.id && x.estado === 'resolvido');
            return r && p.estado === 'aberto'
              ? { ...p, estado: 'resolvido', resposta: r.resposta ?? undefined, reembolsoMzn: r.reembolso_mzn ?? undefined, respondidoEm: r.respondido_em ? new Date(r.respondido_em) : new Date() }
              : p;
          }),
        ),
      );
    ler();
    const id = setInterval(ler, 60000);
    return () => clearInterval(id);
  }, [telefone, abertos, setPedidos]);

  // Reembolsos dados pela equipa entram na carteira do cliente (uma vez por pedido).
  const { movimentar, avisar } = useConta();
  const creditados = useRef(new Set<string>());
  useEffect(() => {
    const novos = pedidos.filter((p) => p.clienteTelefone === telefone && p.estado === 'resolvido' && (p.reembolsoMzn ?? 0) > 0 && !p.creditado && !creditados.current.has(p.id));
    if (novos.length === 0) return;
    for (const p of novos) {
      creditados.current.add(p.id);
      movimentar(p.reembolsoMzn!, 'reembolso', p.viagemResumo);
      avisar(t('Reembolso na carteira'), t('Devolvemos {valor} para a tua carteira.', { valor: formatarMzn(p.reembolsoMzn!) }));
    }
    setPedidos((l) => l.map((p) => (novos.some((n) => n.id === p.id) ? { ...p, creditado: true } : p)));
  }, [pedidos, telefone, movimentar, avisar, setPedidos]);
  const valor = useMemo<Suporte>(
    () => ({
      pedidos,
      criar: (p) => {
        const novo: PedidoAjuda = { ...p, id: `aj-${Date.now()}`, criadoEm: new Date(), estado: 'aberto' };
        setPedidos((l) => [novo, ...l]);
        enviarAjuda(novo, novo);
      },
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
