import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import type { Ponto } from '@/components/mapa-tipos';
import type { Passageiro, Preferencias } from '@/data/extras-viagem';
import { t } from '@/i18n';

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

/** Erros comuns ao copiar as chaves do Supabase para o .env.local (sem mostrar a chave). */
export function problemaConfiguracao(): string | null {
  if (!TEMPO_REAL_ATIVO) return null;
  const url = URL_SUPABASE!.trim();
  const chave = CHAVE_SUPABASE!.trim();
  if (/["'\s]/.test(URL_SUPABASE!) || /["'\s]/.test(CHAVE_SUPABASE!)) return t('há aspas ou espaços no .env.local');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return t('o endereço deve ser só https://xxxx.supabase.co, sem /rest/v1 nem mais nada');
  if (chave.startsWith('sb_secret_') || chave.includes('service_role')) return t('essa é a chave secreta; usa a chave anon (ou publishable)');
  if (!chave.startsWith('eyJ') && !chave.startsWith('sb_publishable_')) return t('a chave não parece a anon (começa por eyJ) nem a publishable (começa por sb_publishable_)');
  return null;
}

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
  /** Nome do cliente, para o motorista saber quem vai buscar. */
  clienteNome?: string;
  /** Pedido para agora: o cliente paga pela app no fim da viagem. */
  pagaNoFim?: boolean;
  /** Número do cliente, para o motorista o avaliar no fim. */
  clienteTelefone?: string;
  /** Pedido para outra pessoa: quem vai no carro. */
  passageiro?: Passageiro;
  preferencias?: Preferencias;
  /** Recolha no aeroporto: o voo, para o motorista acompanhar atrasos. */
  voo?: string;
  /** O cliente guardou este motorista nos favoritos e pediu-o outra vez. */
  favorito?: boolean;
};

/** O que o motorista diz do cliente no fim da viagem. */
export type AvaliacaoCliente = { estrelas: number; elogios: string[]; em: string; motorista: string };

/** O que o cliente diz do motorista no fim da viagem. Sem o nome do cliente, como na Uber. */
export type AvaliacaoMotorista = { estrelas: number; elogios: string[]; comentario: string; em: string; viagemId: string };

/** Mensagem do chat de uma viagem. */
export type MensagemChat = { id: string; de: 'cliente' | 'motorista'; nome: string; texto: string; em: string };

export type EstadoViagem = 'a_caminho' | 'chegou' | 'em_viagem' | 'concluida';

export type EventoViagem =
  | { tipo: 'pedido'; pedido: PedidoMotorista }
  | { tipo: 'aceite'; id: string; motorista: Motorista; posicao: Ponto; agendada: boolean }
  | { tipo: 'recusado'; id: string }
  | { tipo: 'posicao'; id: string; posicao: Ponto }
  | { tipo: 'estado'; id: string; estado: EstadoViagem; motorista?: Motorista }
  | { tipo: 'avaliacao_cliente'; telefone: string; avaliacao: AvaliacaoCliente }
  | { tipo: 'mensagem'; id: string; mensagem: MensagemChat }
  | { tipo: 'avaliacao_motorista'; telefone: string; avaliacao: AvaliacaoMotorista }
  | { tipo: 'cancelado'; id: string; por: 'cliente' | 'motorista'; motivo?: 'falta' };

type Ouvinte = (e: EventoViagem) => void;
const ouvintes = new Set<Ouvinte>();
let canal: RealtimeChannel | null = null;
let ligado = false;

/** Estado da ligação ao servidor, para mostrar no ecrã e perceber porque é que um pedido não chega. */
export type EstadoLigacao = { estado: 'demonstracao' | 'a_ligar' | 'ligado' | 'erro'; detalhe?: string };
let estadoLigacao: EstadoLigacao = { estado: TEMPO_REAL_ATIVO ? 'a_ligar' : 'demonstracao' };
const ouvintesLigacao = new Set<() => void>();
function mudarLigacao(e: EstadoLigacao) {
  estadoLigacao = e;
  for (const o of ouvintesLigacao) o();
}
export function useLigacao(): EstadoLigacao {
  return useSyncExternalStore(
    (o) => {
      ligar();
      ouvintesLigacao.add(o);
      return () => ouvintesLigacao.delete(o);
    },
    () => estadoLigacao,
  );
}
// Eventos enviados antes de o canal estar ligado; saem mal a ligação abre.
const emEspera: EventoViagem[] = [];

let cliente: SupabaseClient | null = null;

/** O cliente do Supabase, partilhado pelo tempo real, pela agenda e pelas contas. Sem as chaves no .env.local, é null. */
export function supabase(): SupabaseClient | null {
  if (!TEMPO_REAL_ATIVO) return null;
  if (cliente) return cliente;
  // A sessão da conta fica guardada no telemóvel, para não ser preciso entrar de cada vez que a app abre.
  cliente = createClient(URL_SUPABASE!, CHAVE_SUPABASE!, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  // No telemóvel, a sessão só se renova com a app aberta (recomendação do Supabase para React Native).
  if (Platform.OS !== 'web') {
    const sb = cliente;
    AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') return sb.auth.stopAutoRefresh();
      sb.auth.startAutoRefresh();
      // O iPhone corta a ligação com a app em segundo plano ou ao mudar de rede ("transport failure").
      // Ao voltar à app, se o canal não está ligado, abre-se um novo em vez de esperar pelas tentativas do Supabase.
      if (canal && !ligado) religar();
    });
  }
  return cliente;
}

// Protótipo: um só canal para todas as viagens. No produto final cada viagem tem o seu canal privado, com regras de acesso.
function ligar(): RealtimeChannel | null {
  const sb = supabase();
  if (!sb) return null;
  if (canal) return canal;
  canal = sb.channel('chauffeur-viagens', { config: { broadcast: { self: false } } });
  canal.on('broadcast', { event: 'viagem' }, ({ payload }) => {
    for (const o of ouvintes) o(payload as EventoViagem);
  });
  const este = canal;
  canal.subscribe((estado, erro) => {
    // Um canal antigo (fechado por religar) já não manda no estado.
    if (canal !== este) return;
    ligado = estado === 'SUBSCRIBED';
    if (ligado) {
      mudarLigacao({ estado: 'ligado' });
      for (const e of emEspera.splice(0)) enviar(e);
    } else {
      // CHANNEL_ERROR, TIMED_OUT ou CLOSED: o Supabase volta a tentar sozinho.
      // No telemóvel, a causa real (por exemplo "401 Unauthorized") vem dentro do erro.
      const causa = (erro?.cause as { message?: string } | undefined)?.message;
      const detalhe = problemaConfiguracao() ?? [estado, erro?.message, causa].filter(Boolean).join(': ');
      console.warn('Tempo real sem ligação', detalhe);
      mudarLigacao({ estado: 'erro', detalhe });
      // Se continuar sem ligação daqui a 20 segundos (por exemplo, a rede voltou mas o canal ficou preso), abre um canal novo.
      setTimeout(() => {
        if (canal === este && !ligado) religar();
      }, 20_000);
    }
  });
  return canal;
}

/** Fecha o canal que falhou e abre outro, mantendo quem está a ouvir e os eventos em espera. */
function religar() {
  const sb = supabase();
  if (!sb || !canal) return;
  const velho = canal;
  canal = null;
  ligado = false;
  mudarLigacao({ estado: 'a_ligar' });
  sb.removeChannel(velho).finally(() => ligar());
}

/** Envia um evento ao outro lado (cliente ou motorista). Sem servidor não faz nada. */
export function publicar(e: EventoViagem) {
  if (!ligar()) return;
  if (ligado) enviar(e);
  else emEspera.push(e);
}

function enviar(e: EventoViagem) {
  canal
    ?.send({ type: 'broadcast', event: 'viagem', payload: e })
    .then((r) => {
      if (r !== 'ok') mudarLigacao({ estado: 'erro', detalhe: `envio: ${r}` });
    })
    .catch((err) => mudarLigacao({ estado: 'erro', detalhe: `envio: ${String(err)}` }));
}

/** Recebe os eventos do outro lado. Devolve a função para deixar de ouvir. */
export function ouvir(o: Ouvinte): () => void {
  ligar();
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}
