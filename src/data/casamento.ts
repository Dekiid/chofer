import type { ImageSourcePropType } from 'react-native';

import { commons, type CreditoFoto, type PrecoCasamento } from './categorias';

export type Decoracao = 'com' | 'sem';

/** Fotos genéricas de carros de casamento decorados (créditos em assets/casamento/CREDITOS.md). */
export const FOTOS_CASAMENTO: { foto: ImageSourcePropType; credito: CreditoFoto }[] = [
  { foto: require('../../assets/casamento/casamento-rolls-royce.jpg'), credito: commons('JoachimKohler-HB', 'CC BY-SA 4.0', 'Rolls-Royce_als_Hochzeitsauto_in_Oldenburg_(2014).jpg') },
  { foto: require('../../assets/casamento/casamento-limusine.jpg'), credito: commons('Karelj', 'CC BY-SA 4.0', 'Wedding_car_centrum_Fier_Albania_2018_1.jpg') },
  { foto: require('../../assets/casamento/casamento-toyota.jpg'), credito: commons('Adoscam', 'CC BY-SA 4.0', 'Wedding_car_in_Cotonou_Bénin.jpg') },
  { foto: require('../../assets/casamento/casamento-rolls-fitas.jpg'), credito: commons('allen watkin', 'CC BY-SA 2.0', 'Rolls_wedding_car_(3542687818).jpg') },
];

export function precoCasamento(preco: PrecoCasamento, decoracao: Decoracao): number {
  return decoracao === 'com' ? preco.comDecoracaoMzn : preco.semDecoracaoMzn;
}
