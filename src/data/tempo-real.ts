import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

import type { Ponto } from '@/components/mapa-tipos';

import type { Lugar } from './lugares';
import type { Motorista } from './motorista';

// Ligação em tempo real entre a app do cliente e a do motorista, pelo Supabase Realtime (broadcast).
// Usa o mesmo projeto dos pagamentos, com as variáveis do ficheiro .env.local (não vai para o GitHub):
// EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
// Sem elas, a app fica em modo de demonstração: o motorista do cliente é simulado e o motorista recebe pedidos simulados.
const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CHAVE_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const TEMPO_REAL_ATIVO = Boolean(URL_SUPABASE && CHAVE_SUPABASE);

/** Pedido que o cliente envia ao motorista do carro que escolheu. As datas vão como texto ISO. */
export type PedidoMotorista = {
  id: string;
  viaturaId: string;
  viaturaNome: string;
  origem: Lugar;
  paragens: Lugar[];
  destino: Lugar;
  km: number;
  minutos: number;
  /** O que o cliente pagou pela viagem, já com desconto. */
  precoMzn: number;
  /** Hora da recolha; ausente quando é para agora. */
  recolhaEm?: string;
  /** O motorista pede este código ao cliente para começar a viagem. */
  codigoRecolha: string;
  pagamento: string;
  criadoEm: string;
};

export type EstadoViagem = 'a_caminho' | 'chegou' | 'em_viagem' | 'concluida';

export type EventoViagem =
  | { tipo: 'pedido'; pedido: PedidoMotorista }
  | { tipo: 'aceite'; id: string; motorista: Motorista; posicao: Ponto; agendada: boolean }
  | { tipo: 'recusado'; id: string }
  | { tipo: 'posicao'; id: string; posicao: Ponto }
  | { tipo: 'estado'; id: string; estado: EstadoViagem; motorista?: Motorista }
  | { tipo: 'cancelado'; id: string; por: 'cliente' | 'motorista' };

type Ouvinte = (e: EventoViagem) => void;
const ouvintes = new Set<Ouvinte>();
let canal: RealtimeChannel | null = null;
let ligado = false;
// Eventos enviados antes de o canal estar ligado; saem mal a ligação abre.
const emEspera: EventoViagem[] = [];

// Protótipo: um só canal para todas as viagens. No produto final cada viagem tem o seu canal privado, com regras de acesso.
function ligar(): RealtimeChannel | null {
  if (!TEMPO_REAL_ATIVO) return null;
  if (canal) return canal;
  const supabase = createClient(URL_SUPABASE!, CHAVE_SUPABASE!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  canal = supabase.channel('chauffeur-viagens', { config: { broadcast: { self: false } } });
  canal.on('broadcast', { event: 'viagem' }, ({ payload }) => {
    for (const o of ouvintes) o(payload as EventoViagem);
  });
  canal.subscribe((estado) => {
    ligado = estado === 'SUBSCRIBED';
    if (ligado) for (const e of emEspera.splice(0)) enviar(e);
  });
  return canal;
}

/** Envia um evento ao outro lado (cliente ou motorista). Sem servidor não faz nada. */
export function publicar(e: EventoViagem) {
  if (!ligar()) return;
  if (ligado) enviar(e);
  else emEspera.push(e);
}

function enviar(e: EventoViagem) {
  canal?.send({ type: 'broadcast', event: 'viagem', payload: e }).catch(() => {});
}

/** Recebe os eventos do outro lado. Devolve a função para deixar de ouvir. */
export function ouvir(o: Ouvinte): () => void {
  ligar();
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}
