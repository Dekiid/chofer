import type { Ponto } from '@/components/mapa-tipos';

import { distanciaKm, duracaoMin } from './viagem';

export type Rota = {
  km: number;
  minutos: number;
  /** Caminho pelas estradas, para desenhar no mapa e mover o carro. */
  pontos: Ponto[];
  /** De onde veio: Mapbox, Google, ou a estimativa em linha reta com o fator de estrada. */
  fonte: 'mapbox' | 'google' | 'estimativa';
};

// Token público do Mapbox (começa por pk.), com a Directions API. Vem do ficheiro .env.local (não vai para o GitHub):
// EXPO_PUBLIC_MAPBOX_TOKEN=pk...
const TOKEN_MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
// Alternativa, se um dia se voltar ao Google: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY com a Routes API.
const CHAVE_GOOGLE = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export function rotaEstimada(a: Ponto, b: Ponto): Rota {
  const km = distanciaKm(a, b);
  return { km, minutos: duracaoMin(km), pontos: [a, b], fonte: 'estimativa' };
}

/** Junta os troços (recolha → paragens → destino) numa só rota: soma km e minutos, cola os caminhos. */
export function juntarTrocos(trocos: Rota[]): Rota {
  return {
    km: trocos.reduce((s, r) => s + r.km, 0),
    minutos: trocos.reduce((s, r) => s + r.minutos, 0),
    pontos: trocos.flatMap((r, i) => (i === 0 ? r.pontos : r.pontos.slice(1))),
    fonte: trocos.every((r) => r.fonte === trocos[0].fonte) ? trocos[0].fonte : 'estimativa',
  };
}

/** Estimativa com paragens: cada troço em linha reta com o fator de estrada. */
export function rotaEstimadaPor(pontos: Ponto[]): Rota {
  return juntarTrocos(pontos.slice(1).map((p, i) => rotaEstimada(pontos[i], p)));
}

/** Rota pelas estradas a passar por todas as paragens, pela ordem. */
export async function calcularRotaPor(pontos: Ponto[]): Promise<Rota> {
  const trocos = await Promise.all(pontos.slice(1).map((p, i) => calcularRota(pontos[i], p)));
  return juntarTrocos(trocos);
}

const cache = new Map<string, Rota>();

/**
 * Rota pelas estradas, com o trânsito atual. Usa o Mapbox se houver token, senão o Google se houver chave;
 * sem nenhum dos dois, ou sem rede, fica a estimativa.
 */
export async function calcularRota(a: Ponto, b: Ponto): Promise<Rota> {
  if (!TOKEN_MAPBOX && !CHAVE_GOOGLE) return rotaEstimada(a, b);
  const id = [a.latitude, a.longitude, b.latitude, b.longitude].map((n) => n.toFixed(5)).join(',');
  const guardada = cache.get(id);
  if (guardada) return guardada;
  try {
    const rota = TOKEN_MAPBOX ? await rotaMapbox(a, b, TOKEN_MAPBOX) : await rotaGoogle(a, b, CHAVE_GOOGLE!);
    cache.set(id, rota);
    return rota;
  } catch (e) {
    console.warn('Não foi possível obter a rota; fica a estimativa.', e);
    return rotaEstimada(a, b);
  }
}

// Directions API do Mapbox, perfil com trânsito. As coordenadas vão como longitude,latitude.
async function rotaMapbox(a: Ponto, b: Ponto, token: string): Promise<Rota> {
  const coords = `${a.longitude},${a.latitude};${b.longitude},${b.latitude}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?geometries=polyline&overview=full&language=pt&access_token=${encodeURIComponent(token)}`;
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Mapbox ${resposta.status}`);
  const dados = (await resposta.json()) as { code: string; routes?: { distance: number; duration: number; geometry: string }[] };
  const r = dados.routes?.[0];
  if (dados.code !== 'Ok' || !r) throw new Error(`Mapbox sem rota (${dados.code})`);
  return { km: r.distance / 1000, minutos: Math.max(1, Math.round(r.duration / 60)), pontos: descodificarPolyline(r.geometry), fonte: 'mapbox' };
}

// Routes API do Google (não está em uso; fica para comparação).
async function rotaGoogle(a: Ponto, b: Ponto, chave: string): Promise<Rota> {
  const resposta = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': chave,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: a.latitude, longitude: a.longitude } } },
      destination: { location: { latLng: { latitude: b.latitude, longitude: b.longitude } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      languageCode: 'pt-PT',
      units: 'METRIC',
    }),
  });
  if (!resposta.ok) throw new Error(`Routes API ${resposta.status}`);
  const dados = (await resposta.json()) as { routes?: { distanceMeters: number; duration: string; polyline: { encodedPolyline: string } }[] };
  const r = dados.routes?.[0];
  if (!r) throw new Error('Sem rota');
  return {
    km: r.distanceMeters / 1000,
    minutos: Math.max(1, Math.round(parseInt(r.duration, 10) / 60)),
    pontos: descodificarPolyline(r.polyline.encodedPolyline),
    fonte: 'google',
  };
}

/** Formato «encoded polyline» (Google e Mapbox com geometries=polyline): pares de lat/lng em diferenças, 5 casas decimais. */
export function descodificarPolyline(texto: string): Ponto[] {
  const pontos: Ponto[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const proximo = () => {
    let resultado = 0;
    let deslocamento = 0;
    let b: number;
    do {
      b = texto.charCodeAt(i++) - 63;
      resultado |= (b & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (b >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };
  while (i < texto.length) {
    lat += proximo();
    lng += proximo();
    pontos.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pontos;
}

/** Ponto a uma fração t (0 a 1) do comprimento da rota, para o carro seguir as estradas. */
export function pontoNaRota(pontos: Ponto[], t: number): Ponto {
  if (pontos.length === 1) return pontos[0];
  const troços = pontos.slice(1).map((p, i) => distanciaKm(pontos[i], p));
  const total = troços.reduce((s, d) => s + d, 0);
  let alvo = total * Math.min(1, Math.max(0, t));
  for (let i = 0; i < troços.length; i++) {
    if (alvo <= troços[i] || i === troços.length - 1) {
      const f = troços[i] === 0 ? 0 : Math.min(1, alvo / troços[i]);
      const a = pontos[i];
      const b = pontos[i + 1];
      return { latitude: a.latitude + (b.latitude - a.latitude) * f, longitude: a.longitude + (b.longitude - a.longitude) * f };
    }
    alvo -= troços[i];
  }
  return pontos[pontos.length - 1];
}

/** Resto da rota a partir da fração t, para a linha no mapa encolher à frente do carro. */
export function restoDaRota(pontos: Ponto[], t: number): Ponto[] {
  if (t <= 0) return pontos;
  const atual = pontoNaRota(pontos, t);
  const troços = pontos.slice(1).map((p, i) => distanciaKm(pontos[i], p));
  const total = troços.reduce((s, d) => s + d, 0);
  let percorrido = 0;
  let i = 0;
  while (i < troços.length && percorrido + troços[i] < total * t) percorrido += troços[i++];
  return [atual, ...pontos.slice(i + 1)];
}
