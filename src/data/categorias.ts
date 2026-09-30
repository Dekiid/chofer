export type Modo = 'motorista' | 'aluguer';

export type Categoria = {
  id: string;
  nome: string;
  descricao: string;
  lugares: number;
  /** Com motorista: preço estimado da viagem. Aluguer: preço por dia. Em meticais. */
  precoMzn: number;
  chegadaMin?: number;
};

// Valores provisórios para o protótipo; os preços reais vêm do painel de gestão.
export const CATEGORIAS: Record<Modo, Categoria[]> = {
  motorista: [
    { id: 'executivo', nome: 'Executivo', descricao: 'Sedan premium', lugares: 4, precoMzn: 850, chegadaMin: 4 },
    { id: 'suv', nome: 'SUV', descricao: 'Mais espaço e bagagem', lugares: 6, precoMzn: 1200, chegadaMin: 7 },
    { id: 'luxo', nome: 'Luxo', descricao: 'Topo de gama', lugares: 4, precoMzn: 2100, chegadaMin: 12 },
  ],
  aluguer: [
    { id: 'executivo-dia', nome: 'Executivo', descricao: 'Sedan premium, sem motorista', lugares: 5, precoMzn: 6500 },
    { id: 'suv-dia', nome: 'SUV', descricao: 'SUV 4x4, sem motorista', lugares: 7, precoMzn: 9800 },
  ],
};

export function formatarMzn(valor: number): string {
  return `${valor.toLocaleString('pt-PT')} MT`;
}
