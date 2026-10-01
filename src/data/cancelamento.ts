import type { ViagemFeita } from '@/state/conta';
import { t } from '@/i18n';

// Regras de cancelamento, como na Uber. Valores provisórios, para testes: o Flavio decide os finais.
/** Reserva paga: grátis até estas horas antes da recolha. */
export const HORAS_CANCELAR_GRATIS = 24;
/** Reserva paga, cancelada mais tarde: fica esta parte do valor. */
export const PARTE_CANCELAMENTO_TARDIO = 0.5;
/** Pedido para agora: minutos grátis depois de o motorista aceitar. */
export const MINUTOS_CANCELAR_GRATIS = 2;
/** Pedido para agora cancelado depois disso, ou falta de comparência. */
export const TAXA_CANCELAMENTO_MZN = 100;
/** Quanto tempo o motorista espera na recolha antes de poder marcar falta de comparência. */
export const ESPERA_MIN = 10;

export type Cancelamento = {
  /** O que o cliente perde (reserva) ou paga (pedido para agora). */
  taxaMzn: number;
  /** O que volta ao cliente, nas viagens pagas antes. */
  reembolsoMzn: number;
  texto: string;
};

const pagoAntes = (v: ViagemFeita) => (v.porPagar ? 0 : v.precoMzn - v.descontoMzn);

/** Quanto custa cancelar agora. `motoristaAceitou` só conta nos pedidos para agora. */
export function custoCancelar(v: ViagemFeita, agora: Date, motoristaAceitou: boolean, aceiteEm?: number): Cancelamento {
  const pago = pagoAntes(v);
  if (v.porPagar) {
    const minutos = aceiteEm ? (agora.getTime() - aceiteEm) / 60000 : 0;
    if (!motoristaAceitou || minutos <= MINUTOS_CANCELAR_GRATIS)
      return { taxaMzn: 0, reembolsoMzn: 0, texto: t('Grátis: ainda estás nos {n} minutos depois de o motorista aceitar.', { n: MINUTOS_CANCELAR_GRATIS }) };
    return { taxaMzn: TAXA_CANCELAMENTO_MZN, reembolsoMzn: 0, texto: t('O motorista já vem a caminho há mais de {n} minutos. Pagas uma taxa de cancelamento.', { n: MINUTOS_CANCELAR_GRATIS }) };
  }
  const horas = (v.recolhaEm.getTime() - agora.getTime()) / 3_600_000;
  if (horas >= HORAS_CANCELAR_GRATIS) return { taxaMzn: 0, reembolsoMzn: pago, texto: t('Grátis até {n} horas antes da recolha. Recebes o valor todo de volta.', { n: HORAS_CANCELAR_GRATIS }) };
  const taxa = Math.round(pago * PARTE_CANCELAMENTO_TARDIO);
  return {
    taxaMzn: taxa,
    reembolsoMzn: pago - taxa,
    texto: t('Faltam menos de {n} horas para a recolha. Recebes de volta {percentagem}% do valor.', { n: HORAS_CANCELAR_GRATIS, percentagem: Math.round((1 - PARTE_CANCELAMENTO_TARDIO) * 100) }),
  };
}

/** Falta de comparência: o motorista esperou e o cliente não apareceu. */
export function custoFalta(v: ViagemFeita): Cancelamento {
  const pago = pagoAntes(v);
  if (v.porPagar) return { taxaMzn: TAXA_CANCELAMENTO_MZN, reembolsoMzn: 0, texto: t('Não apareceste na recolha. Pagas a taxa de falta de comparência.') };
  return { taxaMzn: pago, reembolsoMzn: 0, texto: t('Não apareceste na recolha. A reserva não é reembolsada.') };
}
