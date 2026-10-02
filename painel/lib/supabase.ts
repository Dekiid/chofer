import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { PAISES, paisPainel } from './paises';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cliente: SupabaseClient | null = null;

/** O mesmo projeto Supabase da app. Null quando falta o .env.local. */
export function supabase(): SupabaseClient | null {
  if (!url || !chave) return null;
  cliente ??= createClient(url, chave);
  return cliente;
}

/** Comissão da plataforma: 14%, descontados do valor do motorista. */
export const COMISSAO = 0.14;

/** Valor guardado em meticais, mostrado na moeda do país escolhido no painel (MT ou Kz). */
export const mzn = (n: number) => {
  const p = PAISES[paisPainel()];
  return `${Math.round(n * p.porMetical).toLocaleString('pt-PT').replace(/\s/g, ' ')} ${p.simbolo}`;
};

/** Converte um valor escrito na moeda do país escolhido para meticais (o que se guarda). */
export const paraMzn = (local: number) => Math.round(local / PAISES[paisPainel()].porMetical);
export const daMzn = (n: number) => Math.round(n * PAISES[paisPainel()].porMetical);

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
