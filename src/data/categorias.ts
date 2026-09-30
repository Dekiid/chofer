import type { ImageSourcePropType } from 'react-native';

import type { Motorista } from './motorista';

export type Modo = 'motorista' | 'aluguer' | 'casamento';

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
  /** Preço por dia no aluguer sem motorista, em meticais; sem valor, o carro não aparece no aluguer. */
  porDiaMzn?: number;
  /** Preços para casamentos, com motorista; sem valor, o carro não aparece no sector de casamentos. */
  casamento?: PrecoCasamento;
};

/** Preço por casamento (o dia do evento), definido pelo dono do carro. */
export type PrecoCasamento = {
  semDecoracaoMzn: number;
  /** Inclui a decoração (flores, fitas, laços), feita e paga pelo dono do carro. */
  comDecoracaoMzn: number;
  /** O mesmo modelo decorado para casamento; sem ela, mostra-se a foto normal do carro. */
  foto?: ImageSourcePropType;
  credito?: CreditoFoto;
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

// Valores provisórios para o protótipo; os preços reais vêm do painel de gestão.
export const VIATURAS: Viatura[] = [
  { id: 'bmw-serie-5', foto: require('../../assets/carros/bmw-serie-5.jpg'), credito: commons('Alexander-93', 'CC BY-SA 4.0', 'BMW_G60_520d_1X7A1681.jpg'), marca: 'BMW', modelo: 'Série 5', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 90, chegadaMin: 4, porDiaMzn: 6500 },
  { id: 'mercedes-classe-e', foto: require('../../assets/carros/mercedes-classe-e.jpg'), credito: commons('Alexander-93', 'CC BY-SA 4.0', 'Mercedes-Benz_W214_1X7A1841.jpg'), marca: 'Mercedes-Benz', modelo: 'Classe E', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 95, chegadaMin: 5, porDiaMzn: 7000, casamento: { semDecoracaoMzn: 9500, comDecoracaoMzn: 13000, foto: require('../../assets/casamento/mercedes-classe-e.jpg'), credito: commons('Marcela', 'CC BY 2.5', 'Hochzeit-auto.jpg') } },
  { id: 'bmw-x5', foto: require('../../assets/carros/bmw-x5.jpg'), credito: commons('Mr.choppers', 'CC BY-SA 3.0', '2020_BMW_X5_xDrive_40i,_front_left.jpg'), marca: 'BMW', modelo: 'X5', tipo: 'SUV', lugares: 5, porKmMzn: 120, chegadaMin: 7, porDiaMzn: 9800, casamento: { semDecoracaoMzn: 12000, comDecoracaoMzn: 16000, foto: require('../../assets/casamento/bmw-x5.jpg'), credito: commons('Ritzo ten Cate', 'CC BY-SA 2.0', 'Belarussion_wedding_car.jpg') } },
  { id: 'range-rover-sport', foto: require('../../assets/carros/range-rover-sport.jpg'), credito: commons('Tokumeigakarinoaoshima', 'CC0', 'Land_Rover_RANGE_ROVER_SPORT_DYNAMIC_HSE_D300_(L461)_front.jpg'), marca: 'Range Rover', modelo: 'Sport', tipo: 'SUV de luxo', lugares: 5, porKmMzn: 150, chegadaMin: 9, porDiaMzn: 12500 },
  { id: 'mercedes-classe-s', foto: require('../../assets/carros/mercedes-classe-s.jpg'), credito: commons('Alexander-93', 'CC BY-SA 4.0', 'Mercedes-Benz_W223_1X7A7340.jpg'), marca: 'Mercedes-Benz', modelo: 'Classe S', tipo: 'Topo de gama', lugares: 4, porKmMzn: 180, chegadaMin: 12, porDiaMzn: 15000 },
  { id: 'vw-fusca', foto: require('../../assets/carros/vw-fusca.jpg'), credito: commons('Rutger van der Maar', 'CC BY 2.0', 'Volkswagen_Käfer_front.jpg'), marca: 'Volkswagen', modelo: 'Fusca', tipo: 'Clássico', lugares: 4, porKmMzn: 70, chegadaMin: 10, porDiaMzn: 4000, casamento: { semDecoracaoMzn: 6000, comDecoracaoMzn: 8500, foto: require('../../assets/casamento/vw-fusca.jpg'), credito: commons('Asurnipal', 'CC BY-SA 4.0', 'Dornbirn-Volkswagen_Beetle_wedding-02ASD.jpg') } },
];

export function commons(autor: string, licenca: string, ficheiro: string): CreditoFoto {
  return { autor, licenca, pagina: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(ficheiro)}` };
}

export function nomeViatura(v: Viatura): string {
  return `${v.marca} ${v.modelo}`;
}

export function formatarMzn(valor: number): string {
  return `${valor.toLocaleString('pt-PT')} MT`;
}
