// Recebe da ProxyPay a confirmação de uma referência paga e marca o pagamento como pago.
// Configura este URL na ProxyPay (callback). Se o webhook falhar, /estado-pagamento apanha o pagamento pela fila.
import { aplicarPagamento, assinaturaValida, type PagamentoProxyPay } from '../_shared/proxypay.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método não suportado', { status: 405 });
  const corpo = await req.text();
  if (!(await assinaturaValida(corpo, req.headers.get('x-signature')))) return new Response('Assinatura inválida', { status: 401 });
  const p = JSON.parse(corpo) as PagamentoProxyPay;
  await aplicarPagamento(p, p);
  return new Response('ok');
});
