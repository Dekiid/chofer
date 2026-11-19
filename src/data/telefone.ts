import { lerTelefone, paisAtual } from './paises';

// Números móveis de Moçambique: 82 e 83 (Tmcel), 84 e 85 (Vodacom), 86 e 87 (Movitel).
export const NUMERO_VALIDO = /^8[2-7]\d{7}$/;

/** "841234567" → "84 123 4567" e "923456789" → "923 456 789", como se escreve em cada país. Aceita também "+258841234567" e "+244923456789". */
export function formatarNumero(numero: string): string {
  const { pais, digitos } = lerTelefone(numero);
  return (numero.trim().startsWith('+') || digitos.length === 9 ? pais : paisAtual()).formatar(digitos);
}

/** "+244923456789" → "+244 923 456 789". */
export function numeroCompleto(tel: string): string {
  const { pais, digitos } = lerTelefone(tel);
  return `${pais.indicativo} ${pais.formatar(digitos)}`;
}
