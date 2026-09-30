import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Viatura } from '@/data/categorias';
import type { Motorista } from '@/data/motorista';

/** Fotos que pedimos a cada motorista; a de frente é a que aparece na app. */
export const FOTOS_PEDIDAS = [
  { id: 'frente', nome: 'Frente', dica: 'De frente, na diagonal, com o carro inteiro' },
  { id: 'lateral', nome: 'Lateral', dica: 'De lado, com as duas rodas visíveis' },
  { id: 'traseira', nome: 'Traseira', dica: 'De trás, com a matrícula visível' },
  { id: 'interior', nome: 'Interior', dica: 'Bancos de trás, onde o cliente se senta' },
] as const;

export type FotoPedida = (typeof FOTOS_PEDIDAS)[number]['id'];

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
  /** URI local de cada foto. */
  fotos: Record<FotoPedida, string>;
};

export type Inscricao = DadosInscricao & {
  id: string;
  estado: EstadoInscricao;
  enviadaEm: Date;
  /** Definido por nós na aprovação. */
  porKmMzn?: number;
};

type Inscricoes = {
  inscricoes: Inscricao[];
  submeter: (dados: DadosInscricao) => void;
  aprovar: (id: string, porKmMzn: number) => void;
  rejeitar: (id: string) => void;
  /** Carros aprovados, prontos para aparecer na lista de escolha. */
  viaturasAprovadas: Viatura[];
};

const InscricoesContext = createContext<Inscricoes | null>(null);

// Protótipo: as inscrições ficam só na memória do telemóvel. No produto final vão para o Supabase
// e a aprovação passa para o painel de gestão.
export function InscricoesProvider({ children }: { children: ReactNode }) {
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);

  const valor = useMemo<Inscricoes>(() => {
    const mudarEstado = (id: string, estado: EstadoInscricao, porKmMzn?: number) =>
      setInscricoes((atual) => atual.map((i) => (i.id === id ? { ...i, estado, porKmMzn: porKmMzn ?? i.porKmMzn } : i)));

    return {
      inscricoes,
      submeter: (dados) =>
        setInscricoes((atual) => [{ ...dados, id: `insc-${Date.now()}`, estado: 'pendente', enviadaEm: new Date() }, ...atual]),
      aprovar: (id, porKmMzn) => mudarEstado(id, 'aprovada', porKmMzn),
      rejeitar: (id) => mudarEstado(id, 'rejeitada'),
      viaturasAprovadas: inscricoes.filter((i) => i.estado === 'aprovada').map(paraViatura),
    };
  }, [inscricoes]);

  return <InscricoesContext.Provider value={valor}>{children}</InscricoesContext.Provider>;
}

function paraViatura(i: Inscricao): Viatura {
  const motorista: Motorista = { nome: i.nome, telefone: i.telefone, matricula: i.matricula };
  return {
    id: i.id,
    marca: i.marca,
    modelo: i.modelo,
    tipo: i.tipo,
    lugares: i.lugares,
    porKmMzn: i.porKmMzn ?? 0,
    chegadaMin: 8,
    foto: { uri: i.fotos.frente },
    motorista,
  };
}

export function useInscricoes(): Inscricoes {
  const ctx = useContext(InscricoesContext);
  if (!ctx) throw new Error('useInscricoes tem de estar dentro de InscricoesProvider');
  return ctx;
}
