import type { ImageSourcePropType } from 'react-native';

import type { Motorista } from './motorista';

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
  /** Foto principal: local em assets/carros (créditos em CREDITOS.md) ou a foto de frente enviada pelo motorista. */
  foto: ImageSourcePropType;
  /** Só nas fotos do Wikimedia; as fotos dos motoristas são deles. */
  credito?: CreditoFoto;
  /** Motorista do carro; nos modelos de exemplo fica o motorista simulado. */
  motorista?: Motorista;
};

export type CreditoFoto = {
  autor: string;
  licenca: string;
  /** Página do ficheiro no Wikimedia Commons. */
  pagina: string;
};

/** Parte do valor total de cada viagem que fica para o Chauffeur. */
export const COMISSAO = 0.14;

/** Tipos que o motorista escolhe na inscrição, com o preço por km sugerido para ele começar. */
export const TIPOS_VIATURA = [
  { tipo: 'Sedan executivo', porKmMzn: 90 },
  { tipo: 'SUV', porKmMzn: 120 },
  { tipo: 'SUV de luxo', porKmMzn: 150 },
  { tipo: 'Topo de gama', porKmMzn: 180 },
  { tipo: 'Clássico', porKmMzn: 70 },
] as const;

export type CategoriaAluguer = {
  id: string;
  nome: string;
  descricao: string;
  lugares: number;
  porDiaMzn: number;
};

// Valores provisórios para o protótipo; os preços reais vêm do painel de gestão.
export const VIATURAS: Viatura[] = [
  { id: 'bmw-serie-5', foto: require('../../assets/carros/bmw-serie-5.jpg'), credito: commons('Alexander-93', 'CC BY-SA 4.0', 'BMW_G60_520d_1X7A1681.jpg'), marca: 'BMW', modelo: 'Série 5', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 90, chegadaMin: 4 },
  { id: 'mercedes-classe-e', foto: require('../../assets/carros/mercedes-classe-e.jpg'), credito: commons('Alexander-93', 'CC BY-SA 4.0', 'Mercedes-Benz_W214_1X7A1841.jpg'), marca: 'Mercedes-Benz', modelo: 'Classe E', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 95, chegadaMin: 5 },
  { id: 'bmw-x5', foto: require('../../assets/carros/bmw-x5.jpg'), credito: commons('Tokumeigakarinoaoshima', 'CC BY-SA 4.0', 'BMW_X5_xDrive35d_(G05)_front.jpg'), marca: 'BMW', modelo: 'X5', tipo: 'SUV', lugares: 5, porKmMzn: 120, chegadaMin: 7 },
  { id: 'range-rover-sport', foto: require('../../assets/carros/range-rover-sport.jpg'), credito: commons('Tokumeigakarinoaoshima', 'CC0', 'Land_Rover_RANGE_ROVER_SPORT_DYNAMIC_HSE_D300_(L461)_front.jpg'), marca: 'Range Rover', modelo: 'Sport', tipo: 'SUV de luxo', lugares: 5, porKmMzn: 150, chegadaMin: 9 },
  { id: 'mercedes-classe-s', foto: require('../../assets/carros/mercedes-classe-s.jpg'), credito: commons('Alexander-93', 'CC BY-SA 4.0', 'Mercedes-Benz_W223_1X7A7340.jpg'), marca: 'Mercedes-Benz', modelo: 'Classe S', tipo: 'Topo de gama', lugares: 4, porKmMzn: 180, chegadaMin: 12 },
  { id: 'vw-fusca', foto: require('../../assets/carros/vw-fusca.jpg'), credito: commons('Rutger van der Maar', 'CC BY 2.0', 'Volkswagen_Käfer_front.jpg'), marca: 'Volkswagen', modelo: 'Fusca', tipo: 'Clássico', lugares: 4, porKmMzn: 70, chegadaMin: 10 },
];

function commons(autor: string, licenca: string, ficheiro: string): CreditoFoto {
  return { autor, licenca, pagina: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(ficheiro)}` };
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
