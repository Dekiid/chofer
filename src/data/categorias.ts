export type Modo = 'motorista' | 'aluguer';

export type Viatura = {
  id: string;
  marca: string;
  modelo: string;
  tipo: string;
  lugares: number;
  /** Preço por quilómetro, em meticais. */
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
export const VIATURAS: Viatura[] = [
  { id: 'bmw-serie-5', marca: 'BMW', modelo: 'Série 5', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 90, chegadaMin: 4 },
  { id: 'mercedes-classe-e', marca: 'Mercedes-Benz', modelo: 'Classe E', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 95, chegadaMin: 5 },
  { id: 'bmw-x5', marca: 'BMW', modelo: 'X5', tipo: 'SUV', lugares: 5, porKmMzn: 120, chegadaMin: 7 },
  { id: 'range-rover-sport', marca: 'Range Rover', modelo: 'Sport', tipo: 'SUV de luxo', lugares: 5, porKmMzn: 150, chegadaMin: 9 },
  { id: 'mercedes-classe-s', marca: 'Mercedes-Benz', modelo: 'Classe S', tipo: 'Topo de gama', lugares: 4, porKmMzn: 180, chegadaMin: 12 },
];

export function nomeViatura(v: Viatura): string {
  return `${v.marca} ${v.modelo}`;
}

export const CATEGORIAS_ALUGUER: CategoriaAluguer[] = [
  { id: 'executivo-dia', nome: 'Executivo', descricao: 'Sedan premium, sem motorista', lugares: 5, porDiaMzn: 6500 },
  { id: 'suv-dia', nome: 'SUV', descricao: 'SUV 4x4, sem motorista', lugares: 7, porDiaMzn: 9800 },
];

export function formatarMzn(valor: number): string {
  return `${valor.toLocaleString('pt-PT')} MT`;
}
