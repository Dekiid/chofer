import type { Ponto } from '@/components/mapa-tipos';

import type { Lugar } from './lugares';
import { supabase, TEMPO_REAL_ATIVO } from './tempo-real';

// Viagem partilhada por link: a página /seguir/<id> da versão web da app mostra o carro em direto.
// Precisa do Supabase (supabase/partilhas.sql) e do endereço onde a versão web está publicada, no .env.local:
// EXPO_PUBLIC_SITE_URL=https://chauffeur.expo.app
// Sem eles, a partilha manda só a localização no Google Maps, como antes.
const SITE = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');

export const PARTILHA_POR_LINK = Boolean(TEMPO_REAL_ATIVO && SITE);

export type EstadoPartilha = 'a_caminho' | 'chegou' | 'em_viagem' | 'concluida' | 'cancelada';

/** O que quem recebe o link vê. Sem números de telefone. */
export type DadosPartilha = {
  /** Id da viagem, para receber a posição do carro em direto. */
  viagemId: string;
  cliente: string;
  motorista: string;
  viatura: string;
  matricula: string;
  origem: Lugar;
  destino: Lugar;
  estado: EstadoPartilha;
  posicao: Ponto | null;
  /** Hora prevista de chegada ao destino, em ISO. */
  chegadaPrevista: string | null;
  atualizadaEm: string;
};

/**
 * Id aleatório e longo: quem não tem o link não consegue adivinhá-lo.
 * Usa o gerador seguro quando o telemóvel o tem; antes do lançamento, trocar pelo expo-crypto.
 */
export function novoIdPartilha(): string {
  const letras = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(20);
  const c = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => letras[b % letras.length]).join('');
}

export const ligacaoPartilha = (id: string) => `${SITE}/seguir/${id}`;

export async function guardarPartilha(id: string, dados: DadosPartilha): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.rpc('guardar_partilha', { p_id: id, p_dados: dados });
  return !error;
}

/** null quando o link não existe ou já expirou. */
export async function lerPartilha(id: string): Promise<DadosPartilha | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ver_partilha', { p_id: id });
  if (error || !data) return null;
  return data as DadosPartilha;
}
