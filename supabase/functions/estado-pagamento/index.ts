// Estado de um pagamento, para a app saber quando pode chamar o motorista.
// Se o webhook tardar, pergunta diretamente à DebitoPay.
import { consultar } from '../_shared/debitopay.ts';
import { CORS, db, json } from '../_shared/supabase.ts';

// Sem resposta ao fim deste tempo, o pedido no telemóvel já expirou.
const EXPIRA_MIN = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const corpo = await req.json().catch(() => null);
  const id = String(corpo?.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ erro: 'Pagamento inválido.' }, 400);

  const { data: p } = await db.from('pagamentos').select('id, estado, erro, debitopay_payment_id, criado_em, atualizado_em').eq('id', id).single();
  if (!p) return json({ erro: 'Pagamento não encontrado.' }, 404);

  let { estado, erro } = p;
  const idadeSeg = (Date.now() - new Date(p.atualizado_em).getTime()) / 1000;
  if (estado === 'pendente' && p.debitopay_payment_id && idadeSeg > 10) {
    try {
      const r = await consultar(p.debitopay_payment_id);
      estado = r.estado;
      await db
        .from('pagamentos')
        .update({
          estado,
          referencia: r.referencia ?? undefined,
          pago_em: estado === 'pago' ? new Date().toISOString() : undefined,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('estado', 'pendente');
    } catch (e) {
      console.error(e);
    }
  }
  if (estado === 'pendente' && Date.now() - new Date(p.criado_em).getTime() > EXPIRA_MIN * 60_000) {
    estado = 'expirado';
    await db.from('pagamentos').update({ estado, atualizado_em: new Date().toISOString() }).eq('id', id).eq('estado', 'pendente');
  }

  // O erro técnico fica no servidor; a app mostra uma mensagem simples.
  if (estado === 'falhou') erro = 'O pagamento não foi aceite. Confirma o saldo e tenta outra vez.';
  return json({ estado, erro: estado === 'falhou' ? erro : null });
});
