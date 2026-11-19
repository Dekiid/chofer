/**
 * Convidar motoristas: quem já conduz partilha o seu código; o convidado escreve-o na inscrição.
 * Valores PROVISÓRIOS, a confirmar pelo Flavio.
 */
export const PREMIO_CONVITE_MOTORISTA_MZN = 1000;
/** O prémio paga-se quando o convidado faz este número de viagens nos primeiros 30 dias. */
export const VIAGENS_PARA_PREMIO = 20;

/** Código de convite do motorista, tirado do número: MOT-4567. */
export const codigoConviteMotorista = (telefone: string) => `MOT-${telefone.replace(/\D/g, '').slice(-4).padStart(4, '0')}`;

export const CODIGO_MOTORISTA_VALIDO = /^MOT-\d{4}$/;
export const normalizarCodigoMotorista = (s: string) => s.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8);
