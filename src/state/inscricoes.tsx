import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import type { PrecoCasamento, Viatura } from '@/data/categorias';
import { enviarFotos } from '@/data/fotos-servidor';
import { useGuardado } from '@/data/guardar';
import type { Motorista } from '@/data/motorista';
import { enviarInscricao, lerEstadoInscricoes } from '@/data/servidor-painel';
import { useSessao } from '@/state/sessao';

/** Fotos que pedimos a cada motorista; a de frente é a que aparece na app. */
export const FOTOS_PEDIDAS = [
  { id: 'frente', nome: 'Frente', dica: 'Telemóvel na horizontal, de frente na diagonal, carro inteiro com espaço à volta' },
  { id: 'lateral', nome: 'Lateral', dica: 'De lado, com as duas rodas visíveis' },
  { id: 'traseira', nome: 'Traseira', dica: 'De trás, com a matrícula visível' },
  { id: 'interior', nome: 'Interior', dica: 'Bancos de trás, onde o cliente se senta' },
] as const;

export type FotoPedida = (typeof FOTOS_PEDIDAS)[number]['id'];

/** Fotos dos documentos, para o painel confirmar com os números escritos. Em testes não são obrigatórias. */
export const FOTOS_DOCUMENTOS = [
  { id: 'bi', nome: 'BI do dono', dica: 'Frente do bilhete de identidade, legível' },
  { id: 'carta', nome: 'Carta de condução', dica: 'De quem conduz o carro' },
  { id: 'livrete', nome: 'Livrete', dica: 'Ou título de propriedade do carro' },
  { id: 'seguro', nome: 'Seguro', dica: 'Apólice ou certificado do seguro' },
] as const;

export type FotoDocumento = (typeof FOTOS_DOCUMENTOS)[number]['id'];

/** Documentos com validade que cada motorista tem de manter em dia. */
export const DOCUMENTOS = [
  { id: 'carta', nome: 'Carta de condução' },
  { id: 'seguro', nome: 'Seguro do carro' },
  { id: 'inspecao', nome: 'Inspeção do carro' },
] as const;
export type Documento = (typeof DOCUMENTOS)[number]['id'];

/** Dias antes do fim da validade em que o motorista começa a ser avisado. */
export const AVISO_VALIDADE_DIAS = 30;

export type EstadoDocumento = { documento: Documento; nome: string; validade: Date | null; dias: number | null; estado: 'ok' | 'a_expirar' | 'expirado' | 'em_falta' };

/** Como está cada documento, a contar de hoje. */
export function estadoDocumentos(validades: Partial<Record<Documento, Date>> | undefined, hoje = new Date()): EstadoDocumento[] {
  return DOCUMENTOS.map((d) => {
    const validade = validades?.[d.id] ? new Date(validades[d.id]!) : null;
    if (!validade) return { documento: d.id, nome: d.nome, validade, dias: null, estado: 'em_falta' };
    const dias = Math.ceil((validade.getTime() - hoje.getTime()) / 86_400_000);
    return { documento: d.id, nome: d.nome, validade, dias, estado: dias < 0 ? 'expirado' : dias <= AVISO_VALIDADE_DIAS ? 'a_expirar' : 'ok' };
  });
}

export type EstadoInscricao = 'pendente' | 'aprovada' | 'rejeitada';

export type DadosInscricao = {
  nome: string;
  telefone: string;
  documento: string;
  cartaConducao: string;
  marca: string;
  modelo: string;
  ano: string;
  matricula: string;
  tipo: string;
  lugares: number;
  /** Preço por km proposto pelo motorista, em meticais. */
  porKmMzn: number;
  /** Só se o dono quiser o carro no sector de casamentos. */
  casamento?: PrecoCasamento;
  /** URI local de cada foto. */
  fotos: Record<FotoPedida, string>;
  /** URI local das fotos dos documentos que o motorista enviou. */
  fotosDocumentos?: Partial<Record<FotoDocumento, string>>;
  /** Data de fim de cada documento. */
  validades?: Partial<Record<Documento, Date>>;
  /**
   * Quem conduz o carro, quando não é o dono. O nome, o telefone e o BI de cima são do dono;
   * a carta de condução é de quem conduz.
   */
  motorista?: { nome: string; telefone: string };
  /** Código de convite de outro motorista (MOT-1234), para lhe pagar o prémio. */
  convite?: string;
};

/** O endereço local de uma foto escolhida no telemóvel ({ uri }), se houver. */
const uriDe = (f: unknown) => (f && typeof f === 'object' && 'uri' in f && typeof f.uri === 'string' ? f.uri : '');

/** Número de quem conduz este carro: o motorista indicado pelo dono, ou o próprio dono. */
export const telefoneCondutor = (i: Pick<DadosInscricao, 'telefone' | 'motorista'>) => i.motorista?.telefone ?? i.telefone;

export type Inscricao = DadosInscricao & {
  id: string;
  estado: EstadoInscricao;
  enviadaEm: Date;
};

type Inscricoes = {
  inscricoes: Inscricao[];
  submeter: (dados: DadosInscricao) => void;
  /** Aprova com o preço proposto, ou com outro se o ajustarmos. */
  aprovar: (id: string, porKmMzn: number) => void;
  rejeitar: (id: string) => void;
  /** O motorista renova um documento. */
  renovarDocumento: (id: string, documento: Documento, validade: Date) => void;
  /** Carros aprovados, prontos para aparecer na lista de escolha. */
  viaturasAprovadas: Viatura[];
};

const InscricoesContext = createContext<Inscricoes | null>(null);

// Protótipo: as inscrições ficam guardadas neste telemóvel. No produto final vão para o Supabase
// e a aprovação passa para o painel de gestão.
export function InscricoesProvider({ children }: { children: ReactNode }) {
  const [inscricoes, setInscricoes] = useGuardado<Inscricao[]>('chauffeur.inscricoes', []);
  const { perfil } = useSessao();

  // Com o servidor ligado, a aprovação feita no painel web chega a este telemóvel.
  const telefone = perfil?.telefone;
  useEffect(() => {
    if (!telefone) return;
    const ler = () =>
      lerEstadoInscricoes(telefone).then((lista) => {
        if (lista.length === 0) return;
        setInscricoes((atual) =>
          atual.map((i) => {
            const d = lista.find((x) => x.id === i.id);
            return d && (d.estado !== i.estado || d.por_km_mzn !== i.porKmMzn) ? { ...i, estado: d.estado, porKmMzn: d.por_km_mzn } : i;
          }),
        );
      });
    ler();
    const id = setInterval(ler, 60000);
    return () => clearInterval(id);
  }, [telefone, setInscricoes]);

  const valor = useMemo<Inscricoes>(() => {
    const mudarEstado = (id: string, estado: EstadoInscricao, porKmMzn?: number) =>
      setInscricoes((atual) => atual.map((i) => (i.id === id ? { ...i, estado, porKmMzn: porKmMzn ?? i.porKmMzn } : i)));

    return {
      inscricoes,
      submeter: (dados) => {
        const nova: Inscricao = { ...dados, id: `insc-${Date.now()}`, estado: 'pendente', enviadaEm: new Date() };
        setInscricoes((atual) => [nova, ...atual]);
        // As fotos sobem para o Supabase Storage (supabase/fotos.sql) e o painel recebe os caminhos.
        // Sem servidor, ou se falharem, a inscrição segue sem elas e as fotos ficam neste telemóvel.
        const { fotos, fotosDocumentos, ...semFotos } = nova;
        (async () => {
          const [carro, documentos] = await Promise.all([
            enviarFotos('inscricoes', `${nova.id}/carro`, { ...fotos, decorado: uriDe(nova.casamento?.foto) }),
            enviarFotos('inscricoes', `${nova.id}/documentos`, fotosDocumentos ?? {}),
          ]);
          enviarInscricao(nova, { ...semFotos, fotosServidor: { carro, documentos } });
        })();
      },
      aprovar: (id, porKmMzn) => mudarEstado(id, 'aprovada', porKmMzn),
      rejeitar: (id) => mudarEstado(id, 'rejeitada'),
      renovarDocumento: (id, documento, validade) =>
        setInscricoes((atual) => atual.map((i) => (i.id === id ? { ...i, validades: { ...i.validades, [documento]: validade } } : i))),
      viaturasAprovadas: inscricoes.filter((i) => i.estado === 'aprovada').map(paraViatura),
    };
  }, [inscricoes, setInscricoes]);

  return <InscricoesContext.Provider value={valor}>{children}</InscricoesContext.Provider>;
}

function paraViatura(i: Inscricao): Viatura {
  // O cliente vê e liga a quem conduz, não ao dono.
  const motorista: Motorista = { nome: i.motorista?.nome ?? i.nome, telefone: telefoneCondutor(i), matricula: i.matricula };
  return {
    id: i.id,
    marca: i.marca,
    modelo: i.modelo,
    tipo: i.tipo,
    lugares: i.lugares,
    porKmMzn: i.porKmMzn,
    chegadaMin: 8,
    foto: { uri: i.fotos.frente },
    galeria: FOTOS_PEDIDAS.filter((f) => f.id !== 'frente').map((f) => ({ foto: { uri: i.fotos[f.id] }, legenda: f.nome })),
    motorista,
    casamento: i.casamento,
  };
}

export function useInscricoes(): Inscricoes {
  const ctx = useContext(InscricoesContext);
  if (!ctx) throw new Error('useInscricoes tem de estar dentro de InscricoesProvider');
  return ctx;
}
