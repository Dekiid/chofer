import { t } from '@/i18n';

/**
 * Chauffeur Club: assinatura mensal com desconto em todas as viagens, como a Uber One.
 * Valores PROVISÓRIOS, a confirmar pelo Flavio (tal como quem paga o desconto: a plataforma ou o motorista).
 */
export const CLUB = {
  precoMensalMzn: 990,
  /** Desconto em cada viagem, aluguer ou casamento. */
  percentagem: 0.1,
  /** Teto do desconto por viagem. */
  maximoMzn: 300,
  diasPorMes: 30,
  /** Uma viagem grátis a cada tantas viagens feitas com o Club (Flavio, 2026-10-01). */
  viagensParaGratis: 10,
  /** A viagem grátis cobre até estes km; numa viagem mais longa, o cliente paga só o resto. */
  kmGratis: 5,
};

/** Assinatura paga até renovaEm. Cancelada: não renova, mas vale até ao fim do mês já pago. */
export type Assinatura = { desde: Date; renovaEm: Date; cancelada?: boolean };

export const assinaturaAtiva = (a: Assinatura | null, agora = new Date()) => a != null && a.renovaEm.getTime() > agora.getTime();

/** Desconto do Club sobre um preço, arredondado a 10 MT. */
export function descontoClub(preco: number): number {
  return Math.min(preco, Math.round(Math.min(preco * CLUB.percentagem, CLUB.maximoMzn) / 10) * 10);
}

/** Desconto da viagem grátis: a viagem toda até 5 km, ou a parte dos primeiros 5 km numa viagem mais longa. */
export function descontoGratis(preco: number, km: number): number {
  if (km <= CLUB.kmGratis) return preco;
  return Math.min(preco, Math.round((preco * CLUB.kmGratis) / km / 10) * 10);
}

type ViagemClub = { estado: string; tipo?: string; criadaEm: Date; gratisMzn?: number };

/** Viagens com motorista feitas desde que entrou no Club, quantas grátis já usou, e se tem uma por usar. */
export function estadoViagensGratis(viagens: ViagemClub[], a: Assinatura | null) {
  if (!a) return { feitas: 0, faltam: CLUB.viagensParaGratis, disponivel: false };
  const doClub = viagens.filter((v) => v.estado === 'concluida' && (v.tipo ?? 'viagem') === 'viagem' && v.criadaEm.getTime() >= a.desde.getTime());
  const usadas = doClub.filter((v) => (v.gratisMzn ?? 0) > 0).length;
  const pagas = doClub.length - usadas;
  const ganhas = Math.floor(pagas / CLUB.viagensParaGratis);
  return { feitas: pagas, faltam: CLUB.viagensParaGratis - (pagas % CLUB.viagensParaGratis), disponivel: ganhas > usadas };
}

export const vantagensClub = () => [
  t('{p}% de desconto em todas as viagens, até {max} por viagem', { p: Math.round(CLUB.percentagem * 100), max: `${CLUB.maximoMzn} MT` }),
  t('Uma viagem grátis a cada {n} viagens, até {km} km', { n: CLUB.viagensParaGratis, km: CLUB.kmGratis }),
  t('Também no aluguer e nos casamentos'),
  t('Apoio com prioridade na Ajuda'),
  t('Cancelas quando quiseres, sem multa'),
];
