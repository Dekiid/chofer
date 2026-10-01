import { Linking } from 'react-native';

/**
 * Número escondido: o cliente e o motorista ligam para um número da Chauffeur, e a chamada segue para o outro
 * sem nenhum ver o número verdadeiro. Precisa de um fornecedor de chamadas (a escolher) e deste número no .env.local.
 * Sem ele, em testes, a chamada vai direta para o número (que a app nunca mostra no ecrã).
 */
export const NUMERO_CHAMADAS = process.env.EXPO_PUBLIC_NUMERO_CHAMADAS ?? '';
export const CHAMADAS_PROTEGIDAS = NUMERO_CHAMADAS.length > 0;

/** Código da viagem que o fornecedor usa para saber a quem passar a chamada: 6 números tirados do id. */
export const codigoChamada = (viagemId: string) => (viagemId.replace(/\D/g, '').slice(-6) || '000000').padStart(6, '0');

/** Liga à outra pessoa da viagem. Com o número da Chauffeur, marca-o e envia o código da viagem depois de uma pausa. */
export function ligarProtegido(numero: string, viagemId: string) {
  const url = CHAMADAS_PROTEGIDAS ? `tel:${NUMERO_CHAMADAS},,${codigoChamada(viagemId)}#` : `tel:${numero}`;
  return Linking.openURL(url).catch(() => {});
}
