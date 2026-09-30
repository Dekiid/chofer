import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Ponto } from '@/components/mapa-tipos';

import { LUGARES, type Lugar } from './lugares';
import { distanciaKm } from './viagem';

// O mesmo token das rotas (.env.local). Sem ele usa-se o geocodificador do telemóvel.
const TOKEN_MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/** Dá nome a um ponto marcado no mapa: a rua e o bairro, ou o lugar conhecido mais perto. */
export async function lugarNoPonto(p: Ponto): Promise<Lugar> {
  const id = `pin-${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
  const nomeado = (await moradaMapbox(p)) ?? (await moradaTelemovel(p)) ?? lugarPerto(p);
  return { id, latitude: p.latitude, longitude: p.longitude, ...(nomeado ?? { nome: 'Ponto no mapa', zona: `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` }) };
}

type Nome = { nome: string; zona: string };

async function moradaMapbox(p: Ponto): Promise<Nome | null> {
  if (!TOKEN_MAPBOX) return null;
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${p.longitude}&latitude=${p.latitude}&language=pt&limit=1&access_token=${encodeURIComponent(TOKEN_MAPBOX)}`;
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { features?: { properties?: { name?: string; place_formatted?: string } }[] };
    const f = dados.features?.[0]?.properties;
    return f?.name ? { nome: f.name, zona: f.place_formatted ?? '' } : null;
  } catch {
    return null;
  }
}

async function moradaTelemovel(p: Ponto): Promise<Nome | null> {
  if (Platform.OS === 'web') return null;
  try {
    const [m] = await Location.reverseGeocodeAsync(p);
    if (!m) return null;
    const rua = m.street ? `${m.street}${m.streetNumber ? ` ${m.streetNumber}` : ''}` : m.name;
    if (!rua) return null;
    return { nome: rua, zona: [m.district, m.city].filter(Boolean).join(', ') };
  } catch {
    return null;
  }
}

// A menos de 200 m de um lugar da lista, usa o nome dele.
function lugarPerto(p: Ponto): Nome | null {
  const perto = LUGARES.map((l) => ({ l, km: distanciaKm(p, l) })).sort((a, b) => a.km - b.km)[0];
  return perto && perto.km < 0.2 ? { nome: perto.l.nome, zona: perto.l.zona } : null;
}
