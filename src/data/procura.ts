import { lugares, type Lugar } from '@/data/lugares';
import { distanciaKm } from '@/data/viagem';
import type { Ponto } from '@/components/mapa-tipos';

/** Zona do mapa de procura: onde há mais pedidos agora. */
export type ZonaProcura = { lugar: Lugar; nivel: 1 | 2 | 3; raioM: number };

// Estimativa por hora e dia da semana, até haver viagens reais suficientes no servidor para a calcular.
// Peso de cada lugar ao longo do dia: [madrugada 0-6, manhã 6-10, dia 10-16, fim de tarde 16-20, noite 20-24].
const PADRAO: Record<string, [number, number, number, number, number]> = {
  aeroporto: [2, 3, 2, 3, 2],
  polana: [1, 2, 2, 3, 3],
  marginal: [1, 0, 1, 2, 3],
  'baia-mall': [0, 1, 2, 3, 2],
  julius: [1, 2, 2, 2, 3],
  fortaleza: [0, 3, 3, 2, 1],
  'matola-shopping': [0, 1, 2, 3, 1],
  'matola-rio': [0, 2, 1, 1, 0],
  machava: [0, 1, 1, 1, 0],
};

const faixa = (h: number) => (h < 6 ? 0 : h < 10 ? 1 : h < 16 ? 2 : h < 20 ? 3 : 4);

/**
 * Zonas com procura a esta hora. As recolhas das viagens que o motorista já fez (origens) pesam também.
 * Fim de semana: mais procura nos centros comerciais e na Marginal.
 */
export function zonasProcura(agora: Date, origensRecentes: Ponto[] = []): ZonaProcura[] {
  const f = faixa(agora.getHours());
  const fimDeSemana = agora.getDay() === 0 || agora.getDay() === 6;
  return lugares().map((lugar) => {
    let peso = PADRAO[lugar.id]?.[f] ?? 0;
    if (fimDeSemana && (lugar.id === 'baia-mall' || lugar.id === 'matola-shopping' || lugar.id === 'marginal')) peso += 1;
    if (fimDeSemana && lugar.id === 'fortaleza') peso -= 1;
    peso += Math.min(1, origensRecentes.filter((o) => distanciaKm(o, lugar) < 2).length / 3);
    const nivel = Math.max(0, Math.min(3, Math.round(peso)));
    return { lugar, nivel, raioM: 600 + nivel * 250 };
  })
    .filter((z): z is ZonaProcura => z.nivel > 0)
    .sort((a, b) => b.nivel - a.nivel);
}

export const nomeNivel = (n: 1 | 2 | 3) => (n === 3 ? 'Muita procura' : n === 2 ? 'Procura média' : 'Pouca procura');
