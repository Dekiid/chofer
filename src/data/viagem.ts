import type { Viatura } from './categorias';

type Ponto = { latitude: number; longitude: number };

/** Distância em linha reta (km). Serve de estimativa até termos rotas reais. */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  // Fator 1,3 aproxima a distância por estrada.
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.3;
}

/** Duração estimada em minutos, a uma média urbana de 30 km/h. */
export function duracaoMin(km: number): number {
  return Math.max(3, Math.round((km / 30) * 60));
}

/** Preço final: quilómetros vezes o preço por km da viatura, arredondado a 10 MT. */
export function calcularPreco(viatura: Viatura, km: number): number {
  return Math.round((viatura.porKmMzn * km) / 10) * 10;
}

export function interpolar(a: Ponto, b: Ponto, t: number): Ponto {
  return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
}
