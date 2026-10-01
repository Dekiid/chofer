import { t } from '@/i18n';
import type { Lugar } from '@/data/lugares';

/** Preferências da viagem, como na Uber Black. Ficam guardadas na conta e vão em cada pedido. */
export type Preferencias = {
  silencio: boolean;
  temperatura: 'fresco' | 'normal' | 'quente' | null;
  musica: 'sem' | 'baixa' | null;
  ajudaMalas: boolean;
};

export const PREFERENCIAS_PADRAO: Preferencias = { silencio: false, temperatura: null, musica: null, ajudaMalas: false };

/** Quem vai no carro quando o pedido é para outra pessoa. */
export type Passageiro = { nome: string; telefone: string };

export type ContactoConfianca = { nome: string; telefone: string };
/** Quando a viagem é partilhada sozinha com os contactos de confiança. */
export type PartilhaAuto = 'sempre' | 'noite' | 'nunca';

/** Noite: das 20h às 6h. */
export const eNoite = (d: Date) => d.getHours() >= 20 || d.getHours() < 6;

export const devePartilhar = (regra: PartilhaAuto, d: Date) => regra === 'sempre' || (regra === 'noite' && eNoite(d));

/** Recolha no aeroporto: pede-se o número do voo. */
export const eAeroporto = (l: Lugar) => l.id === 'aeroporto' || /aeroporto|airport/i.test(l.nome);

/** No aeroporto, o motorista espera este tempo grátis depois de o voo aterrar. */
export const ESPERA_AEROPORTO_MIN = 30;

/** Número de voo, por exemplo TM 101 ou ET 845. */
export const VOO_VALIDO = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/;
export const normalizarVoo = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 8);

/** Ligação para ver o voo ao vivo. */
export const ligacaoVoo = (voo: string) => `https://www.flightradar24.com/data/flights/${voo.replace(/\s/g, '').toLowerCase()}`;

/** As preferências em frases curtas, para o cliente e o motorista. */
export function textoPreferencias(p: Preferencias | undefined): string[] {
  if (!p) return [];
  const l: string[] = [];
  if (p.silencio) l.push(t('Viagem em silêncio'));
  if (p.temperatura === 'fresco') l.push(t('Ar condicionado fresco'));
  if (p.temperatura === 'normal') l.push(t('Temperatura normal'));
  if (p.temperatura === 'quente') l.push(t('Sem ar condicionado forte'));
  if (p.musica === 'sem') l.push(t('Sem música'));
  if (p.musica === 'baixa') l.push(t('Música baixa'));
  if (p.ajudaMalas) l.push(t('Ajuda com as malas'));
  return l;
}

/** Elogios que o motorista pode dar ao cliente. */
export const ELOGIOS_CLIENTE = ['Pontual', 'Educado', 'Respeitou o carro', 'Boa conversa'];
