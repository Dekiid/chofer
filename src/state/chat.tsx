import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { avisarNoTelemovel } from '@/data/avisos-telemovel';
import { useGuardado } from '@/data/guardar';
import { ouvir, publicar, TEMPO_REAL_ATIVO, type MensagemChat } from '@/data/tempo-real';
import { t } from '@/i18n';

export type LadoChat = MensagemChat['de'];
type MensagemGuardada = MensagemChat & { lida: boolean };

type Chat = {
  mensagens: (viagemId: string) => MensagemGuardada[];
  enviar: (viagemId: string, de: LadoChat, nome: string, texto: string) => void;
  /** Mensagens do outro lado ainda por ler. */
  naoLidas: (viagemId: string, eu: LadoChat) => number;
  marcarLidas: (viagemId: string, eu: LadoChat) => void;
  /** Enquanto a viagem estiver aberta neste telemóvel, as mensagens dela chegam aqui. */
  acompanhar: (viagemId: string, eu: LadoChat) => () => void;
};

const Contexto = createContext<Chat | null>(null);
const MAX_VIAGENS = 20;

// Respostas simuladas, só sem servidor: o outro lado responde sozinho para se poder testar com um telemóvel.
function respostaSimulada(texto: string, de: LadoChat): string {
  if (de === 'motorista') return t('Ok, obrigado!');
  const m = texto.toLowerCase();
  const tem = (...palavras: string[]) => palavras.some((p) => m.includes(p));
  if (tem('onde', 'demora', 'where', 'how long')) return t('Estou a poucos minutos. Já te vejo no mapa.');
  if (tem('porta', 'sair', 'desço', 'door', 'outside', 'heading out', 'coming down')) return t('Perfeito, espero por ti à porta.');
  if (tem('bagagem', 'mala', 'luggage', 'bag')) return t('Sem problema, ajudo-te com a bagagem.');
  return t('Recebido, obrigado!');
}

/**
 * Chat entre o cliente e o motorista de uma viagem, sem trocar números.
 * Com o servidor ligado, as mensagens vão pelo Supabase Realtime de um telemóvel para o outro; ficam guardadas em cada telemóvel.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [porViagem, setPorViagem] = useGuardado<Record<string, MensagemGuardada[]>>('chauffeur.chat', {});
  // Viagens abertas neste telemóvel, e de que lado: só estas recebem mensagens.
  const abertas = useRef(new Map<string, LadoChat>());

  const juntar = useCallback(
    (viagemId: string, m: MensagemGuardada) =>
      setPorViagem((atual) => {
        const lista = atual[viagemId] ?? [];
        if (lista.some((x) => x.id === m.id)) return atual;
        const novo = { ...atual, [viagemId]: [...lista, m] };
        const ids = Object.keys(novo);
        if (ids.length > MAX_VIAGENS) delete novo[ids[0]];
        return novo;
      }),
    [setPorViagem],
  );

  useEffect(() => {
    if (!TEMPO_REAL_ATIVO) return;
    return ouvir((e) => {
      if (e.tipo !== 'mensagem') return;
      const eu = abertas.current.get(e.id);
      if (!eu || e.mensagem.de === eu) return;
      juntar(e.id, { ...e.mensagem, lida: false });
      avisarNoTelemovel(t('Mensagem de {nome}', { nome: e.mensagem.nome }), e.mensagem.texto);
    });
  }, [juntar]);

  const valor = useMemo<Chat>(
    () => ({
      mensagens: (id) => porViagem[id] ?? [],
      enviar: (id, de, nome, texto) => {
        const limpo = texto.trim();
        if (!limpo) return;
        const m: MensagemChat = { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, de, nome, texto: limpo, em: new Date().toISOString() };
        juntar(id, { ...m, lida: true });
        if (TEMPO_REAL_ATIVO) publicar({ tipo: 'mensagem', id, mensagem: m });
        else
          setTimeout(() => {
            const outro: LadoChat = de === 'cliente' ? 'motorista' : 'cliente';
            juntar(id, { id: `m-${Date.now()}`, de: outro, nome: '', texto: respostaSimulada(limpo, de), em: new Date().toISOString(), lida: false });
          }, 1500);
      },
      naoLidas: (id, eu) => (porViagem[id] ?? []).filter((m) => m.de !== eu && !m.lida).length,
      marcarLidas: (id, eu) =>
        setPorViagem((atual) => {
          const lista = atual[id];
          if (!lista?.some((m) => m.de !== eu && !m.lida)) return atual;
          return { ...atual, [id]: lista.map((m) => (m.de !== eu ? { ...m, lida: true } : m)) };
        }),
      acompanhar: (id, eu) => {
        abertas.current.set(id, eu);
        return () => {
          if (abertas.current.get(id) === eu) abertas.current.delete(id);
        };
      },
    }),
    [porViagem, juntar, setPorViagem],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useChat(): Chat {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useChat tem de estar dentro de ChatProvider');
  return ctx;
}

/** Recebe as mensagens desta viagem enquanto o ecrã estiver aberto. */
export function useAcompanharChat(viagemId: string | undefined, eu: LadoChat) {
  const { acompanhar } = useChat();
  useEffect(() => (viagemId ? acompanhar(viagemId, eu) : undefined), [viagemId, eu, acompanhar]);
}
