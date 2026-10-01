import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { avisarNoTelemovel } from '@/data/avisos-telemovel';
import { PREFERENCIAS_PADRAO, type ContactoConfianca, type PartilhaAuto, type Passageiro, type Preferencias } from '@/data/extras-viagem';
import { useGuardado } from '@/data/guardar';
import { ouvir, TEMPO_REAL_ATIVO } from '@/data/tempo-real';
import { LUGARES, type Lugar } from '@/data/lugares';
import { MOTORISTA_EXEMPLO, type Motorista } from '@/data/motorista';
import type { Promo } from '@/data/promocoes';
import type { Pagamento } from '@/state/pedido';
import { useSessao } from '@/state/sessao';
import { t } from '@/i18n';

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
  /** Pedido para agora: paga-se no fim da viagem, como na Uber. Fica true até o pagamento ser feito. */
  porPagar?: boolean;
  /** Cancelada: o que o cliente pagou ou perdeu, e o que lhe voltou. */
  taxaCancelamentoMzn?: number;
  reembolsoMzn?: number;
  passageiro?: Passageiro;
  preferencias?: Preferencias;
  voo?: string;
  /** Quem cancelou, ou falta de comparência. */
  motivoCancelamento?: 'cliente' | 'motorista' | 'falta';
};

export const totalPago = (v: ViagemFeita) => (v.estado === 'cancelada' ? (v.taxaCancelamentoMzn ?? 0) : v.precoMzn - v.descontoMzn + v.gorjetaMzn);

/** Conta de empresa: as viagens pagas com «Fatura da empresa» juntam-se numa fatura por mês. */
export type Empresa = { nome: string; nuit: string; emailFaturas: string };

export type Mensagem = { id: string; de: 'cliente' | 'motorista'; texto: string; em: Date; lida: boolean };
export type Aviso = { id: string; titulo: string; texto: string; em: Date; lido: boolean };

type Conta = {
  locais: Record<TipoLocal, Lugar | null>;
  guardarLocal: (tipo: TipoLocal, l: Lugar) => void;

  viagens: ViagemFeita[];
  viagemAtual: ViagemFeita | null;
  /** Guarda a viagem paga; o id pode vir de fora, para ser o mesmo da reserva na agenda. */
  registarViagem: (v: Omit<ViagemFeita, 'id' | 'criadaEm'> & { id?: string }) => string;
  atualizarViagem: (id: string, mudancas: Partial<ViagemFeita>) => void;
  /** Preferências para todas as viagens (silêncio, temperatura, música, malas). */
  preferencias: Preferencias;
  setPreferencias: (p: Preferencias) => void;
  /** Quem recebe a viagem partilhada, e quando. */
  contactosConfianca: ContactoConfianca[];
  setContactosConfianca: (c: ContactoConfianca[]) => void;
  partilhaAuto: PartilhaAuto;
  setPartilhaAuto: (r: PartilhaAuto) => void;

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

  empresa: Empresa | null;
  setEmpresa: (e: Empresa | null) => void;

  promo: Promo | null;
  setPromo: (p: Promo | null) => void;
  codigoConvite: string;
  creditoMzn: number;
  amigosConvidados: number;
};

const ContaContext = createContext<Conta | null>(null);

// Respostas simuladas do motorista, até haver chat pelo servidor.
// Procura palavras em português e em inglês, porque as respostas rápidas do chat vão na língua da app.
function respostaDoMotorista(texto: string): string {
  const m = texto.toLowerCase();
  const tem = (...palavras: string[]) => palavras.some((p) => m.includes(p));
  if (tem('onde', 'demora', 'where', 'how long')) return t('Estou a poucos minutos. Já te vejo no mapa.');
  if (tem('porta', 'sair', 'desço', 'door', 'outside', 'heading out', 'coming down')) return t('Perfeito, espero por ti à porta.');
  if (tem('bagagem', 'mala', 'luggage', 'bag')) return t('Sem problema, ajudo-te com a bagagem.');
  return t('Recebido, obrigado!');
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

// Protótipo: as viagens e os locais ficam guardados neste telemóvel, por conta. O chat fica em memória.
// No produto final a conta, as viagens e o chat vivem no Supabase.
export function ContaProvider({ children }: { children: ReactNode }) {
  const { perfil } = useSessao();
  const chave = perfil?.telefone ? `chauffeur.dados.${perfil.telefone}` : null;
  const [locais, setLocais] = useGuardado<Record<TipoLocal, Lugar | null>>(chave && `${chave}.locais`, () => ({
    casa: null,
    trabalho: null,
    aeroporto: LUGARES.find((l) => l.id === 'aeroporto') ?? null,
  }));
  const [viagens, setViagens] = useGuardado<ViagemFeita[]>(chave && `${chave}.viagens`, viagensExemplo);
  const [preferencias, setPreferencias] = useGuardado<Preferencias>(chave && `${chave}.preferencias`, PREFERENCIAS_PADRAO);
  const [contactosConfianca, setContactosConfianca] = useGuardado<ContactoConfianca[]>(chave && `${chave}.contactos`, []);
  const [partilhaAuto, setPartilhaAuto] = useGuardado<PartilhaAuto>(chave && `${chave}.partilha`, 'noite');
  const [empresa, setEmpresa] = useGuardado<Empresa | null>(chave && `${chave}.empresa`, null);
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

  // Viagens marcadas: o motorista aceita-as mais tarde, e avisa quando sai para a recolha.
  // (As viagens para agora são acompanhadas no ecrã da viagem.)
  const viagensRef = useRef(viagens);
  useEffect(() => {
    viagensRef.current = viagens;
  }, [viagens]);
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO) return;
    return ouvir((e) => {
      if (!('id' in e)) return;
      const v = viagensRef.current.find((x) => x.id === e.id && x.estado === 'agendada');
      if (!v) return;
      if (e.tipo === 'aceite' && e.agendada) {
        setViagens((l) => l.map((x) => (x.id === v.id ? { ...x, motorista: e.motorista } : x)));
        avisar(t('Motorista confirmado'), t('{nome} aceitou a tua viagem para {destino}.', { nome: e.motorista.nome, destino: v.destino.nome }));
      }
      if (e.tipo === 'recusado') avisar(t('Motorista indisponível'), t('O motorista não pode fazer a viagem para {destino}. Vamos contactar-te.', { destino: v.destino.nome }));
      if (e.tipo === 'estado' && e.estado === 'a_caminho') avisar(t('{nome} vai a caminho', { nome: v.motorista.nome.split(' ')[0] }), t('Código de recolha: {codigo}.', { codigo: v.codigoRecolha }));
      if (e.tipo === 'estado' && e.estado === 'chegou') avisar(t('O teu chauffeur chegou'), t('Diz-lhe o código {codigo}.', { codigo: v.codigoRecolha }));
      if (e.tipo === 'estado' && e.estado === 'concluida') setViagens((l) => l.map((x) => (x.id === v.id ? { ...x, estado: 'concluida' } : x)));
    });
  }, [avisar, setViagens]);

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
      registarViagem: ({ id: idDado, ...v }) => {
        const id = idDado ?? `v-${Date.now()}`;
        setViagens((atual) => [{ ...v, id, criadaEm: new Date() }, ...atual]);
        setViagemAtualId(id);
        // Chat novo para cada viagem.
        setMensagens([]);
        return id;
      },
      atualizarViagem: (id, mudancas) => setViagens((atual) => atual.map((v) => (v.id === id ? { ...v, ...mudancas } : v))),
      preferencias,
      setPreferencias,
      contactosConfianca,
      setContactosConfianca,
      partilhaAuto,
      setPartilhaAuto,
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
      empresa,
      setEmpresa,
      promo,
      setPromo,
      // No produto final o código vem da conta do cliente; aqui é fixo.
      codigoConvite: 'AMIGO-7K2P',
      creditoMzn: 0,
      amigosConvidados: 0,
    };
  }, [locais, setLocais, viagens, setViagens, viagemAtualId, mensagens, avisos, avisoTopo, avisosNoTelemovel, preferencias, setPreferencias, contactosConfianca, setContactosConfianca, partilhaAuto, setPartilhaAuto, empresa, setEmpresa, promo, avisar, enviarMensagem, marcarChatLido]);

  return <ContaContext.Provider value={valor}>{children}</ContaContext.Provider>;
}

export function useConta(): Conta {
  const ctx = useContext(ContaContext);
  if (!ctx) throw new Error('useConta tem de estar dentro de ContaProvider');
  return ctx;
}
