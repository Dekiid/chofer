import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { avisarNoTelemovel } from '@/data/avisos-telemovel';
import { PREFERENCIAS_PADRAO, type ContactoConfianca, type PartilhaAuto, type Passageiro, type Preferencias } from '@/data/extras-viagem';
import { formatarMzn } from '@/data/categorias';
import { useGuardado } from '@/data/guardar';
import { ouvir, TEMPO_REAL_ATIVO } from '@/data/tempo-real';
import { LUGARES, type Lugar } from '@/data/lugares';
import { MOTORISTA_EXEMPLO, type Motorista } from '@/data/motorista';
import type { Promo } from '@/data/promocoes';
import { assinaturaAtiva, CLUB, type Assinatura } from '@/data/club';
import type { Pagamento } from '@/state/pedido';
import { enviarViagem } from '@/data/servidor-painel';
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
  /** Id do carro, para o resumo do dono. */
  viaturaId?: string;
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
  /** Viagem grátis do Club (já incluída em descontoMzn). */
  gratisMzn?: number;
  /** Desconto da assinatura Chauffeur Club (já incluído em descontoMzn). */
  descontoClubMzn?: number;
  /** Parte paga com o saldo da carteira. */
  carteiraMzn?: number;
  /** Conta dividida: a parte de cada amigo (a do cliente é o resto). */
  divisao?: ParteDivisao[];
  /** Pedido feito ao motorista favorito. */
  favorito?: boolean;
};

/** Parte de um amigo numa conta dividida. Recebe o pedido de pagamento no telemóvel. */
export type ParteDivisao = { nome: string; telefone: string; valorMzn: number; paga: boolean };

/** Movimento da carteira: positivo entra (reembolso, crédito, carregamento), negativo sai (viagem, levantamento). */
export type TipoMovimento = 'reembolso' | 'convite' | 'carregamento' | 'viagem' | 'levantamento';
export type Movimento = { id: string; valorMzn: number; tipo: TipoMovimento; /** Destino da viagem, por exemplo. */ detalhe?: string; em: Date };

/** Dados para o recibo com NUIT (cliente particular). */
export type Faturacao = { nome: string; nuit: string; morada: string };

export const totalPago = (v: ViagemFeita) => (v.estado === 'cancelada' ? (v.taxaCancelamentoMzn ?? 0) : v.precoMzn - v.descontoMzn + v.gorjetaMzn);

/** Conta de empresa: as viagens pagas com «Fatura da empresa» juntam-se numa fatura por mês. */
export type Empresa = { nome: string; nuit: string; emailFaturas: string };

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

  /** Motoristas favoritos: o cliente pode pedir o mesmo motorista outra vez. */
  favoritos: Motorista[];
  alternarFavorito: (m: Motorista) => void;
  eFavorito: (telefone: string | undefined) => boolean;

  /** Carteira: reembolsos, créditos de convite e carregamentos. */
  saldoMzn: number;
  movimentos: Movimento[];
  movimentar: (valorMzn: number, tipo: TipoMovimento, detalhe?: string) => void;

  faturacao: Faturacao | null;
  setFaturacao: (f: Faturacao | null) => void;

  /** Chauffeur Club: null quando não tem; com renovaEm no passado, terminou. */
  /** Conta dividida: guarda a parte de cada amigo e envia-lhes o pedido de pagamento (simulado no protótipo). */
  dividirViagem: (id: string, partes: ParteDivisao[]) => void;

  assinatura: Assinatura | null;
  clubAtivo: boolean;
  aderirClub: () => void;
  cancelarClub: () => void;
};

const ContaContext = createContext<Conta | null>(null);

// Respostas simuladas do motorista, até haver chat pelo servidor.
// Procura palavras em português e em inglês, porque as respostas rápidas do chat vão na língua da app.
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

  // As viagens vão para o painel de gestão na web quando são criadas ou mudam (sem as de exemplo).
  const enviadas = useRef(new Map<string, string>());
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO) return;
    for (const v of viagens) {
      if (v.id.startsWith('v-ex-')) continue;
      const json = JSON.stringify(v);
      if (enviadas.current.get(v.id) === json) continue;
      enviadas.current.set(v.id, json);
      enviarViagem({ id: v.id, estado: v.estado, viatura: v.viatura, totalMzn: totalPago(v) }, perfil?.telefone, { ...v, clienteNome: perfil?.nome });
    }
  }, [viagens, perfil]);
  const [preferencias, setPreferencias] = useGuardado<Preferencias>(chave && `${chave}.preferencias`, PREFERENCIAS_PADRAO);
  const [contactosConfianca, setContactosConfianca] = useGuardado<ContactoConfianca[]>(chave && `${chave}.contactos`, []);
  const [partilhaAuto, setPartilhaAuto] = useGuardado<PartilhaAuto>(chave && `${chave}.partilha`, 'noite');
  const [empresa, setEmpresa] = useGuardado<Empresa | null>(chave && `${chave}.empresa`, null);
  const [favoritos, setFavoritos] = useGuardado<Motorista[]>(chave && `${chave}.favoritos`, []);
  const [movimentos, setMovimentos] = useGuardado<Movimento[]>(chave && `${chave}.carteira`, []);
  const [faturacao, setFaturacao] = useGuardado<Faturacao | null>(chave && `${chave}.faturacao`, null);
  const [assinatura, setAssinatura] = useGuardado<Assinatura | null>(chave && `${chave}.club`, null);
  const movimentar = useCallback(
    (valorMzn: number, tipo: TipoMovimento, detalhe?: string) => {
      if (!valorMzn) return;
      setMovimentos((l) => [{ id: `mv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, valorMzn, tipo, detalhe, em: new Date() }, ...l]);
    },
    [setMovimentos],
  );
  const [viagemAtualId, setViagemAtualId] = useState<string | null>(null);
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
        return id;
      },
      atualizarViagem: (id, mudancas) => setViagens((atual) => atual.map((v) => (v.id === id ? { ...v, ...mudancas } : v))),
      preferencias,
      setPreferencias,
      contactosConfianca,
      setContactosConfianca,
      partilhaAuto,
      setPartilhaAuto,
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
      creditoMzn: movimentos.filter((m) => m.tipo === 'convite').reduce((t, m) => t + m.valorMzn, 0),
      amigosConvidados: movimentos.filter((m) => m.tipo === 'convite').length,
      favoritos,
      alternarFavorito: (m) =>
        setFavoritos((l) => (l.some((f) => f.telefone === m.telefone) ? l.filter((f) => f.telefone !== m.telefone) : [{ nome: m.nome, telefone: m.telefone, matricula: m.matricula }, ...l])),
      eFavorito: (telefone) => telefone != null && favoritos.some((f) => f.telefone === telefone),
      saldoMzn: Math.max(0, movimentos.reduce((t, m) => t + m.valorMzn, 0)),
      movimentos,
      movimentar,
      faturacao,
      setFaturacao,
      dividirViagem: (id, partes) => {
        if (partes.length === 0) return;
        setViagens((l) => l.map((v) => (v.id === id ? { ...v, divisao: partes } : v)));
        // Protótipo: cada amigo "paga" alguns segundos depois. No produto final, cada um recebe o pedido M-Pesa/e-Mola
        // e, se não pagar numa hora, a parte dele é cobrada a quem pediu.
        partes.forEach((p, i) =>
          setTimeout(() => {
            setViagens((l) => l.map((v) => (v.id === id ? { ...v, divisao: v.divisao?.map((x) => (x.telefone === p.telefone ? { ...x, paga: true } : x)) } : v)));
            avisar(t('Conta dividida'), t('{nome} pagou a sua parte: {valor}.', { nome: p.nome, valor: formatarMzn(p.valorMzn) }));
          }, 5000 + i * 3000),
        );
      },
      assinatura,
      clubAtivo: assinaturaAtiva(assinatura),
      aderirClub: () => {
        const desde = new Date();
        const renovaEm = new Date(desde);
        renovaEm.setDate(renovaEm.getDate() + CLUB.diasPorMes);
        setAssinatura({ desde, renovaEm });
      },
      // Fica ativa até ao fim do mês já pago, como na Uber One.
      cancelarClub: () => setAssinatura((a) => (a ? { ...a, cancelada: true } : a)),
    };
  }, [locais, setLocais, viagens, setViagens, viagemAtualId, avisos, avisoTopo, avisosNoTelemovel, preferencias, setPreferencias, contactosConfianca, setContactosConfianca, partilhaAuto, setPartilhaAuto, empresa, setEmpresa, promo, avisar, favoritos, setFavoritos, movimentos, movimentar, faturacao, setFaturacao, assinatura, setAssinatura]);

  return <ContaContext.Provider value={valor}>{children}</ContaContext.Provider>;
}

export function useConta(): Conta {
  const ctx = useContext(ContaContext);
  if (!ctx) throw new Error('useConta tem de estar dentro de ContaProvider');
  return ctx;
}
