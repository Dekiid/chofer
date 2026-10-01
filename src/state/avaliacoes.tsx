import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useGuardado } from '@/data/guardar';
import { ouvir, publicar, TEMPO_REAL_ATIVO, type AvaliacaoCliente } from '@/data/tempo-real';

type Avaliacoes = {
  /** O motorista avalia o cliente no fim da viagem. */
  avaliarCliente: (telefone: string, a: AvaliacaoCliente) => void;
  /** Média das estrelas que os motoristas deram a este cliente; null se ainda não há. */
  mediaCliente: (telefone: string | undefined) => { media: number; n: number } | null;
  doCliente: (telefone: string | undefined) => AvaliacaoCliente[];
};

const Contexto = createContext<Avaliacoes | null>(null);

// Protótipo: as avaliações ficam neste telemóvel, por número de cliente. Com o servidor ligado,
// chegam também ao telemóvel do cliente. No produto final ficam numa tabela do Supabase.
export function AvaliacoesProvider({ children }: { children: ReactNode }) {
  const [porCliente, setPorCliente] = useGuardado<Record<string, AvaliacaoCliente[]>>('chauffeur.avaliacoes-clientes', {});

  const juntar = useCallback(
    (telefone: string, a: AvaliacaoCliente) =>
      setPorCliente((atual) => {
        const lista = atual[telefone] ?? [];
        if (lista.some((x) => x.em === a.em)) return atual;
        return { ...atual, [telefone]: [a, ...lista] };
      }),
    [setPorCliente],
  );

  // A avaliação feita no telemóvel do motorista chega ao do cliente.
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO) return;
    return ouvir((e) => {
      if (e.tipo === 'avaliacao_cliente') juntar(e.telefone, e.avaliacao);
    });
  }, [juntar]);

  const valor = useMemo<Avaliacoes>(
    () => ({
      avaliarCliente: (telefone, a) => {
        juntar(telefone, a);
        if (TEMPO_REAL_ATIVO) publicar({ tipo: 'avaliacao_cliente', telefone, avaliacao: a });
      },
      mediaCliente: (telefone) => {
        const lista = telefone ? (porCliente[telefone] ?? []) : [];
        if (lista.length === 0) return null;
        return { media: lista.reduce((t, a) => t + a.estrelas, 0) / lista.length, n: lista.length };
      },
      doCliente: (telefone) => (telefone ? (porCliente[telefone] ?? []) : []),
    }),
    [porCliente, juntar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAvaliacoes(): Avaliacoes {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAvaliacoes tem de estar dentro de AvaliacoesProvider');
  return ctx;
}
