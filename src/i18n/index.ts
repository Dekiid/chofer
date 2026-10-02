import { en } from '@/i18n/en';

/** Línguas da app. O texto em português é a chave de tradução. */
export type Idioma = 'pt' | 'en';

let atual: Idioma = 'pt';

/** Muda a língua usada por t(). Quem chama tem de voltar a desenhar a app (ver IdiomaProvider). */
export function definirIdioma(i: Idioma) {
  atual = i;
}

export const idiomaAtual = () => atual;

/**
 * Traduz um texto escrito em português. Os valores variáveis vão entre chavetas:
 * t('Faltam {n} dias', { n: 3 }). Sem tradução, fica o português.
 */
export function t(pt: string, valores?: Record<string, string | number>): string {
  let texto = atual === 'en' ? (en[pt] ?? pt) : pt;
  if (__DEV__ && atual === 'en' && en[pt] === undefined) console.warn(`[i18n] falta tradução: ${pt}`);
  if (valores) for (const [k, v] of Object.entries(valores)) texto = texto.split(`{${k}}`).join(String(v));
  return texto;
}
