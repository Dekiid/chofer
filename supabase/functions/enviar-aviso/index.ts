// Envia um aviso push ao motorista de um carro. O token do telemóvel fica só no servidor:
// a app pede o envio aqui em vez de ler a tabela push_motoristas.
// Segredo opcional: EXPO_ACCESS_TOKEN (se ativares "Enhanced security for push notifications" no Expo).
import { CORS, db, json } from '../_shared/supabase.ts';

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
const corta = (s: unknown, n: number) => String(s ?? '').slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não suportado' }, 405);

  const corpo = await req.json().catch(() => null);
  const viaturaId = corta(corpo?.viatura_id, 80);
  const titulo = corta(corpo?.titulo, 80);
  const texto = corta(corpo?.texto, 200);
  if (!viaturaId || !titulo) return json({ erro: 'Faltam dados.' }, 400);
  const dados = corpo?.dados && typeof corpo.dados === 'object' ? corpo.dados : {};

  const { data, error } = await db.from('push_motoristas').select('token').eq('viatura_id', viaturaId).maybeSingle();
  if (error) {
    console.error(error);
    return json({ erro: 'Não foi possível ler o telemóvel do motorista.' }, 500);
  }
  const token = (data as { token?: string } | null)?.token;
  if (!token) return json({ enviado: false });

  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  const resposta = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ to: token, title: titulo, body: texto, data: dados, priority: 'high', sound: 'default', channelId: 'pedidos' }),
  });
  if (!resposta.ok) {
    console.error('Expo recusou', resposta.status, await resposta.text());
    return json({ erro: 'O Expo recusou o aviso.' }, 502);
  }
  return json({ enviado: true });
});
