import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export const mzn = (n: number) => `${Math.round(n).toLocaleString('pt-PT').replace(/\s/g, ' ')} MT`;

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
