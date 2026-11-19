import { lerTelefone } from './paises';
import { numeroCompleto } from './telefone';

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

/**
 * Aceita 84 123 4567, 841234567 ou +258 84 123 4567 (Moçambique) e 923 456 789 ou +244 923 456 789 (Angola)
 * e devolve o número com indicativo, ou null se não for um número móvel de um desses países.
 */
export function normalizarTelefone(texto: string): string | null {
  const { pais, digitos } = lerTelefone(texto);
  return pais.numero.test(digitos) ? `${pais.indicativo}${digitos}` : null;
}

export const formatarTelefone = numeroCompleto;
