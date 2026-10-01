import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useGuardado } from '@/data/guardar';
import { enviarAvaliacao } from '@/data/servidor-painel';
import { ouvir, publicar, TEMPO_REAL_ATIVO, type AvaliacaoCliente, type AvaliacaoMotorista } from '@/data/tempo-real';

type Avaliacoes = {
  /** O motorista avalia o cliente no fim da viagem. */
  avaliarCliente: (telefone: string, a: AvaliacaoCliente) => void;
  /** Média das estrelas que os motoristas deram a este cliente; null se ainda não há. */
  mediaCliente: (telefone: string | undefined) => { media: number; n: number } | null;
  doCliente: (telefone: string | undefined) => AvaliacaoCliente[];
  /** O cliente avalia o motorista no fim da viagem. */
  avaliarMotorista: (telefone: string, a: AvaliacaoMotorista) => void;
  /** Média das estrelas que os clientes deram a este motorista; null se ainda não há. */
  mediaMotorista: (telefone: string | undefined) => { media: number; n: number } | null;
  doMotorista: (telefone: string | undefined) => AvaliacaoMotorista[];
};

/** 4.85 → «4,9». */
export const formatarNota = (n: number) => n.toFixed(1).replace('.', ',');

function media(lista: { estrelas: number }[]) {
  if (lista.length === 0) return null;
  return { media: lista.reduce((t, a) => t + a.estrelas, 0) / lista.length, n: lista.length };
}

const Contexto = createContext<Avaliacoes | null>(null);

// Protótipo: as avaliações ficam neste telemóvel, por número de cliente e de motorista. Com o servidor ligado,
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
  const [porMotorista, setPorMotorista] = useGuardado<Record<string, AvaliacaoMotorista[]>>('chauffeur.avaliacoes-motoristas', {});
  const juntarMotorista = useCallback(
    (telefone: string, a: AvaliacaoMotorista) =>
      setPorMotorista((atual) => {
        const lista = atual[telefone] ?? [];
        if (lista.some((x) => x.viagemId === a.viagemId)) return atual;
        return { ...atual, [telefone]: [a, ...lista] };
      }),
    [setPorMotorista],
  );

  // A avaliação feita no telemóvel do motorista chega ao do cliente.
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO) return;
    return ouvir((e) => {
      if (e.tipo === 'avaliacao_cliente') juntar(e.telefone, e.avaliacao);
      if (e.tipo === 'avaliacao_motorista') juntarMotorista(e.telefone, e.avaliacao);
    });
  }, [juntar, juntarMotorista]);

  const valor = useMemo<Avaliacoes>(
    () => ({
      avaliarCliente: (telefone, a) => {
        juntar(telefone, a);
        if (TEMPO_REAL_ATIVO) publicar({ tipo: 'avaliacao_cliente', telefone, avaliacao: a });
        enviarAvaliacao({ id: `ac-${telefone}-${a.em}`, tipo: 'cliente', telefone, ...a });
      },
      mediaCliente: (telefone) => media(telefone ? (porCliente[telefone] ?? []) : []),
      doCliente: (telefone) => (telefone ? (porCliente[telefone] ?? []) : []),
      avaliarMotorista: (telefone, a) => {
        juntarMotorista(telefone, a);
        if (TEMPO_REAL_ATIVO) publicar({ tipo: 'avaliacao_motorista', telefone, avaliacao: a });
        enviarAvaliacao({ id: `am-${a.viagemId}`, tipo: 'motorista', telefone, ...a });
      },
      mediaMotorista: (telefone) => media(telefone ? (porMotorista[telefone] ?? []) : []),
      doMotorista: (telefone) => (telefone ? (porMotorista[telefone] ?? []) : []),
    }),
    [porCliente, porMotorista, juntar, juntarMotorista],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAvaliacoes(): Avaliacoes {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAvaliacoes tem de estar dentro de AvaliacoesProvider');
  return ctx;
}
