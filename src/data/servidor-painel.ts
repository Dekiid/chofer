import { supabase } from './tempo-real';

// Envio para o painel de gestão na web (supabase/painel.sql). Sem Supabase, não faz nada.
// Os envios não bloqueiam a app: se falharem (sem rede, ou o SQL ainda não foi corrido), a app continua igual.

async function chamar(funcao: string, args: Record<string, unknown>) {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc(funcao, args);
  return error ? null : data;
}

async function inserir(tabela: string, linha: Record<string, unknown>) {
  const sb = supabase();
  if (!sb) return;
  await sb.from(tabela).insert(linha);
}

export function enviarViagem(v: { id: string; estado: string; viatura: string; totalMzn: number }, clienteTelefone: string | undefined, dados: unknown) {
  return chamar('guardar_viagem', { p_id: v.id, p_cliente_telefone: clienteTelefone ?? null, p_estado: v.estado, p_total_mzn: Math.round(v.totalMzn), p_viatura: v.viatura, p_dados: dados });
}

export function enviarInscricao(i: { id: string; telefone: string; porKmMzn: number }, dados: unknown) {
  return inserir('inscricoes', { id: i.id, telefone: i.telefone, por_km_mzn: i.porKmMzn, dados });
}

export function enviarAvaliacao(a: { id: string; tipo: 'motorista' | 'cliente'; telefone: string; estrelas: number; elogios: string[]; comentario?: string; viagemId?: string; em: string }) {
  return inserir('avaliacoes', { id: a.id, tipo: a.tipo, telefone: a.telefone, estrelas: a.estrelas, elogios: a.elogios, comentario: a.comentario ?? '', viagem_id: a.viagemId ?? null, em: a.em });
}

export function enviarAjuda(p: { id: string; clienteTelefone: string }, dados: unknown) {
  return inserir('pedidos_ajuda', { id: p.id, cliente_telefone: p.clienteTelefone, dados });
}

/** Decisões do painel sobre as inscrições deste número. */
export async function lerEstadoInscricoes(telefone: string): Promise<{ id: string; estado: 'pendente' | 'aprovada' | 'rejeitada'; por_km_mzn: number }[]> {
  return ((await chamar('estado_inscricoes', { p_telefone: telefone })) as never[] | null) ?? [];
}

/** Respostas do painel aos pedidos de ajuda deste número. */
export async function lerRespostasAjuda(
  telefone: string,
): Promise<{ id: string; estado: 'aberto' | 'resolvido'; resposta: string | null; reembolso_mzn: number | null; respondido_em: string | null }[]> {
  return ((await chamar('respostas_ajuda', { p_telefone: telefone })) as never[] | null) ?? [];
}
