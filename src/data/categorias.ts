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
  /** Nome do ficheiro da foto no Wikimedia Commons (licença livre, autor na página do ficheiro). */
  foto: string;
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
  { id: 'bmw-serie-5', foto: 'BMW_G60_520d_1X7A1681.jpg', marca: 'BMW', modelo: 'Série 5', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 90, chegadaMin: 4 },
  { id: 'mercedes-classe-e', foto: 'Mercedes-Benz_W214_1X7A1841.jpg', marca: 'Mercedes-Benz', modelo: 'Classe E', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 95, chegadaMin: 5 },
  { id: 'bmw-x5', foto: 'BMW_G05_IMG_2670.jpg', marca: 'BMW', modelo: 'X5', tipo: 'SUV', lugares: 5, porKmMzn: 120, chegadaMin: 7 },
  { id: 'range-rover-sport', foto: 'Land_Rover_Range_Rover_Sport_L461_Varesine_Blue_(4).jpg', marca: 'Range Rover', modelo: 'Sport', tipo: 'SUV de luxo', lugares: 5, porKmMzn: 150, chegadaMin: 9 },
  { id: 'mercedes-classe-s', foto: 'Mercedes-Benz_W223_1X7A7340.jpg', marca: 'Mercedes-Benz', modelo: 'Classe S', tipo: 'Topo de gama', lugares: 4, porKmMzn: 180, chegadaMin: 12 },
];

// Special:FilePath redireciona para a imagem no tamanho pedido.
export function urlFoto(v: Viatura, largura = 1024): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(v.foto)}?width=${largura}`;
}

export function paginaFoto(v: Viatura): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(v.foto)}`;
}

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
