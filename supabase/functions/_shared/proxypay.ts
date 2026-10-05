// ProxyPay (Angola): referências Multicaixa que o cliente paga no Multicaixa Express ou no ATM.
// Documentação: https://developer.proxypay.co.ao/v2/
import { db } from './supabase.ts';

// Segredos (Supabase → Edge Functions → Secrets): PROXYPAY_API_KEY, PROXYPAY_ENTIDADE e, para produção, PROXYPAY_SANDBOX=0.
// CAMBIO_AOA_POR_MZN converte os meticais da app em kwanzas (provisório: 14, o mesmo da app).

const SANDBOX = Deno.env.get('PROXYPAY_SANDBOX') !== '0';
const BASE = SANDBOX ? 'https://api.sandbox.proxypay.co.ao' : 'https://api.proxypay.co.ao';
const CHAVE = Deno.env.get('PROXYPAY_API_KEY') ?? '';
export const ENTIDADE = Deno.env.get('PROXYPAY_ENTIDADE') ?? '';
export const CAMBIO_AOA_POR_MZN = Number(Deno.env.get('CAMBIO_AOA_POR_MZN') ?? '14');

/** A referência fica válida 30 minutos: dá tempo de abrir o Multicaixa Express e pagar. */
export const VALIDADE_MIN = 30;

export const configurado = () => Boolean(CHAVE && ENTIDADE);

async function pedir(caminho: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { Authorization: `Token ${CHAVE}`, Accept: 'application/vnd.proxypay.v2+json', 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`ProxyPay ${init.method ?? 'GET'} ${caminho}: ${r.status} ${await r.text().catch(() => '')}`);
  return r;
}

/** Pede uma referência nova e associa-lhe o valor (em kwanzas), a validade e o nosso id. */
export async function criarReferencia(pagamentoId: string, valorKz: number, validade: Date): Promise<string> {
  const referencia = String(await (await pedir('/reference_ids', { method: 'POST' })).json());
  await pedir(`/references/${referencia}`, {
    method: 'PUT',
    body: JSON.stringify({ amount: valorKz.toFixed(2), end_datetime: validade.toISOString(), custom_fields: { pagamento_id: pagamentoId } }),
  });
  return referencia;
}

/** Invalida uma referência que expirou, para não ser paga por engano. */
export async function apagarReferencia(referencia: string): Promise<void> {
  await pedir(`/references/${referencia}`, { method: 'DELETE' }).catch((e) => console.error(e));
}

export type PagamentoProxyPay = { id: number; reference_id: string | number; amount: string; custom_fields?: Record<string, unknown>; datetime?: string };

/** Pagamentos que a ProxyPay confirmou e que ainda não confirmámos de volta (a rede de segurança do webhook). */
export async function pagamentosPorConfirmar(): Promise<PagamentoProxyPay[]> {
  return (await (await pedir('/payments')).json()) as PagamentoProxyPay[];
}

/** Confirma de volta: o pagamento sai da fila da ProxyPay. */
export async function confirmarRecebido(id: number): Promise<void> {
  await pedir(`/payments/${id}`, { method: 'DELETE' });
}

/** O webhook vem assinado com HMAC-SHA256 do corpo, com a chave da API, no cabeçalho X-Signature. */
export async function assinaturaValida(corpo: string, assinatura: string | null): Promise<boolean> {
  if (!assinatura || !CHAVE) return false;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(CHAVE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)));
  const esperado = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  const recebido = assinatura.trim().toLowerCase();
  if (recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}

/** Marca o pagamento como pago (uma só vez) e confirma-o de volta à ProxyPay. Usado também pelo estado-pagamento. */
export async function aplicarPagamento(p: PagamentoProxyPay, evento: unknown): Promise<boolean> {
  const referencia = String(p.reference_id);
  const nossoId = typeof p.custom_fields?.pagamento_id === 'string' ? p.custom_fields.pagamento_id : null;
  let { data: linha } = await db.from('pagamentos').select('id, estado, valor_local').eq('proxypay_referencia', referencia).maybeSingle();
  if (!linha && nossoId) ({ data: linha } = await db.from('pagamentos').select('id, estado, valor_local').eq('id', nossoId).maybeSingle());

  await db.from('pagamentos_eventos').insert({ pagamento_id: linha?.id ?? null, proxypay_pagamento_id: p.id, evento: 'proxypay.payment', dados: evento });
  if (!linha) return false;

  // Valor diferente do pedido: fica registado para revisão e não confirma a viagem.
  if (linha.valor_local != null && Math.abs(Number(p.amount) - Number(linha.valor_local)) > 0.5) {
    await db.from('pagamentos').update({ erro: `Valor pago ${p.amount} Kz diferente do pedido`, atualizado_em: new Date().toISOString() }).eq('id', linha.id);
  } else if (linha.estado !== 'pago') {
    await db
      .from('pagamentos')
      .update({ estado: 'pago', proxypay_pagamento_id: p.id, pago_em: p.datetime ?? new Date().toISOString(), atualizado_em: new Date().toISOString() })
      .eq('id', linha.id)
      .neq('estado', 'pago');
  }
  await confirmarRecebido(p.id).catch((e) => console.error(e));
  return true;
}

