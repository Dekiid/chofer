import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Ponto } from '@/components/mapa-tipos';
import { INTERVALO_MIN, PREPARACAO_MIN, reservasExemplo, somarMin, type Reserva, type TipoReserva } from '@/data/agenda';
import { supabase, type PedidoMotorista } from '@/data/tempo-real';
import { t } from '@/i18n';

export type Notificacao = {
  id: string;
  criadaEm: Date;
  titulo: string;
  texto: string;
  lida: boolean;
};

export type ResultadoReserva = { ok: true } | { ok: false; motivo: 'ocupado' | 'erro'; detalhe?: string };

/**
 * Onde está a agenda: só neste telemóvel (sem Supabase, ou sem a tabela criada), ou no servidor,
 * partilhada por todos os clientes e motoristas.
 */
export type EstadoAgenda = { onde: 'local' | 'a_carregar' | 'servidor'; aviso?: string };

type Agenda = {
  reservas: Reserva[];
  estado: EstadoAgenda;
  notificacoes: Notificacao[];
  naoLidas: number;
  /** Guarda a reserva. No servidor, é recusada se chocar com outra do mesmo carro. */
  reservar: (r: Omit<Reserva, 'id'> & { id?: string }) => Promise<ResultadoReserva>;
  /** Liberta o horário (viagem cancelada). */
  libertar: (id: string) => void;
  /** O dono marca meia hora como indisponível, ou volta a libertá-la. */
  alternarBloqueio: (viaturaId: string, inicio: Date) => void;
  notificar: (titulo: string, texto: string) => void;
  marcarLidas: () => void;
};

const AgendaContext = createContext<Agenda | null>(null);

// Tabela "reservas" no Supabase (criada com o ficheiro supabase/reservas.sql).
type Linha = {
  id: string;
  viatura_id: string;
  inicio: string;
  fim: string;
  livre_em: string;
  tipo: TipoReserva;
  destino: string | null;
  ponto_inicio: Ponto | null;
  ponto_fim: Ponto | null;
  pedido: PedidoMotorista | null;
};

const daLinha = (l: Linha): Reserva => ({
  id: l.id,
  viaturaId: l.viatura_id,
  inicio: new Date(l.inicio),
  fim: new Date(l.fim),
  tipo: l.tipo,
  destino: l.destino ?? undefined,
  pontoInicio: l.ponto_inicio ?? undefined,
  pontoFim: l.ponto_fim ?? undefined,
  pedido: l.pedido ?? undefined,
});

// O servidor só garante a folga mínima (a preparação); a folga com o tempo de condução é a app que a calcula.
const paraLinha = (r: Reserva): Linha => ({
  id: r.id,
  viatura_id: r.viaturaId,
  inicio: r.inicio.toISOString(),
  fim: r.fim.toISOString(),
  livre_em: somarMin(r.fim, r.tipo === 'bloqueio' ? 0 : PREPARACAO_MIN).toISOString(),
  tipo: r.tipo,
  destino: r.destino ?? null,
  ponto_inicio: r.pontoInicio ?? null,
  ponto_fim: r.pontoFim ?? null,
  pedido: r.pedido ?? null,
});

// Reservas que já acabaram há mais de um dia não interessam à agenda.
const JANELA_PASSADO_MIN = 24 * 60;

function semTabela(e: { code?: string; message?: string }): boolean {
  return e.code === 'PGRST205' || e.code === '42P01';
}

const juntar = (lista: Reserva[], r: Reserva) => (lista.some((x) => x.id === r.id) ? lista.map((x) => (x.id === r.id ? r : x)) : [...lista, r]);

// Com o Supabase ligado, a agenda vem da tabela "reservas" e atualiza-se sozinha quando outro cliente reserva.
// Sem ele (modo de demonstração), fica em memória, com reservas de exemplo.
export function AgendaProvider({ children }: { children: ReactNode }) {
  const [reservas, setReservas] = useState<Reserva[]>(() => (supabase() ? [] : reservasExemplo(new Date())));
  const [estado, setEstado] = useState<EstadoAgenda>(() => (supabase() ? { onde: 'a_carregar' } : { onde: 'local' }));
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    let ativo = true;
    const carregar = async () => {
      const desde = somarMin(new Date(), -JANELA_PASSADO_MIN).toISOString();
      const { data, error } = await sb.from('reservas').select('*').gte('livre_em', desde);
      if (!ativo) return;
      if (error) {
        console.warn('Agenda sem servidor', error);
        setEstado({
          onde: 'local',
          aviso: semTabela(error) ? t('falta criar a tabela de reservas no Supabase') : t('sem ligação ao servidor ({erro})', { erro: error.message }),
        });
        return;
      }
      setReservas((data as Linha[]).map(daLinha));
      setEstado({ onde: 'servidor' });
    };
    carregar();
    // Reservas feitas ou canceladas noutros telemóveis chegam aqui logo.
    const canal = sb
      .channel('chauffeur-reservas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, (m) => {
        if (m.eventType === 'DELETE') {
          const id = (m.old as Partial<Linha>).id;
          if (id) setReservas((l) => l.filter((r) => r.id !== id));
        } else {
          setReservas((l) => juntar(l, daLinha(m.new as Linha)));
        }
      })
      .subscribe((s) => {
        // Ao voltar a ligar, recarrega o que mudou entretanto.
        if (s === 'SUBSCRIBED') carregar();
      });
    return () => {
      ativo = false;
      sb.removeChannel(canal);
    };
  }, []);

  const noServidor = estado.onde === 'servidor';

  const reservar = useCallback(
    async (dados: Omit<Reserva, 'id'> & { id?: string }): Promise<ResultadoReserva> => {
      const r: Reserva = { ...dados, id: dados.id ?? `res-${Date.now()}` };
      const sb = supabase();
      if (sb && noServidor) {
        const { error } = await sb.from('reservas').insert(paraLinha(r));
        // 23P01: o servidor recusou porque o carro já tem outra reserva nesse intervalo.
        if (error) return error.code === '23P01' ? { ok: false, motivo: 'ocupado' } : { ok: false, motivo: 'erro', detalhe: error.message };
      }
      setReservas((l) => juntar(l, r));
      return { ok: true };
    },
    [noServidor],
  );

  const libertar = useCallback(
    (id: string) => {
      setReservas((l) => l.filter((r) => r.id !== id));
      const sb = supabase();
      if (sb && noServidor) {
        sb.from('reservas')
          .delete()
          .eq('id', id)
          .then(({ error }) => error && console.warn('Não foi possível libertar a reserva', error));
      }
    },
    [noServidor],
  );

  const alternarBloqueio = useCallback(
    (viaturaId: string, inicio: Date) => {
      const id = `blq-${viaturaId}-${inicio.getTime()}`;
      if (reservas.some((r) => r.id === id)) return libertar(id);
      reservar({ id, viaturaId, inicio, fim: somarMin(inicio, INTERVALO_MIN), tipo: 'bloqueio' });
    },
    [reservas, libertar, reservar],
  );

  // Estável, para o ecrã de gestão a poder chamar ao sair.
  const marcarLidas = useCallback(
    () => setNotificacoes((atual) => (atual.some((n) => !n.lida) ? atual.map((n) => ({ ...n, lida: true })) : atual)),
    [],
  );

  const valor = useMemo<Agenda>(
    () => ({
      reservas,
      estado,
      notificacoes,
      naoLidas: notificacoes.filter((n) => !n.lida).length,
      reservar,
      libertar,
      alternarBloqueio,
      notificar: (titulo, texto) =>
        setNotificacoes((atual) => [{ id: `not-${Date.now()}`, criadaEm: new Date(), titulo, texto, lida: false }, ...atual]),
      marcarLidas,
    }),
    [reservas, estado, notificacoes, reservar, libertar, alternarBloqueio, marcarLidas],
  );

  return <AgendaContext.Provider value={valor}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): Agenda {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error('useAgenda tem de estar dentro de AgendaProvider');
  return ctx;
}
