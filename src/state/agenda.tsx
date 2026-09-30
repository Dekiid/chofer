import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { INTERVALO_MIN, reservasExemplo, somarMin, type Reserva } from '@/data/agenda';

export type Notificacao = {
  id: string;
  criadaEm: Date;
  titulo: string;
  texto: string;
  lida: boolean;
};

type Agenda = {
  reservas: Reserva[];
  notificacoes: Notificacao[];
  naoLidas: number;
  reservar: (r: Omit<Reserva, 'id'>) => void;
  /** O dono marca meia hora como indisponível, ou volta a libertá-la. */
  alternarBloqueio: (viaturaId: string, inicio: Date) => void;
  notificar: (titulo: string, texto: string) => void;
  marcarLidas: () => void;
};

const AgendaContext = createContext<Agenda | null>(null);

// Protótipo: a agenda e as notificações ficam em memória. No produto final vêm do Supabase,
// para que cliente, motorista e gestão vejam o mesmo calendário.
export function AgendaProvider({ children }: { children: ReactNode }) {
  const [reservas, setReservas] = useState<Reserva[]>(() => reservasExemplo(new Date()));
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  // Estável, para o ecrã de gestão a poder chamar ao sair.
  const marcarLidas = useCallback(
    () => setNotificacoes((atual) => (atual.some((n) => !n.lida) ? atual.map((n) => ({ ...n, lida: true })) : atual)),
    [],
  );

  const valor = useMemo<Agenda>(
    () => ({
      reservas,
      notificacoes,
      naoLidas: notificacoes.filter((n) => !n.lida).length,
      reservar: (r) => setReservas((atual) => [...atual, { ...r, id: `res-${Date.now()}` }]),
      alternarBloqueio: (viaturaId, inicio) =>
        setReservas((atual) => {
          const existente = atual.find((r) => r.tipo === 'bloqueio' && r.viaturaId === viaturaId && r.inicio.getTime() === inicio.getTime());
          if (existente) return atual.filter((r) => r !== existente);
          return [...atual, { id: `blq-${viaturaId}-${inicio.getTime()}`, viaturaId, inicio, fim: somarMin(inicio, INTERVALO_MIN), tipo: 'bloqueio' }];
        }),
      notificar: (titulo, texto) =>
        setNotificacoes((atual) => [{ id: `not-${Date.now()}`, criadaEm: new Date(), titulo, texto, lida: false }, ...atual]),
      marcarLidas,
    }),
    [reservas, notificacoes, marcarLidas],
  );

  return <AgendaContext.Provider value={valor}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): Agenda {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error('useAgenda tem de estar dentro de AgendaProvider');
  return ctx;
}
