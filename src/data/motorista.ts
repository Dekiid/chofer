export type Motorista = {
  nome: string;
  /** Número completo com indicativo, por exemplo +258841234567. */
  telefone: string;
  matricula: string;
};

// Motorista simulado para os modelos de exemplo; os carros inscritos trazem o seu próprio motorista.
export const MOTORISTA_EXEMPLO: Motorista = {
  nome: 'Carlos M.',
  telefone: '+258840000000',
  matricula: 'AFK 123 MC',
};

/** Aceita 84 123 4567, 841234567 ou +258 84 123 4567 e devolve +258841234567, ou null se não for um número móvel moçambicano. */
export function normalizarTelefone(texto: string): string | null {
  let d = texto.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('258')) d = d.slice(3);
  return /^8[2-7]\d{7}$/.test(d) ? `+258${d}` : null;
}

export function formatarTelefone(tel: string): string {
  const d = tel.replace(/^\+258/, '');
  return `+258 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}
