import { ANTECEDENCIA_MIN, conflito, inicioDoDia, PREPARACAO_MIN, reservaDeDias, reservaQueOcupa, somarMin, type Reserva } from './agenda';
import type { Viatura } from './categorias';
import { precoCasamento, type Decoracao } from './casamento';
import { t } from '@/i18n';

/** Aluguer sem motorista ou carro de casamento com motorista, pagos à diária. */
export type ReservaDias = {
  modo: 'aluguer' | 'casamento';
  decoracao: Decoracao;
  /** Dia e hora em que o carro é entregue (aluguer) ou vai buscar os noivos (casamento). */
  inicio: Date | null;
  dias: number;
};

/** Dias à frente que se podem reservar. */
export const DIAS_RESERVAVEIS = 30;
export const MAX_DIAS = 30;
/** Horas de entrega ou recolha, de hora a hora. */
export const HORAS_ENTREGA = Array.from({ length: 12 }, (_, i) => 7 + i);

export function diaria(v: Viatura, r: Pick<ReservaDias, 'modo' | 'decoracao'>): number {
  if (r.modo === 'casamento') return v.casamento ? precoCasamento(v.casamento, r.decoracao) : 0;
  return v.porDiaMzn ?? 0;
}

export const totalReserva = (v: Viatura, r: ReservaDias) => diaria(v, r) * r.dias;

/**
 * Aluguer e casamento, regra fixa para todos (Flavio, 2026-10-01): o carro é entregue às 10:00 do primeiro dia
 * e devolvido às 08:00 do dia seguinte ao último. As duas horas são para a lavagem antes do cliente seguinte.
 */
export const HORA_ENTREGA = 10;
export const HORA_DEVOLUCAO = 8;
export const inicioDias = (dia: Date, hora = HORA_ENTREGA) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora);
/** Até quando o carro tem de ser devolvido: às 08:00 do dia seguinte ao último dia pago. */
export const devolucaoReserva = (inicio: Date, dias: number) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + dias, HORA_DEVOLUCAO);
/**
 * Fim na agenda: a devolução menos a preparação. Assim o servidor, que junta a preparação ao fim,
 * deixa outro aluguer começar às 10:00 do dia da devolução.
 */
export const fimReserva = (inicio: Date, dias: number) => somarMin(devolucaoReserva(inicio, dias), -PREPARACAO_MIN);

/** O período está livre: entre alugueres basta não se sobreporem; as viagens mantêm a folga de condução. */
export function periodoLivre(reservas: Reserva[], viaturaId: string, inicio: Date, dias: number): boolean {
  const fim = fimReserva(inicio, dias);
  return !reservas.some(
    (r) =>
      r.viaturaId === viaturaId &&
      (reservaDeDias(r) ? inicio < somarMin(r.fim, PREPARACAO_MIN) && r.inicio < somarMin(fim, PREPARACAO_MIN) : conflito([r], viaturaId, { inicio, fim })),
  );
}

export function diasReservaveis(agora: Date): Date[] {
  const hoje = inicioDoDia(agora);
  return Array.from({ length: DIAS_RESERVAVEIS }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i));
}

/** Horas de um dia em que o carro está livre durante todos os dias pedidos. */
export function horasLivres(dia: Date, viaturaId: string, dias: number, reservas: Reserva[], agora: Date) {
  const limite = somarMin(agora, ANTECEDENCIA_MIN);
  return HORAS_ENTREGA.map((h) => {
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h);
    return { inicio, livre: inicio >= limite && !reservaQueOcupa(reservas, viaturaId, inicio, fimReserva(inicio, dias)) };
  });
}

/** Aluguer: o carro reserva-se por dias inteiros (Flavio, 2026-10-01), a partir de amanhã, sem escolher hora. */
export function diasAluguer(agora: Date): Date[] {
  return diasReservaveis(agora).slice(1);
}

/** O carro está livre em todos os dias inteiros pedidos, a começar neste. */
export const diasLivres = (dia: Date, viaturaId: string, dias: number, reservas: Reserva[], hora = HORA_ENTREGA) =>
  periodoLivre(reservas, viaturaId, inicioDias(dia, hora), dias);

/** O último dia de um aluguer (o dia antes de o período acabar à meia-noite). */
export const ultimoDia = (inicio: Date, dias: number) => somarMin(inicio, (dias - 1) * 24 * 60);

export const textoDias = (n: number) => (n === 1 ? t('{n} dia', { n }) : t('{n} dias', { n }));
