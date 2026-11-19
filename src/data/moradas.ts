import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Ponto } from '@/components/mapa-tipos';

import { lugares, type Lugar } from './lugares';
import { paisAtual } from './paises';
import { distanciaKm } from './viagem';
import { t } from '@/i18n';

// O mesmo token das rotas (.env.local). Sem ele usa-se o geocodificador do telemóvel.
const TOKEN_MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/** Dá nome a um ponto marcado no mapa: a rua e o bairro, ou o lugar conhecido mais perto. */
export async function lugarNoPonto(p: Ponto): Promise<Lugar> {
  const id = `pin-${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
  const nomeado = (await moradaMapbox(p)) ?? (await moradaTelemovel(p)) ?? lugarPerto(p);
  return { id, latitude: p.latitude, longitude: p.longitude, ...(nomeado ?? { nome: t('Ponto no mapa'), zona: `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` }) };
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
  const perto = lugares().map((l) => ({ l, km: distanciaKm(p, l) })).sort((a, b) => a.km - b.km)[0];
  return perto && perto.km < 0.2 ? { nome: perto.l.nome, zona: perto.l.zona } : null;
}

/**
 * Procura moradas, ruas e estabelecimentos pelo nome, no país da conta e a começar pelos mais perto.
 * Usa o Mapbox (o mesmo token das rotas); sem token, no telemóvel usa o geocodificador do sistema.
 */
export async function pesquisarMoradas(texto: string, perto: Ponto): Promise<Lugar[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  if (TOKEN_MAPBOX) return moradasMapbox(q, perto);
  return moradasTelemovel(q);
}

async function moradasMapbox(q: string, perto: Ponto): Promise<Lugar[]> {
  try {
    const pais = paisAtual().codigo.toLowerCase();
    const url =
      `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=${pais}` +
      `&proximity=${perto.longitude},${perto.latitude}&language=pt&limit=8&access_token=${encodeURIComponent(TOKEN_MAPBOX!)}`;
    const resposta = await fetch(url);
    if (!resposta.ok) return [];
    const dados = (await resposta.json()) as {
      features?: { id?: string; properties?: { mapbox_id?: string; name?: string; place_formatted?: string; coordinates?: { latitude: number; longitude: number } } }[];
    };
    return (dados.features ?? []).flatMap((f) => {
      const p = f.properties;
      if (!p?.name || !p.coordinates) return [];
      return [{ id: `mb-${p.mapbox_id ?? f.id ?? `${p.coordinates.latitude},${p.coordinates.longitude}`}`, nome: p.name, zona: p.place_formatted ?? '', latitude: p.coordinates.latitude, longitude: p.coordinates.longitude }];
    });
  } catch {
    return [];
  }
}

async function moradasTelemovel(q: string): Promise<Lugar[]> {
  if (Platform.OS === 'web') return [];
  try {
    const [r] = await Location.geocodeAsync(`${q}, ${paisAtual().cidade}, ${paisAtual().nome}`);
    if (!r) return [];
    const nome = (await moradaTelemovel(r)) ?? { nome: q, zona: paisAtual().cidade };
    return [{ id: `geo-${r.latitude.toFixed(5)},${r.longitude.toFixed(5)}`, latitude: r.latitude, longitude: r.longitude, ...nome }];
  } catch {
    return [];
  }
}
