export type Modo = 'motorista' | 'aluguer';

export type CategoriaMotorista = {
  id: string;
  nome: string;
  descricao: string;
  lugares: number;
  /** Tarifa em meticais: valor fixo inicial mais valor por km. */
  baseMzn: number;
  porKmMzn: number;
  chegadaMin: number;
};

export type CategoriaAluguer = {
  id: string;
  nome: string;
  descricao: string;
  lugares: number;
  porDiaMzn: number;
};

// Valores provisórios para o protótipo; os preços reais vêm do painel de gestão.
export const CATEGORIAS_MOTORISTA: CategoriaMotorista[] = [
  { id: 'executivo', nome: 'Executivo', descricao: 'Sedan premium', lugares: 4, baseMzn: 250, porKmMzn: 75, chegadaMin: 4 },
  { id: 'suv', nome: 'SUV', descricao: 'Mais espaço e bagagem', lugares: 6, baseMzn: 350, porKmMzn: 105, chegadaMin: 7 },
  { id: 'luxo', nome: 'Luxo', descricao: 'Topo de gama', lugares: 4, baseMzn: 600, porKmMzn: 180, chegadaMin: 12 },
];

export const CATEGORIAS_ALUGUER: CategoriaAluguer[] = [
  { id: 'executivo-dia', nome: 'Executivo', descricao: 'Sedan premium, sem motorista', lugares: 5, porDiaMzn: 6500 },
  { id: 'suv-dia', nome: 'SUV', descricao: 'SUV 4x4, sem motorista', lugares: 7, porDiaMzn: 9800 },
];

export function formatarMzn(valor: number): string {
  return `${valor.toLocaleString('pt-PT')} MT`;
}
