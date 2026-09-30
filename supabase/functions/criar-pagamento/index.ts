// Cria o pagamento de uma viagem e envia o pedido para o telemóvel do cliente.
// Devolve logo o id; a app vai perguntando o estado em /estado-pagamento enquanto o cliente põe o PIN.
import { cobrar, COMISSAO, MINIMO_MZN, type Metodo } from '../_shared/debitopay.ts';
import { CORS, db, json } from '../_shared/supabase.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const PREFIXOS: Record<Metodo, RegExp> = { mpesa: /^8[45]\d{7}$/, emola: /^8[67]\d{7}$/ };
// Limite de segurança até o preço ser calculado no servidor.
const MAXIMO_MZN = 100_000;

const centimos = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado' }, 405);

  const corpo = await req.json().catch(() => null);
  const metodo = corpo?.metodo as Metodo;
  const telefone = String(corpo?.telefone ?? '').replace(/\D/g, '').replace(/^258/, '');
  const valor = Number(corpo?.valor_mzn);
  const viaturaId = String(corpo?.viatura_id ?? '');

  if (metodo !== 'mpesa' && metodo !== 'emola') return json({ erro: 'Escolhe M-Pesa ou e-Mola.' }, 400);
  if (!PREFIXOS[metodo].test(telefone)) {
    return json({ erro: metodo === 'mpesa' ? 'O número M-Pesa começa por 84 ou 85.' : 'O número e-Mola começa por 86 ou 87.' }, 400);
  }
  if (!Number.isFinite(valor) || valor < MINIMO_MZN[metodo] || valor > MAXIMO_MZN) {
    return json({ erro: `O valor mínimo por ${metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola'} é ${MINIMO_MZN[metodo]} MT.` }, 400);
  }
  if (!viaturaId) return json({ erro: 'Falta a viatura.' }, 400);

  const comissao = centimos(valor * COMISSAO);
  const { data: pagamento, error } = await db
    .from('pagamentos')
    .insert({
      metodo,
      telefone,
      valor_mzn: valor,
      comissao_mzn: comissao,
      motorista_mzn: centimos(valor - comissao),
      viatura_id: viaturaId,
      viagem: corpo?.viagem ?? {},
    })
    .select('id')
    .single();
  if (error || !pagamento) {
    console.error(error);
    return json({ erro: 'Não foi possível registar o pagamento.' }, 500);
  }

  const envio = cobrar({
    id: pagamento.id,
    metodo,
    telefone,
    valorMzn: valor,
    cliente: { ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), userAgent: req.headers.get('user-agent') ?? undefined },
  })
    .then(async (r) =>
      // Só avança se ainda estiver pendente: o webhook pode ter chegado primeiro.
      db
        .from('pagamentos')
        .update({
          debitopay_payment_id: r.paymentId,
          referencia: r.referencia ?? null,
          estado: r.estado,
          pago_em: r.estado === 'pago' ? new Date().toISOString() : null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pagamento.id)
        .eq('estado', 'pendente'),
    )
    .catch((e) => {
      console.error(e);
      return db
        .from('pagamentos')
        .update({ estado: 'falhou', erro: String(e.message ?? e), atualizado_em: new Date().toISOString() })
        .eq('id', pagamento.id)
        .eq('estado', 'pendente');
    });

  // O M-Pesa só responde depois de o cliente pôr o PIN; não prendemos a app à espera.
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(envio);
  else await envio;

  return json({ id: pagamento.id, estado: 'pendente' });
});
