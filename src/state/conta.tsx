import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { avisarNoTelemovel } from '@/data/avisos-telemovel';
import { LUGARES, type Lugar } from '@/data/lugares';
import { MOTORISTA_EXEMPLO, type Motorista } from '@/data/motorista';
import type { Promo } from '@/data/promocoes';
import type { Pagamento } from '@/state/pedido';

export type TipoLocal = 'casa' | 'trabalho' | 'aeroporto';
export const LOCAIS: { tipo: TipoLocal; nome: string }[] = [
  { tipo: 'casa', nome: 'Casa' },
  { tipo: 'trabalho', nome: 'Trabalho' },
  { tipo: 'aeroporto', nome: 'Aeroporto' },
];

/** Elogios rápidos que o cliente pode juntar às estrelas. */
export const ELOGIOS = ['Condução segura', 'Pontual', 'Carro limpo', 'Simpático', 'Boa conversa', 'Ajudou com a bagagem'];

export type Avaliacao = { estrelas: number; elogios: string[]; comentario: string };

export type ViagemFeita = {
  id: string;
  /** Viagem com motorista (por omissão), aluguer ou casamento pagos à diária. */
  tipo?: 'viagem' | 'aluguer' | 'casamento';
  dias?: number;
  decoracao?: 'com' | 'sem';
  criadaEm: Date;
  /** Para viagens agendadas, a hora da recolha. */
  recolhaEm: Date;
  origem: Lugar;
  paragens: Lugar[];
  destino: Lugar;
  viatura: string;
  motorista: Motorista;
  km: number;
  minutos: number;
  /** Preço da viagem, já com a taxa de pedido imediato quando houve. */
  precoMzn: number;
  taxaImediatoMzn: number;
  descontoMzn: number;
  promo?: string;
  gorjetaMzn: number;
  pagamento: Pagamento;
  /** Código que o cliente diz ao motorista na recolha. */
  codigoRecolha: string;
  estado: 'agendada' | 'em_curso' | 'concluida' | 'cancelada';
  avaliacao?: Avaliacao;
};

export const totalPago = (v: ViagemFeita) => v.precoMzn - v.descontoMzn + v.gorjetaMzn;

export type Mensagem = { id: string; de: 'cliente' | 'motorista'; texto: string; em: Date; lida: boolean };
export type Aviso = { id: string; titulo: string; texto: string; em: Date; lido: boolean };

type Conta = {
  locais: Record<TipoLocal, Lugar | null>;
  guardarLocal: (tipo: TipoLocal, l: Lugar) => void;

  viagens: ViagemFeita[];
  viagemAtual: ViagemFeita | null;
  registarViagem: (v: Omit<ViagemFeita, 'id' | 'criadaEm'>) => string;
  atualizarViagem: (id: string, mudancas: Partial<ViagemFeita>) => void;
  /** Média que os motoristas deram ao cliente. */
  avaliacaoCliente: number;

  mensagens: Mensagem[];
  naoLidasChat: number;
  enviarMensagem: (texto: string) => void;
  marcarChatLido: () => void;

  avisos: Aviso[];
  avisosNaoLidos: number;
  /** Aviso que aparece por cima do ecrã, dentro da app. */
  avisoTopo: Aviso | null;
  avisar: (titulo: string, texto: string) => void;
  marcarAvisosLidos: () => void;
  avisosNoTelemovel: boolean;
  setAvisosNoTelemovel: (v: boolean) => void;

  promo: Promo | null;
  setPromo: (p: Promo | null) => void;
  codigoConvite: string;
  creditoMzn: number;
  amigosConvidados: number;
};

const ContaContext = createContext<Conta | null>(null);

// Respostas simuladas do motorista, até haver chat pelo servidor.
function respostaDoMotorista(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('onde') || t.includes('demora')) return 'Estou a poucos minutos. Já te vejo no mapa.';
  if (t.includes('porta') || t.includes('sair') || t.includes('desço')) return 'Perfeito, espero por ti à porta.';
  if (t.includes('bagagem') || t.includes('mala')) return 'Sem problema, ajudo-te com a bagagem.';
  return 'Recebido, obrigado!';
}

// Duas viagens antigas, para o histórico não aparecer vazio no protótipo.
function viagensExemplo(): ViagemFeita[] {
  const dia = (d: number, h: number) => {
    const x = new Date();
    x.setDate(x.getDate() - d);
    x.setHours(h, 15, 0, 0);
    return x;
  };
  const lugar = (id: string) => LUGARES.find((l) => l.id === id)!;
  const base = { paragens: [], motorista: MOTORISTA_EXEMPLO, taxaImediatoMzn: 0, gorjetaMzn: 0, pagamento: 'mpesa' as const, codigoRecolha: '0000', estado: 'concluida' as const };
  return [
    { ...base, id: 'v-ex-2', criadaEm: dia(2, 8), recolhaEm: dia(2, 9), origem: lugar('polana'), destino: lugar('aeroporto'), viatura: 'Mercedes-Benz Classe E', km: 7.4, minutos: 18, precoMzn: 700, descontoMzn: 140, promo: 'BEMVINDO', gorjetaMzn: 50, avaliacao: { estrelas: 5, elogios: ['Pontual', 'Carro limpo'], comentario: '' } },
    { ...base, id: 'v-ex-1', criadaEm: dia(6, 19), recolhaEm: dia(6, 20), origem: lugar('baia-mall'), destino: lugar('matola-shopping'), viatura: 'BMW Série 5', km: 16.2, minutos: 31, precoMzn: 1460, descontoMzn: 0, pagamento: 'emola', avaliacao: { estrelas: 4, elogios: ['Condução segura'], comentario: '' } },
  ];
}

// Protótipo: tudo em memória. No produto final a conta, as viagens e o chat vivem no Supabase.
export function ContaProvider({ children }: { children: ReactNode }) {
  const [locais, setLocais] = useState<Record<TipoLocal, Lugar | null>>({ casa: null, trabalho: null, aeroporto: LUGARES.find((l) => l.id === 'aeroporto') ?? null });
  const [viagens, setViagens] = useState<ViagemFeita[]>(viagensExemplo);
  const [viagemAtualId, setViagemAtualId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [avisoTopo, setAvisoTopo] = useState<Aviso | null>(null);
  const [avisosNoTelemovel, setAvisosNoTelemovel] = useState(true);
  const [promo, setPromo] = useState<Promo | null>(null);
  const noTelemovel = useRef(avisosNoTelemovel);
  useEffect(() => {
    noTelemovel.current = avisosNoTelemovel;
  }, [avisosNoTelemovel]);

  // O aviso do topo desaparece sozinho.
  useEffect(() => {
    if (!avisoTopo) return;
    const t = setTimeout(() => setAvisoTopo(null), 4000);
    return () => clearTimeout(t);
  }, [avisoTopo]);

  const avisar = useCallback((titulo: string, texto: string) => {
    const aviso: Aviso = { id: `av-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, titulo, texto, em: new Date(), lido: false };
    setAvisos((atual) => [aviso, ...atual]);
    setAvisoTopo(aviso);
    if (noTelemovel.current) avisarNoTelemovel(titulo, texto);
  }, []);

  const enviarMensagem = useCallback((texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    setMensagens((atual) => [...atual, { id: `m-${Date.now()}`, de: 'cliente', texto: limpo, em: new Date(), lida: true }]);
    setTimeout(() => {
      setMensagens((atual) => [...atual, { id: `m-${Date.now()}`, de: 'motorista', texto: respostaDoMotorista(limpo), em: new Date(), lida: false }]);
    }, 1500);
  }, []);

  const marcarChatLido = useCallback(() => setMensagens((atual) => (atual.some((m) => !m.lida) ? atual.map((m) => ({ ...m, lida: true })) : atual)), []);

  const valor = useMemo<Conta>(() => {
    const viagemAtual = viagens.find((v) => v.id === viagemAtualId) ?? null;
    return {
      locais,
      guardarLocal: (tipo, l) => setLocais((atual) => ({ ...atual, [tipo]: l })),
      viagens,
      viagemAtual,
      registarViagem: (v) => {
        const id = `v-${Date.now()}`;
        setViagens((atual) => [{ ...v, id, criadaEm: new Date() }, ...atual]);
        setViagemAtualId(id);
        // Chat novo para cada viagem.
        setMensagens([]);
        return id;
      },
      atualizarViagem: (id, mudancas) => setViagens((atual) => atual.map((v) => (v.id === id ? { ...v, ...mudancas } : v))),
      // Simulado: no produto final é a média das estrelas que cada motorista dá no fim da viagem.
      avaliacaoCliente: 4.9,
      mensagens,
      naoLidasChat: mensagens.filter((m) => !m.lida).length,
      enviarMensagem,
      marcarChatLido,
      avisos,
      avisosNaoLidos: avisos.filter((a) => !a.lido).length,
      avisoTopo,
      avisar,
      marcarAvisosLidos: () => setAvisos((atual) => (atual.some((a) => !a.lido) ? atual.map((a) => ({ ...a, lido: true })) : atual)),
      avisosNoTelemovel,
      setAvisosNoTelemovel,
      promo,
      setPromo,
      // No produto final o código vem da conta do cliente; aqui é fixo.
      codigoConvite: 'AMIGO-7K2P',
      creditoMzn: 0,
      amigosConvidados: 0,
    };
  }, [locais, viagens, viagemAtualId, mensagens, avisos, avisoTopo, avisosNoTelemovel, promo, avisar, enviarMensagem, marcarChatLido]);

  return <ContaContext.Provider value={valor}>{children}</ContaContext.Provider>;
}

export function useConta(): Conta {
  const ctx = useContext(ContaContext);
  if (!ctx) throw new Error('useConta tem de estar dentro de ContaProvider');
  return ctx;
}
