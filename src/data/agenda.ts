/** Acréscimo sobre o preço quando a viagem é pedida para já, sem agendamento. */
export const TAXA_IMEDIATO = 0.25;

/** Intervalo entre horários que o cliente pode escolher. */
export const INTERVALO_MIN = 30;
/** Tempo livre depois de cada viagem, para o motorista voltar e preparar o carro. */
export const MARGEM_MIN = 30;
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
  inicio: Date;
  fim: Date;
  tipo: TipoReserva;
  /** Destino da viagem, para o motorista saber para onde vai. */
  destino?: string;
};

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

function sobrepoe(inicio: Date, fim: Date, r: Reserva): boolean {
  return inicio < r.fim && r.inicio < fim;
}

/** Minutos que o carro fica ocupado com uma viagem: ida, viagem e margem. */
export function minutosOcupado(duracaoViagemMin: number, chegadaMin = 0): number {
  return chegadaMin + duracaoViagemMin + MARGEM_MIN;
}

export function reservaQueOcupa(reservas: Reserva[], viaturaId: string, inicio: Date, fim: Date): Reserva | undefined {
  return reservas.find((r) => r.viaturaId === viaturaId && sobrepoe(inicio, fim, r));
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

/** Horários de um dia para uma viagem com esta duração, marcando os que já não estão livres. */
export function horariosParaAgendar(dia: Date, viaturaId: string, ocupadoMin: number, reservas: Reserva[], agora: Date) {
  const limite = somarMin(agora, ANTECEDENCIA_MIN);
  return horariosDoDia(dia).map((inicio) => ({
    inicio,
    livre: inicio >= limite && !reservaQueOcupa(reservas, viaturaId, inicio, somarMin(inicio, ocupadoMin)),
  }));
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatarHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hoje", "Amanhã" ou "Sex 3 out". */
export function formatarDia(d: Date, agora: Date): string {
  if (mesmoDia(d, agora)) return 'Hoje';
  if (mesmoDia(d, somarMin(inicioDoDia(agora), 24 * 60))) return 'Amanhã';
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
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
