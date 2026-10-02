import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Cliente com a service role (só no servidor): a tabela de pagamentos não é acessível pela app. */
export const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** A conta de quem chama (sessão por SMS), ou null se veio só com a chave pública. */
export async function quemChama(req: Request): Promise<{ id: string; telefone: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, telefone: (data.user.phone ?? '').replace(/\D/g, '').replace(/^258/, '') };
}
