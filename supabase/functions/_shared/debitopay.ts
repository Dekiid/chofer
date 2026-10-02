// Cliente da API da DebitoPay (https://debitopay.com/developers/payments-api/), só para o servidor.
// A chave secreta vive nos segredos das Edge Functions do Supabase; nunca na app nem no GitHub.

export type Metodo = 'mpesa' | 'emola';
export type Estado = 'pendente' | 'pago' | 'falhou' | 'expirado';

const BASE = Deno.env.get('DEBITOPAY_BASE_URL') ?? 'https://gyqoaningqhurhvdugne.supabase.co/functions/v1';

/** Valores mínimos da DebitoPay por método (MZN). */
export const MINIMO_MZN: Record<Metodo, number> = { mpesa: 10, emola: 50 };

/** Parte da plataforma em cada viagem; o resto é do motorista. Igual a COMISSAO na app. */
export const COMISSAO = 0.14;

function segredo(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta o segredo ${nome} nas Edge Functions do Supabase.`);
  return v;
}

/** Cada método tem a sua carteira na DebitoPay, com o seu wallet_code de 5 dígitos. */
function carteira(metodo: Metodo): string {
  return segredo(metodo === 'mpesa' ? 'DEBITOPAY_WALLET_MPESA' : 'DEBITOPAY_WALLET_EMOLA');
}

/** A DebitoPay respondeu e recusou (sabe-se que nada foi feito), ao contrário de uma falha de rede, em que não se sabe. */
export class RecusaDebitoPay extends Error {}

async function chamar(caminho: string, corpo: unknown, extra: Record<string, string> = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${segredo('DEBITOPAY_API_KEY')}`, 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || dados.success === false) {
    const texto = `DebitoPay ${resposta.status}: ${dados.error ?? dados.message ?? 'erro desconhecido'}`;
    // 4xx ou success:false com resposta: recusado. 5xx: pode ter ficado a meio, não se sabe.
    throw resposta.status < 500 ? new RecusaDebitoPay(texto) : new Error(texto);
  }
  return dados;
}

/**
 * Envia dinheiro da carteira da plataforma para o M-Pesa ou e-Mola do cliente (B2C, «payout»).
 * A referência é a nossa (o id do levantamento), para a DebitoPay e a reconciliação.
 */
export async function enviar(e: { referencia: string; metodo: Metodo; telefone: string; valorMzn: number }): Promise<{ referencia?: string }> {
  const dados = await chamar(
    '/payment-orchestrator?action=payout',
    {
      payment_method: e.metodo,
      wallet_code: carteira(e.metodo),
      amount: e.valorMzn,
      phone: `258${e.telefone}`,
      reference: e.referencia,
    },
    { 'Idempotency-Key': e.referencia },
  );
  return { referencia: dados.providerReference ?? dados.transactionReference ?? dados.reference };
}

/** Converte o estado da DebitoPay para o nosso. */
export function estadoDe(status: string | undefined): Estado {
  switch (status) {
    case 'success':
    case 'completed':
      return 'pago';
    case 'failed':
      return 'falhou';
    case 'expired':
      return 'expirado';
    default:
      return 'pendente';
  }
}

export type Cobranca = {
  /** O nosso id do pagamento, enviado como source_id e chave de idempotência. */
  id: string;
  metodo: Metodo;
  /** 9 dígitos, ex. 841234567. */
  telefone: string;
  valorMzn: number;
  cliente?: { ip?: string; userAgent?: string };
};

/**
 * Envia o pedido de pagamento para o telemóvel do cliente (USSD push), que confirma com o PIN.
 * M-Pesa responde já com o resultado; e-Mola responde "pending" e confirma depois pelo webhook.
 */
export async function cobrar(c: Cobranca): Promise<{ paymentId: string; estado: Estado; referencia?: string }> {
  const extra: Record<string, string> = { 'Idempotency-Key': c.id };
  if (c.cliente?.ip) extra['X-Customer-IP'] = c.cliente.ip;
  if (c.cliente?.userAgent) extra['X-Customer-User-Agent'] = c.cliente.userAgent;
  const dados = await chamar(
    '/payment-orchestrator',
    {
      action: 'process',
      payment_method: c.metodo,
      merchant_id: segredo('DEBITOPAY_MERCHANT_ID'),
      wallet_code: carteira(c.metodo),
      amount: c.valorMzn,
      currency: 'MZN',
      // Formatos dos exemplos da DebitoPay: +258… no M-Pesa, 258… no e-Mola.
      phone: c.metodo === 'mpesa' ? `+258${c.telefone}` : `258${c.telefone}`,
      source: 'gateway',
      source_id: c.id,
    },
    extra,
  );
  return { paymentId: dados.payment_id, estado: estadoDe(dados.status), referencia: dados.reference ?? dados.transactionId };
}

/** Consulta o estado na DebitoPay; serve de recurso se o webhook se perder. */
export async function consultar(paymentId: string): Promise<{ estado: Estado; referencia?: string }> {
  const dados = await chamar('/payment-orchestrator', { action: 'check-status', payment_id: paymentId });
  return { estado: estadoDe(dados.payment?.status), referencia: dados.payment?.provider_reference };
}

/** Valida a assinatura HMAC-SHA256 (hex) do corpo do webhook com o segredo do webhook. */
export async function assinaturaValida(corpo: string, assinatura: string | null): Promise<boolean> {
  if (!assinatura) return false;
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo('DEBITOPAY_WEBHOOK_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)));
  const esperado = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  const recebido = assinatura.trim().toLowerCase().replace(/^sha256=/, '');
  if (recebido.length !== esperado.length) return false;
  // Comparação em tempo constante.
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}
