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
  /** Foto já recortada, só o carro sem fundo (PNG/WebP transparente); aparece solta no ecrã, sem moldura. */
  semFundo?: boolean;
  /** Só nas fotos do Wikimedia; as fotos dos motoristas são deles. */
  credito?: CreditoFoto;
  /** Mais fotos para a galeria: interior e outros ângulos. */
  galeria?: FotoGaleria[];
  /** Motorista do carro; nos modelos de exemplo fica o motorista simulado. */
  motorista?: Motorista;
  /** Preço por dia no aluguer sem motorista, em meticais; sem valor, o carro não aparece no aluguer. */
  porDiaMzn?: number;
  /** Preços para casamentos, com motorista; sem valor, o carro não aparece no sector de casamentos. */
  casamento?: PrecoCasamento;
  /** Carros de casamento que não fazem viagens nem aluguer. */
  soCasamento?: boolean;
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

export type FotoGaleria = {
  foto: ImageSourcePropType;
  /** O que a foto mostra, por exemplo "Interior" ou "Traseira". */
  legenda: string;
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
  { id: 'bmw-serie-5', foto: require('../../assets/carros/bmw-serie-5.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/bmw-serie-5-interior.jpg'), legenda: 'Interior', credito: commons('Ethan Llamas', 'CC BY-SA 4.0', 'BMW_520i_G60_Oxide_Grey_Metallic_03.jpg') }, { foto: require('../../assets/carros/galeria/bmw-serie-5-traseira.jpg'), legenda: 'Traseira', credito: commons('Alexander-93', 'CC BY-SA 4.0', 'BMW_G60_550e_1X7A1828.jpg') }], credito: commons('Alexander-93', 'CC BY-SA 4.0', 'BMW_G60_520d_1X7A1681.jpg'), marca: 'BMW', modelo: 'Série 5', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 90, chegadaMin: 4, porDiaMzn: 6500 },
  { id: 'mercedes-classe-e', foto: require('../../assets/carros/mercedes-classe-e.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/mercedes-classe-e-interior.jpg'), legenda: 'Interior', credito: commons('Tokumeigakarinoaoshima', 'CC BY-SA 4.0', 'Mercedes-Benz_E_200_AVANTGARDE_(4AA-214050C)_interior.jpg') }, { foto: require('../../assets/carros/galeria/mercedes-classe-e-traseira.jpg'), legenda: 'Traseira', credito: commons('Alexander-93', 'CC BY-SA 4.0', 'Mercedes-Benz_W214_1X7A1843.jpg') }], credito: commons('Alexander-93', 'CC BY-SA 4.0', 'Mercedes-Benz_W214_1X7A1841.jpg'), marca: 'Mercedes-Benz', modelo: 'Classe E', tipo: 'Sedan executivo', lugares: 4, porKmMzn: 95, chegadaMin: 5, porDiaMzn: 7000, casamento: { semDecoracaoMzn: 9500, comDecoracaoMzn: 13000, foto: require('../../assets/casamento/mercedes-classe-e.jpg'), credito: commons('Marcela', 'CC BY 2.5', 'Hochzeit-auto.jpg') } },
  { id: 'bmw-x5', foto: require('../../assets/carros/bmw-x5.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/bmw-x5-interior.jpg'), legenda: 'Interior', credito: commons('Ethan Llamas', 'CC BY-SA 4.0', 'BMW_X5_G05_LCI_xDrive50e_PHEV_M_Sport_Package_Brooklyn_Grey_Metallic_03.jpg') }, { foto: require('../../assets/carros/galeria/bmw-x5-bancos-de-tras.jpg'), legenda: 'Bancos de trás', credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'BMW_G05_X5_xDrive40i_M_Sport_Merino_Leather_Coffee_(10).jpg') }, { foto: require('../../assets/carros/galeria/bmw-x5-traseira.jpg'), legenda: 'Traseira', credito: commons('Jengtingchen', 'CC BY-SA 4.0', 'BMW_X5_MK4_rear.jpg') }], credito: commons('Mr.choppers', 'CC BY-SA 3.0', '2020_BMW_X5_xDrive_40i,_front_left.jpg'), marca: 'BMW', modelo: 'X5', tipo: 'SUV', lugares: 5, porKmMzn: 120, chegadaMin: 7, porDiaMzn: 9800, casamento: { semDecoracaoMzn: 12000, comDecoracaoMzn: 16000, foto: require('../../assets/casamento/bmw-x5.jpg'), credito: commons('Ritzo ten Cate', 'CC BY-SA 2.0', 'Belarussion_wedding_car.jpg') } },
  { id: 'toyota-land-cruiser', foto: require('../../assets/carros/toyota-land-cruiser.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/toyota-land-cruiser-traseira.jpg'), legenda: 'Traseira', credito: commons('Firzafp', 'CC BY-SA 4.0', 'Toyota_Land_Cruiser_TNGA_-_GR_Sport_(J300)_(rear)_in_Putri_Pinang_Masak_Park,_Jambi_City_(cropped).jpg') }], credito: commons('Авто Плюс Новости', 'CC BY 3.0', '2021_Toyota_Land_Cruiser_300_(Russia)_front_view.jpg'), marca: 'Toyota', modelo: 'Land Cruiser 300', tipo: 'SUV', lugares: 7, porKmMzn: 125, chegadaMin: 8, porDiaMzn: 11000 },
  { id: 'mercedes-gle', foto: require('../../assets/carros/mercedes-gle.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/mercedes-gle-interior.jpg'), legenda: 'Interior', credito: commons('Dinkun Chen', 'CC BY-SA 4.0', 'MERCEDES-BENZ_GLE_(W167)_CHINA_VERSION_INTERIOR.jpg') }], credito: commons('Vauxford', 'CC BY-SA 4.0', '2019_Mercedes-Benz_GLE_450_AMG_Line_Premium+_4MATIC_3.0_Front.jpg'), marca: 'Mercedes-Benz', modelo: 'GLE', tipo: 'SUV', lugares: 5, porKmMzn: 130, chegadaMin: 8, porDiaMzn: 10500 },
  { id: 'range-rover-sport', foto: require('../../assets/carros/range-rover-sport.webp'), semFundo: true, credito: commons('Tokumeigakarinoaoshima', 'CC0', 'Land_Rover_RANGE_ROVER_SPORT_DYNAMIC_HSE_D300_(L461)_front.jpg'), marca: 'Range Rover', modelo: 'Sport', tipo: 'SUV de luxo', lugares: 5, porKmMzn: 150, chegadaMin: 9, porDiaMzn: 12500 },
  { id: 'audi-a8', foto: require('../../assets/carros/audi-a8.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/audi-a8-interior.jpg'), legenda: 'Interior', credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'Audi_A8_L_D5_Black_Valcona_Interior_with_Piano_Black_Inlay_(5).jpg') }, { foto: require('../../assets/carros/galeria/audi-a8-bancos-de-tras.jpg'), legenda: 'Bancos de trás', credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'Audi_A8_L_D5_Black_Valcona_Interior_with_Piano_Black_Inlay_(35).jpg') }, { foto: require('../../assets/carros/galeria/audi-a8-traseira.jpg'), legenda: 'Traseira', credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'Audi_A8_L_50_TDI_Quattro_D5_Terra_Gray_(10).jpg') }], credito: commons('Mr.choppers', 'CC BY-SA 4.0', '2019_Audi_A8L_55_quattro_in_Glacier_White,_front_left.jpg'), marca: 'Audi', modelo: 'A8 L', tipo: 'Topo de gama', lugares: 4, porKmMzn: 165, chegadaMin: 10, porDiaMzn: 13500 },
  { id: 'bmw-serie-7', foto: require('../../assets/carros/bmw-serie-7.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/bmw-serie-7-interior.jpg'), legenda: 'Interior', credito: commons('RpM Tartar', 'CC BY-SA 4.0', 'BMW_G70\'s_front_Interior.jpg') }, { foto: require('../../assets/carros/galeria/bmw-serie-7-bancos-de-tras.jpg'), legenda: 'Bancos de trás', credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'BMW_G70_BMW_Individual_Merino_Leather_Amarone_(42).jpg') }, { foto: require('../../assets/carros/galeria/bmw-serie-7-traseira.jpg'), legenda: 'Traseira', credito: commons('Alexander-93', 'CC BY-SA 4.0', 'BMW_7-Series_(G70)_750e_1X7A1899.jpg') }], credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'BMW_G70_740i_sDrive_M_Sport_Black_Sapphire_Metallic_(132).jpg'), marca: 'BMW', modelo: 'Série 7', tipo: 'Topo de gama', lugares: 4, porKmMzn: 170, chegadaMin: 11, porDiaMzn: 14000 },
  { id: 'mercedes-classe-s', foto: require('../../assets/carros/mercedes-classe-s.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/mercedes-classe-s-traseira.jpg'), legenda: 'Traseira', credito: commons('MrWalkr', 'CC BY-SA 4.0', 'W223_Rear.jpg') }], credito: commons('Alexander Migl', 'CC BY-SA 4.0', 'Mercedes-Benz_W223_580_e_IAA_2021_1X7A0258.jpg'), marca: 'Mercedes-Benz', modelo: 'Classe S', tipo: 'Topo de gama', lugares: 4, porKmMzn: 180, chegadaMin: 12, porDiaMzn: 15000 },
  { id: 'range-rover', foto: require('../../assets/carros/range-rover.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/range-rover-interior.jpg'), legenda: 'Interior', credito: commons('Damian B Oh', 'CC BY-SA 4.0', 'Land_Rover_Range_Rover_Autobiography_L460_Deep_Garnet_(1).jpg') }, { foto: require('../../assets/carros/galeria/range-rover-traseira.jpg'), legenda: 'Traseira', credito: commons('Ethan Llamas', 'CC BY-SA 4.0', 'Range_Rover_L460_HSE_Belgravia_Green_Metallic_-_rear.jpg') }], credito: commons('Ethan Llamas', 'CC BY-SA 4.0', 'Range_Rover_L460_HSE_Belgravia_Green_Metallic_-_front.jpg'), marca: 'Range Rover', modelo: 'Autobiography', tipo: 'Topo de gama', lugares: 5, porKmMzn: 200, chegadaMin: 14, porDiaMzn: 18000 },
  { id: 'vw-fusca', foto: require('../../assets/carros/vw-fusca.webp'), semFundo: true, galeria: [{ foto: require('../../assets/carros/galeria/vw-fusca-traseira.jpg'), legenda: 'Traseira', credito: commons('Rutger van der Maar', 'CC BY 2.0', 'Volkswagen_1300_Käfer_rear.jpg') }], credito: commons('Tobias Nordhausen', 'CC BY 2.0', 'VW_Käfer_(7527372652).jpg'), marca: 'Volkswagen', modelo: 'Fusca', tipo: 'Clássico', lugares: 4, porKmMzn: 70, chegadaMin: 10, porDiaMzn: 4000, casamento: { semDecoracaoMzn: 6000, comDecoracaoMzn: 8500, foto: require('../../assets/casamento/vw-fusca.jpg'), credito: commons('Asurnipal', 'CC BY-SA 4.0', 'Dornbirn-Volkswagen_Beetle_wedding-02ASD.jpg') } },
  // Carros de casamento, com foto genérica já decorada.
  casamentoGenerico('rolls-royce-classico', 'Rolls-Royce', 'clássico', 'Clássico de luxo', 4, 28000, 32000, require('../../assets/casamento/rolls-royce-classico.jpg'), commons('JoachimKohler-HB', 'CC BY-SA 4.0', 'Rolls-Royce_als_Hochzeitsauto_in_Oldenburg_(2014).jpg')),
  casamentoGenerico('lincoln-limusine', 'Lincoln', 'Town Car limusine', 'Limusine', 8, 22000, 26000, require('../../assets/casamento/lincoln-limusine.jpg'), commons('Karelj', 'CC BY-SA 4.0', 'Wedding_car_centrum_Fier_Albania_2018_1.jpg')),
  casamentoGenerico('toyota-venza', 'Toyota', 'Venza', 'SUV', 5, 7000, 9500, require('../../assets/casamento/toyota-venza.jpg'), commons('Adoscam', 'CC BY-SA 4.0', 'Wedding_car_in_Cotonou_Bénin.jpg')),
];

function casamentoGenerico(
  id: string,
  marca: string,
  modelo: string,
  tipo: string,
  lugares: number,
  semDecoracaoMzn: number,
  comDecoracaoMzn: number,
  foto: ImageSourcePropType,
  credito: CreditoFoto,
): Viatura {
  return { id, marca, modelo, tipo, lugares, porKmMzn: 0, chegadaMin: 0, foto, credito, soCasamento: true, casamento: { semDecoracaoMzn, comDecoracaoMzn, foto, credito } };
}

export function commons(autor: string, licenca: string, ficheiro: string): CreditoFoto {
  return { autor, licenca, pagina: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(ficheiro)}` };
}

export function nomeViatura(v: Viatura): string {
  return `${v.marca} ${v.modelo}`;
}

export function formatarMzn(valor: number): string {
  return `${valor.toLocaleString('pt-PT')} MT`;
}
