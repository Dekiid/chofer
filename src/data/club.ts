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
};

/** Assinatura paga até renovaEm. Cancelada: não renova, mas vale até ao fim do mês já pago. */
export type Assinatura = { desde: Date; renovaEm: Date; cancelada?: boolean };

export const assinaturaAtiva = (a: Assinatura | null, agora = new Date()) => a != null && a.renovaEm.getTime() > agora.getTime();

/** Desconto do Club sobre um preço, arredondado a 10 MT. */
export function descontoClub(preco: number): number {
  return Math.min(preco, Math.round(Math.min(preco * CLUB.percentagem, CLUB.maximoMzn) / 10) * 10);
}

export const vantagensClub = () => [
  t('{p}% de desconto em todas as viagens, até {max} por viagem', { p: Math.round(CLUB.percentagem * 100), max: `${CLUB.maximoMzn} MT` }),
  t('Também no aluguer e nos casamentos'),
  t('Apoio com prioridade na Ajuda'),
  t('Cancelas quando quiseres, sem multa'),
];
