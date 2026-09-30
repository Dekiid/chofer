import type { Pagamento } from '@/state/pedido';

// Endereço do projeto Supabase e a chave pública (anon). Vêm do ficheiro .env.local (não vai para o GitHub):
// EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
// A chave da DebitoPay nunca vem para a app: fica nos segredos das Edge Functions.
const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CHAVE_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Sem Supabase configurado, o pagamento é simulado (pré-visualização e testes). */
export const pagamentosReais = Boolean(URL_SUPABASE && CHAVE_SUPABASE);

export type EstadoPagamento = 'pendente' | 'pago' | 'falhou' | 'expirado';

async function chamar<T>(funcao: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${URL_SUPABASE}/functions/v1/${funcao}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CHAVE_SUPABASE}`, apikey: CHAVE_SUPABASE!, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro ?? 'Sem ligação ao servidor. Tenta outra vez.');
  return dados as T;
}

export type NovoPagamento = {
  metodo: Pagamento;
  telefone: string;
  valorMzn: number;
  viaturaId: string;
  /** Resumo para o motorista: recolha, destino e hora. */
  viagem: Record<string, unknown>;
};

/** Envia o pedido de pagamento para o telemóvel do cliente; devolve o id para acompanhar o estado. */
export async function criarPagamento(p: NovoPagamento): Promise<string> {
  const r = await chamar<{ id: string }>('criar-pagamento', {
    metodo: p.metodo,
    telefone: p.telefone,
    valor_mzn: p.valorMzn,
    viatura_id: p.viaturaId,
    viagem: p.viagem,
  });
  return r.id;
}

export function estadoPagamento(id: string): Promise<{ estado: EstadoPagamento; erro: string | null }> {
  return chamar('estado-pagamento', { id });
}
