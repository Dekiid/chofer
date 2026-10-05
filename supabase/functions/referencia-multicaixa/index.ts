// Angola: cria o pagamento e uma referência Multicaixa. O cliente paga-a no Multicaixa Express
// (Pagamentos → Pagamento por referência) ou no ATM; a app vai perguntando o estado em /estado-pagamento.
import { COMISSAO } from '../_shared/debitopay.ts';
import { CAMBIO_AOA_POR_MZN, configurado, criarReferencia, ENTIDADE, VALIDADE_MIN } from '../_shared/proxypay.ts';
import { CORS, db, json, quemChama } from '../_shared/supabase.ts';

const MAXIMO_MZN = 100_000;
const centimos = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado' }, 405);
  if (!configurado()) return json({ erro: 'Os pagamentos em Angola ainda não estão ligados.' }, 503);

  const corpo = await req.json().catch(() => null);
  const valor = Number(corpo?.valor_mzn);
  const viaturaId = String(corpo?.viatura_id ?? '');
  if (!Number.isFinite(valor) || valor <= 0 || valor > MAXIMO_MZN) return json({ erro: 'Valor inválido.' }, 400);
  if (!viaturaId) return json({ erro: 'Falta a viatura.' }, 400);

  const tipo = corpo?.tipo === 'carteira' || corpo?.tipo === 'club' ? corpo.tipo : 'viagem';
  const conta = await quemChama(req);
  if (tipo === 'carteira' && !conta) return json({ erro: 'Entra com o teu número (código por SMS) para carregar a carteira.' }, 401);
  const comissao = tipo === 'viagem' ? centimos(valor * COMISSAO) : valor;
  const valorKz = Math.round(valor * CAMBIO_AOA_POR_MZN);

  const { data: pagamento, error } = await db
    .from('pagamentos')
    .insert({
      metodo: 'multicaixa',
      telefone: String(corpo?.telefone ?? '').replace(/\D/g, ''),
      valor_mzn: valor,
      comissao_mzn: comissao,
      motorista_mzn: centimos(valor - comissao),
      viatura_id: viaturaId,
      viagem: { ...(corpo?.viagem ?? {}), tipo },
      user_id: conta?.id ?? null,
      pais: 'AO',
      moeda: 'AOA',
      valor_local: valorKz,
    })
    .select('id')
    .single();
  if (error || !pagamento) {
    console.error(error);
    return json({ erro: 'Não foi possível registar o pagamento.' }, 500);
  }

  const validade = new Date(Date.now() + VALIDADE_MIN * 60_000);
  try {
    const referencia = await criarReferencia(pagamento.id, valorKz, validade);
    await db.from('pagamentos').update({ proxypay_referencia: referencia, referencia, atualizado_em: new Date().toISOString() }).eq('id', pagamento.id);
    return json({ id: pagamento.id, entidade: ENTIDADE, referencia, valor_kz: valorKz, validade: validade.toISOString() });
  } catch (e) {
    console.error(e);
    await db.from('pagamentos').update({ estado: 'falhou', erro: String((e as Error).message ?? e), atualizado_em: new Date().toISOString() }).eq('id', pagamento.id);
    return json({ erro: 'Não foi possível criar a referência. Tenta outra vez.' }, 502);
  }
});
