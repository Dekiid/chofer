import type { Ponto } from '@/components/mapa-tipos';

/**
 * Alerta de segurança durante a viagem, como o RideCheck da Uber:
 * o carro parado muito tempo fora do destino, ou longe do caminho previsto.
 */
export const PARAGEM_LONGA_MIN = 5;
/** Distância ao caminho a partir da qual se pergunta se está tudo bem. */
export const DESVIO_KM = 1;
/** Sem resposta neste tempo, avisam-se os contactos de confiança. */
export const SEGUNDOS_PARA_AVISAR = 60;

/** Distância em km (aproximada, plana) de um ponto ao segmento a–b. Chega para distâncias dentro de uma cidade. */
function distanciaAoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const kmLat = 111.32;
  const kmLng = 111.32 * Math.cos((p.latitude * Math.PI) / 180);
  const ax = (a.longitude - p.longitude) * kmLng;
  const ay = (a.latitude - p.latitude) * kmLat;
  const bx = (b.longitude - p.longitude) * kmLng;
  const by = (b.latitude - p.latitude) * kmLat;
  const dx = bx - ax;
  const dy = by - ay;
  const comprimento = dx * dx + dy * dy;
  const t = comprimento === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / comprimento));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Distância em km do carro ao caminho previsto. */
export function distanciaAoCaminho(p: Ponto, caminho: Ponto[]): number {
  if (caminho.length === 0) return 0;
  if (caminho.length === 1) return distanciaAoSegmento(p, caminho[0], caminho[0]);
  let menor = Infinity;
  for (let i = 1; i < caminho.length; i++) menor = Math.min(menor, distanciaAoSegmento(p, caminho[i - 1], caminho[i]));
  return menor;
}

export type MotivoAlerta = 'parado' | 'desvio';
