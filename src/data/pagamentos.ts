import type { Pagamento } from '@/state/pedido';

// Endereço do projeto Supabase e a chave pública (anon). Vêm do ficheiro .env.local (não vai para o GitHub):
// EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
// A chave da DebitoPay nunca vem para a app: fica nos segredos das Edge Functions.
const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CHAVE_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Pagamentos reais só com o Supabase configurado E com EXPO_PUBLIC_PAGAMENTOS_REAIS=1 no .env.local,
 * para o Supabase poder estar ligado (tempo real, painel) antes de a DebitoPay estar pronta.
 * Sem isso, o pagamento é simulado (pré-visualização e testes).
 */
export const pagamentosReais = Boolean(URL_SUPABASE && CHAVE_SUPABASE) && process.env.EXPO_PUBLIC_PAGAMENTOS_REAIS === '1';

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
  /** Viagem (com a comissão de 14%), carregamento da carteira ou assinatura do Club (todo da plataforma). */
  tipo?: 'viagem' | 'carteira' | 'club';
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
    tipo: p.tipo ?? 'viagem',
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

/** M-Pesa para 84/85 e e-Mola para 86/87 (número com ou sem +258). */
export const metodoDoNumero = (telefone: string): 'mpesa' | 'emola' => (/^(?:\+?258)?8[67]/.test(telefone.replace(/\s/g, '')) ? 'emola' : 'mpesa');

/** Tempo máximo à espera do PIN do cliente; depois disso o pedido no telemóvel já expirou. */
const ESPERA_MAX_MS = 10 * 60_000;

/**
 * Cobra e espera pelo resultado: o cliente confirma com o PIN no telemóvel.
 * Devolve null quando ficou pago, ou a mensagem para mostrar quando falhou.
 */
export async function cobrarEsperar(p: NovoPagamento, continuar: () => boolean = () => true): Promise<string | null> {
  let id: string;
  try {
    id = await criarPagamento(p);
  } catch (e) {
    return e instanceof Error ? e.message : 'Sem ligação ao servidor. Tenta outra vez.';
  }
  const inicio = Date.now();
  while (Date.now() - inicio < ESPERA_MAX_MS && continuar()) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await estadoPagamento(id);
      if (r.estado === 'pago') return null;
      if (r.estado === 'falhou') return r.erro ?? 'O pagamento não foi aceite. Confirma o saldo e tenta outra vez.';
      if (r.estado === 'expirado') return 'O pedido de pagamento expirou. Tenta outra vez.';
    } catch {
      // Falha de rede momentânea: continua a perguntar.
    }
  }
  return 'O pedido de pagamento expirou. Tenta outra vez.';
}
