import { formatarMzn } from '@/data/categorias';
import { t } from '@/i18n';

/** Códigos promocionais. No protótipo ficam aqui; no produto final vêm do Supabase e a gestão cria-os. */
export type Promo = {
  codigo: string;
  descricao: string;
  /** Percentagem de desconto (0 a 1) com um teto, ou um valor fixo em meticais. */
  percentagem?: number;
  maximoMzn?: number;
  valorMzn?: number;
};

export const PROMOS: Promo[] = [
  // A descrição traduz-se quando é lida (getter), não quando o módulo carrega.
  {
    codigo: 'BEMVINDO',
    get descricao() {
      return t('20% na primeira viagem, até {valor}', { valor: formatarMzn(500) });
    },
    percentagem: 0.2,
    maximoMzn: 500,
  },
  {
    codigo: 'CHAUFFEUR10',
    get descricao() {
      return t('10% em qualquer viagem, até {valor}', { valor: formatarMzn(300) });
    },
    percentagem: 0.1,
    maximoMzn: 300,
  },
];

/** Quem entra com o código de convite de um amigo tem este desconto na primeira viagem. */
export const DESCONTO_CONVIDADO: Promo = {
  codigo: '',
  get descricao() {
    return t('200 MT na primeira viagem, oferta de um amigo');
  },
  valorMzn: 200,
};
/** O que quem convidou ganha em crédito quando o amigo faz a primeira viagem. */
export const CREDITO_CONVITE_MZN = 200;

/** Códigos de convite têm o formato AMIGO-XXXX. */
export const eCodigoConvite = (codigo: string) => /^AMIGO-[A-Z0-9]{4}$/.test(codigo);

export function procurarPromo(texto: string): Promo | null {
  const codigo = texto.trim().toUpperCase();
  if (!codigo) return null;
  if (eCodigoConvite(codigo)) return { ...DESCONTO_CONVIDADO, codigo };
  return PROMOS.find((p) => p.codigo === codigo) ?? null;
}

/** Desconto em meticais sobre um preço, arredondado a 10 MT e nunca maior que o preço. */
export function descontoDe(promo: Promo | null, preco: number): number {
  if (!promo) return 0;
  const bruto = promo.valorMzn ?? Math.min(preco * (promo.percentagem ?? 0), promo.maximoMzn ?? Infinity);
  return Math.min(preco, Math.round(bruto / 10) * 10);
}
