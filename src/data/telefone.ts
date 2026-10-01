// Números móveis de Moçambique: 82 e 83 (Tmcel), 84 e 85 (Vodacom), 86 e 87 (Movitel).
export const NUMERO_VALIDO = /^8[2-7]\d{7}$/;

/** "841234567" → "84 123 4567", como se escreve em Moçambique. Aceita também "+258841234567". */
export function formatarNumero(numero: string): string {
  const todos = numero.replace(/\D/g, '');
  const d = todos.length > 9 && todos.startsWith('258') ? todos.slice(3) : todos;
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}
