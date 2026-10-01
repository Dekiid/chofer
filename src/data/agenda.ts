/** Acréscimo sobre o preço quando a viagem é pedida para já, sem agendamento. */
export const TAXA_IMEDIATO = 0.25;

import type { Ponto } from '@/components/mapa-tipos';

import type { PedidoMotorista } from './tempo-real';
import { distanciaKm, duracaoMin } from './viagem';
import { t } from '@/i18n';

/** Intervalo entre horários que o cliente pode escolher. */
export const INTERVALO_MIN = 30;
/** Folga entre duas reservas quando não se sabe onde acaba uma ou começa a outra (aluguer, bloqueio do dono). */
export const MARGEM_MIN = 30;
/** Além do tempo de condução até à recolha seguinte: para o motorista preparar o carro e chegar com folga. */
export const PREPARACAO_MIN = 10;
/** Antecedência mínima de um agendamento. */
export const ANTECEDENCIA_MIN = 60;
/** Dias à frente que se podem agendar. */
export const DIAS_AGENDAVEIS = 7;
/** Primeira e última hora de recolha. */
export const HORA_ABERTURA = 6;
export const HORA_FECHO = 22;

export type TipoReserva = 'agendada' | 'imediata' | 'bloqueio';

export type Reserva = {
  id: string;
  viaturaId: string;
  /** Hora da recolha. */
  inicio: Date;
  /** Hora a que a viagem acaba (sem a folga, que depende de onde é a reserva seguinte). */
  fim: Date;
  tipo: TipoReserva;
  /** Destino da viagem, para o motorista saber para onde vai. */
  destino?: string;
  /** Onde o carro tem de estar à hora de início (local de recolha). */
  pontoInicio?: Ponto;
  /** Onde o carro fica no fim (destino). */
  pontoFim?: Ponto;
  /** O pedido completo, para a app do motorista mostrar a reserva mesmo depois de fechada e aberta. */
  pedido?: PedidoMotorista;
};

/** Minutos de condução entre dois pontos. */
export type TempoConducao = (de: Ponto, para: Ponto) => number;

/** Estimativa em linha reta com o fator de estrada, enquanto o Mapbox não responde. */
export const conducaoEstimada: TempoConducao = (de, para) => duracaoMin(distanciaKm(de, para));

/** Uma viagem que se quer marcar: quando começa e acaba, e onde. */
export type Candidata = { inicio: Date; fim: Date; pontoInicio?: Ponto; pontoFim?: Ponto };

/** Quando o cliente quer a viagem: numa hora marcada ou já. */
export type Quando = { tipo: 'agendado'; inicio: Date } | { tipo: 'imediato' };

export function somarMin(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Folga entre o fim de uma reserva e o início da seguinte: o tempo de condução de onde uma acaba
 * até onde a outra começa, mais a preparação. Sem os dois pontos, fica a margem fixa.
 */
export function folgaMin(fimDe: Ponto | undefined, inicioDa: Ponto | undefined, conducao: TempoConducao = conducaoEstimada): number {
  if (!fimDe || !inicioDa) return MARGEM_MIN;
  return conducao(fimDe, inicioDa) + PREPARACAO_MIN;
}

/**
 * A reserva do carro que impede esta viagem, se houver. Exemplo: reserva às 11:00 que acaba às 12:30 na Matola;
 * uma viagem às 12:00 não cabe, e uma às 13:00 no Aeroporto só cabe se der para conduzir da Matola até lá.
 */
export function conflito(reservas: Reserva[], viaturaId: string, c: Candidata, conducao: TempoConducao = conducaoEstimada): Reserva | undefined {
  return reservas.find((r) => {
    if (r.viaturaId !== viaturaId) return false;
    // O bloqueio do dono é só o intervalo marcado; as viagens têm a folga para chegar à seguinte.
    const depoisDeR = r.tipo === 'bloqueio' ? 0 : folgaMin(r.pontoFim, c.pontoInicio, conducao);
    const antesDeR = folgaMin(c.pontoFim, r.pontoInicio, conducao);
    return c.inicio < somarMin(r.fim, depoisDeR) && r.inicio < somarMin(c.fim, antesDeR);
  });
}

/** Minutos desde a recolha (ou desde o pedido, se é para já) até ao fim da viagem. */
export function minutosOcupado(duracaoViagemMin: number, chegadaMin = 0): number {
  return chegadaMin + duracaoViagemMin;
}

/** A reserva que está mesmo nesse intervalo, sem folgas (para o calendário do dono). */
export function reservaNoIntervalo(reservas: Reserva[], viaturaId: string, inicio: Date, fim: Date): Reserva | undefined {
  return reservas.find((r) => r.viaturaId === viaturaId && inicio < r.fim && r.inicio < fim);
}

/** Sobreposição sem saber os locais (aluguer, calendário do dono): usa a margem fixa. */
export function reservaQueOcupa(reservas: Reserva[], viaturaId: string, inicio: Date, fim: Date): Reserva | undefined {
  return conflito(reservas, viaturaId, { inicio, fim });
}

/** Próximos dias em que se pode agendar, a começar hoje. */
export function diasAgendaveis(agora: Date): Date[] {
  const hoje = inicioDoDia(agora);
  return Array.from({ length: DIAS_AGENDAVEIS }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i));
}

/** Todos os horários de um dia, de meia em meia hora. */
export function horariosDoDia(dia: Date): Date[] {
  const lista: Date[] = [];
  for (let m = HORA_ABERTURA * 60; m <= HORA_FECHO * 60; m += INTERVALO_MIN) {
    lista.push(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, m));
  }
  return lista;
}

/** Horários de um dia para uma viagem com esta duração e estes locais, marcando os que já não estão livres. */
export function horariosParaAgendar(
  dia: Date,
  viaturaId: string,
  duracaoMin: number,
  reservas: Reserva[],
  agora: Date,
  locais: { pontoInicio?: Ponto; pontoFim?: Ponto } = {},
  conducao: TempoConducao = conducaoEstimada,
) {
  const limite = somarMin(agora, ANTECEDENCIA_MIN);
  return horariosDoDia(dia).map((inicio) => ({
    inicio,
    livre: inicio >= limite && !conflito(reservas, viaturaId, { inicio, fim: somarMin(inicio, duracaoMin), ...locais }, conducao),
  }));
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatarHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hoje", "Amanhã" ou "Sex 3 out". */
export function formatarDia(d: Date, agora: Date): string {
  if (mesmoDia(d, agora)) return t('Hoje');
  if (mesmoDia(d, somarMin(inicioDoDia(agora), 24 * 60))) return t('Amanhã');
  return `${t(DIAS_SEMANA[d.getDay()])} ${d.getDate()} ${t(MESES[d.getMonth()])}`;
}

/** Algumas viagens já marcadas nos carros de exemplo, para o calendário não aparecer vazio. */
export function reservasExemplo(agora: Date): Reserva[] {
  const dia = (n: number, h: number, m = 0) => {
    const d = inicioDoDia(agora);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h, m);
  };
  const r = (viaturaId: string, inicio: Date, horas: number, destino: string): Reserva => ({
    id: `ex-${viaturaId}-${inicio.getTime()}`,
    viaturaId,
    inicio,
    fim: somarMin(inicio, horas * 60),
    tipo: 'agendada',
    destino,
  });
  return [
    r('bmw-serie-5', dia(0, 18), 2, 'Aeroporto Internacional de Maputo'),
    r('bmw-serie-5', dia(1, 9), 1.5, 'Baixa de Maputo'),
    r('mercedes-classe-e', dia(0, 20), 2, 'Costa do Sol'),
    r('mercedes-classe-e', dia(1, 14), 3, 'Matola'),
    r('bmw-x5', dia(1, 7), 2, 'Aeroporto Internacional de Maputo'),
    r('range-rover-sport', dia(2, 10), 4, 'Ponta do Ouro'),
    r('mercedes-classe-s', dia(1, 19), 3, 'Polana'),
  ];
}
