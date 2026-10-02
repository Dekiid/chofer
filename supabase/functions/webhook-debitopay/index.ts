// Recebe os eventos da DebitoPay (payment.completed, payment.failed, …).
// Configura este URL em DebitoPay → Settings → Webhooks.
import { assinaturaValida } from '../_shared/debitopay.ts';
import { db } from '../_shared/supabase.ts';

const ESTADOS: Record<string, 'pago' | 'falhou'> = { 'payment.completed': 'pago', 'payment.failed': 'falhou' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método não suportado', { status: 405 });

  // A assinatura é sobre o corpo exatamente como chegou, por isso lê-se em texto antes de interpretar.
  const corpo = await req.text();
  const assinatura =
    req.headers.get('x-webhook-signature') ?? req.headers.get('x-debitopay-signature') ?? req.headers.get('x-signature');
  if (!(await assinaturaValida(corpo, assinatura))) return new Response('Assinatura inválida', { status: 401 });

  const evento = JSON.parse(corpo);
  const dados = evento.data ?? {};
  const paymentId: string | undefined = dados.payment_id;

  let { data: p } = await db.from('pagamentos').select('id, estado').eq('debitopay_payment_id', paymentId ?? '').maybeSingle();
  // O webhook pode chegar antes de guardarmos o payment_id: nesse caso procura-se pelo nosso id (source_id).
  if (!p && dados.source_id) {
    ({ data: p } = await db.from('pagamentos').select('id, estado').eq('id', dados.source_id).maybeSingle());
  }

  await db.from('pagamentos_eventos').insert({ pagamento_id: p?.id ?? null, debitopay_payment_id: paymentId, evento: evento.event, dados: evento });

  const novo = ESTADOS[evento.event];
  if (p && novo && p.estado !== 'pago') {
    // Idempotente: a DebitoPay pode repetir o evento, e um pagamento já pago nunca volta atrás.
    await db
      .from('pagamentos')
      .update({
        estado: novo,
        debitopay_payment_id: paymentId,
        referencia: dados.reference ?? null,
        pago_em: novo === 'pago' ? (dados.paid_at ?? new Date().toISOString()) : null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', p.id)
      .neq('estado', 'pago');
    // Com o estado 'pago' a viagem fica confirmada e o motorista pode ser chamado.
  }

  // Responder 2xx depressa; caso contrário a DebitoPay volta a enviar.
  return new Response('ok');
});
