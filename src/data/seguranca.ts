// Números de emergência de Moçambique. Confirmar antes do lançamento.
export const EMERGENCIA = [
  { nome: 'Polícia', numero: '119' },
  { nome: 'Ambulância', numero: '117' },
  { nome: 'Bombeiros', numero: '198' },
] as const;

/** Código de 4 dígitos que o cliente diz ao motorista, para ter a certeza de que entra no carro certo. */
export function gerarCodigoRecolha(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Ligação para abrir um ponto no mapa em qualquer telemóvel. */
export function ligacaoMapa(p: { latitude: number; longitude: number }): string {
  return `https://maps.google.com/?q=${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
}
