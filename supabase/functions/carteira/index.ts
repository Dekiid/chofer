// Carteira com dinheiro real: o saldo vive aqui, no servidor, e só a conta aberta por SMS lhe mexe.
//   { acao: 'saldo' }                                  → saldo e últimos movimentos
//   { acao: 'usar', valor_mzn, viagem_id }             → tira a parte da viagem paga com a carteira (até ao saldo)
//   { acao: 'levantar', valor_mzn }                    → envia para o M-Pesa / e-Mola do próprio número da conta
import { enviar, MINIMO_MZN, RecusaDebitoPay, type Metodo } from '../_shared/debitopay.ts';
import { CORS, db, json, quemChama } from '../_shared/supabase.ts';

/** Limites de segurança por levantamento e por dia, até haver verificação de identidade. */
const MAXIMO_LEVANTAMENTO_MZN = 20_000;
const MAXIMO_POR_DIA_MZN = 50_000;

const centimos = (n: number) => Math.round(n * 100) / 100;

async function saldo(userId: string): Promise<number> {
  const { data, error } = await db.rpc('carteira_saldo', { u: userId });
  if (error) throw error;
  return Number(data ?? 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado' }, 405);

  const conta = await quemChama(req);
  if (!conta) return json({ erro: 'Entra com o teu número (código por SMS) para usar a carteira.' }, 401);
  const corpo = await req.json().catch(() => null);

  try {
    if (corpo?.acao === 'saldo') {
      const { data: movimentos } = await db
        .from('carteira_movimentos')
        .select('id, valor_mzn, tipo, estado, criado_em')
        .eq('user_id', conta.id)
        .order('criado_em', { ascending: false })
        .limit(50);
      return json({ saldo_mzn: await saldo(conta.id), movimentos: movimentos ?? [] });
    }

    if (corpo?.acao === 'usar') {
      const valor = centimos(Number(corpo?.valor_mzn));
      const viagemId = String(corpo?.viagem_id ?? '');
      if (!(valor > 0) || !viagemId) return json({ erro: 'Pedido inválido.' }, 400);
      const { data, error } = await db.rpc('carteira_tirar', {
        u: conta.id,
        valor,
        tipo_mov: 'viagem',
        origem_mov: `viagem:${conta.id}:${viagemId}`,
        estado_mov: 'feito',
        tudo_ou_nada: false,
      });
      if (error) throw error;
      return json({ tirado_mzn: Number(data ?? 0), saldo_mzn: await saldo(conta.id) });
    }

    if (corpo?.acao === 'levantar') {
      // Só para o número da própria conta: quem roubar a sessão não manda o dinheiro para outro número.
      const telefone = conta.telefone;
      const metodo: Metodo | null = /^8[45]\d{7}$/.test(telefone) ? 'mpesa' : /^8[67]\d{7}$/.test(telefone) ? 'emola' : null;
      if (!metodo) return json({ erro: 'O número da tua conta não é M-Pesa nem e-Mola.' }, 400);
      const valor = centimos(Number(corpo?.valor_mzn));
      if (!(valor >= MINIMO_MZN[metodo])) return json({ erro: `O mínimo para levantar é ${MINIMO_MZN[metodo]} MT.` }, 400);
      if (valor > MAXIMO_LEVANTAMENTO_MZN) return json({ erro: `O máximo por levantamento é ${MAXIMO_LEVANTAMENTO_MZN} MT.` }, 400);

      const desde = new Date(Date.now() - 86_400_000).toISOString();
      const { data: hoje } = await db
        .from('carteira_movimentos')
        .select('valor_mzn')
        .eq('user_id', conta.id)
        .eq('tipo', 'levantamento')
        .neq('estado', 'falhou')
        .gte('criado_em', desde);
      const levantadoHoje = (hoje ?? []).reduce((t, m) => t - Number(m.valor_mzn), 0);
      if (levantadoHoje + valor > MAXIMO_POR_DIA_MZN) return json({ erro: `O máximo por dia é ${MAXIMO_POR_DIA_MZN} MT.` }, 400);

      // Primeiro tira da carteira (pendente), só depois envia: dois pedidos ao mesmo tempo não levantam o mesmo dinheiro.
      const origem = `levantamento:${crypto.randomUUID()}`;
      const { error } = await db.rpc('carteira_tirar', {
        u: conta.id,
        valor,
        tipo_mov: 'levantamento',
        origem_mov: origem,
        estado_mov: 'pendente',
        tudo_ou_nada: true,
        metodo_mov: metodo,
        telefone_mov: telefone,
      });
      if (error) {
        if (/saldo_insuficiente/.test(error.message)) return json({ erro: 'Não tens esse saldo na carteira.' }, 400);
        throw error;
      }

      const atualizar = (campos: Record<string, unknown>) =>
        db.from('carteira_movimentos').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('origem', origem);
      try {
        const r = await enviar({ referencia: origem.split(':')[1], metodo, telefone, valorMzn: valor });
        await atualizar({ estado: 'feito', referencia: r.referencia ?? null });
        return json({ estado: 'feito', valor_mzn: valor, telefone, metodo, saldo_mzn: await saldo(conta.id) });
      } catch (e) {
        console.error(e);
        if (e instanceof RecusaDebitoPay) {
          // Recusado pela DebitoPay: nada saiu, o dinheiro volta a contar na carteira.
          await atualizar({ estado: 'falhou', erro: e.message });
          return json({ erro: 'O levantamento não passou. O dinheiro continua na tua carteira.' }, 502);
        }
        // Sem resposta clara: fica pendente (não conta como saldo) até se confirmar no painel da DebitoPay.
        await atualizar({ erro: String((e as Error).message ?? e) });
        return json({ estado: 'pendente', erro: 'O levantamento está a ser confirmado. Se não chegar, fala com o apoio.' }, 202);
      }
    }

    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ erro: 'Algo correu mal na carteira. Tenta outra vez.' }, 500);
  }
});
