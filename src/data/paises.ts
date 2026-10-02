import { t } from '@/i18n';

// Países onde a app funciona. O país vem do número da conta (+258 Moçambique, +244 Angola).
// Os valores guardados continuam em meticais; em Angola mostram-se em kwanzas com o câmbio abaixo.

export type CodigoPais = 'MZ' | 'AO';

export type Pais = {
  codigo: CodigoPais;
  nome: string;
  bandeira: string;
  indicativo: string;
  /** Número móvel sem o indicativo. */
  numero: RegExp;
  exemploNumero: string;
  /** Primeiros dígitos aceites, para a mensagem de erro. */
  prefixos: string;
  /** Formata os 9 dígitos como se escrevem no país. */
  formatar: (d: string) => string;
  simbolo: string;
  /** Quantas unidades da moeda local vale 1 metical. */
  porMetical: number;
  cidade: string;
  /** Onde a app funciona no país, para textos como "em Maputo e Matola". */
  zonaServico: string;
  exemploMorada: string;
  centro: { latitude: number; longitude: number };
  /** Só Moçambique tem cobranças reais (DebitoPay); em Angola o pagamento é simulado até haver fornecedor. */
  cobrancasReais: boolean;
  /** Carteiras móveis aceites; a primeira é a que recebe levantamentos e pagamentos aos motoristas. */
  carteiras: [string, string];
};

export const PAISES: Record<CodigoPais, Pais> = {
  MZ: {
    codigo: 'MZ',
    nome: 'Moçambique',
    bandeira: '🇲🇿',
    indicativo: '+258',
    numero: /^8[2-7]\d{7}$/,
    exemploNumero: '84 123 4567',
    prefixos: '82, 83, 84, 85, 86 ou 87',
    formatar: (d) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' '),
    simbolo: 'MT',
    porMetical: 1,
    cidade: 'Maputo',
    zonaServico: 'Maputo e Matola',
    exemploMorada: 'Av. Julius Nyerere 123, Maputo',
    centro: { latitude: -25.94, longitude: 32.52 },
    cobrancasReais: true,
    carteiras: ['M-Pesa', 'e-Mola'],
  },
  AO: {
    codigo: 'AO',
    nome: 'Angola',
    bandeira: '🇦🇴',
    indicativo: '+244',
    numero: /^9[1-9]\d{7}$/,
    exemploNumero: '923 456 789',
    prefixos: '91 a 99',
    formatar: (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' '),
    simbolo: 'Kz',
    // Câmbio provisório (outubro de 2026, cerca de 14 Kz por metical); mais tarde vem do servidor.
    porMetical: 14,
    cidade: 'Luanda',
    zonaServico: 'Luanda',
    exemploMorada: 'Rua Rainha Ginga 45, Luanda',
    centro: { latitude: -8.8383, longitude: 13.2344 },
    cobrancasReais: false,
    carteiras: ['Multicaixa Express', 'Unitel Money'],
  },
};

let atual: Pais = PAISES.MZ;
const ouvintes = new Set<() => void>();

export const paisAtual = () => atual;

export function definirPais(codigo: CodigoPais) {
  if (atual.codigo === codigo) return;
  atual = PAISES[codigo];
  ouvintes.forEach((f) => f());
}

export function aoMudarPais(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Separa "+244923456789" em país e dígitos locais; sem indicativo, usa o país pelo formato do número. */
export function lerTelefone(texto: string): { pais: Pais; digitos: string } {
  const todos = texto.replace(/\D/g, '');
  for (const p of Object.values(PAISES)) {
    const ind = p.indicativo.slice(1);
    if (todos.length > 9 && todos.startsWith(ind)) return { pais: p, digitos: todos.slice(ind.length) };
  }
  const pais = Object.values(PAISES).find((p) => p.numero.test(todos)) ?? atual;
  return { pais, digitos: todos };
}

/** "M-Pesa ou e-Mola" / "Multicaixa Express ou Unitel Money". */
export const metodosTexto = () => `${atual.carteiras[0]} ${t('ou')} ${atual.carteiras[1]}`;

/** A carteira móvel principal do país (para levantamentos e pagamentos aos motoristas). */
export const carteiraPrincipal = () => atual.carteiras[0];

export const paisDoTelefone = (tel: string) => lerTelefone(tel).pais;
