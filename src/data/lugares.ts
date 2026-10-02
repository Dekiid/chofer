import { aoMudarPais, paisAtual, type CodigoPais } from './paises';
import { t } from '@/i18n';

export type Lugar = {
  id: string;
  nome: string;
  zona: string;
  latitude: number;
  longitude: number;
};

// Ponto de partida quando ainda não há GPS: o centro da cidade do país da conta (muda com o país).
export const LOCALIZACAO_PADRAO: Lugar = {
  id: 'atual',
  nome: 'A tua localização',
  zona: 'Baixa, Maputo',
  latitude: -25.9692,
  longitude: 32.5732,
};

const PADRAO_POR_PAIS: Record<CodigoPais, Omit<Lugar, 'id' | 'nome'>> = {
  MZ: { zona: 'Baixa, Maputo', latitude: -25.9692, longitude: 32.5732 },
  AO: { zona: 'Baixa, Luanda', latitude: -8.8147, longitude: 13.2302 },
};

// Lista provisória de destinos frequentes por país; mais tarde vem de uma pesquisa de moradas (Google Places).
export const TODOS_LUGARES: (Lugar & { pais: CodigoPais })[] = [
  { pais: 'MZ', id: 'aeroporto', nome: 'Aeroporto Internacional de Maputo', zona: 'Maputo', latitude: -25.9208, longitude: 32.5726 },
  { pais: 'MZ', id: 'polana', nome: 'Hotel Polana Serena', zona: 'Polana, Maputo', latitude: -25.9686, longitude: 32.5977 },
  { pais: 'MZ', id: 'marginal', nome: 'Avenida Marginal', zona: 'Costa do Sol, Maputo', latitude: -25.9366, longitude: 32.6199 },
  { pais: 'MZ', id: 'baia-mall', nome: 'Baía Mall', zona: 'Marginal, Maputo', latitude: -25.9573, longitude: 32.6045 },
  { pais: 'MZ', id: 'julius', nome: 'Avenida Julius Nyerere', zona: 'Sommerschield, Maputo', latitude: -25.9535, longitude: 32.5957 },
  { pais: 'MZ', id: 'fortaleza', nome: 'Fortaleza de Maputo', zona: 'Baixa, Maputo', latitude: -25.9729, longitude: 32.5711 },
  { pais: 'MZ', id: 'matola-shopping', nome: 'Matola Shopping', zona: 'Matola', latitude: -25.9531, longitude: 32.4697 },
  { pais: 'MZ', id: 'matola-rio', nome: 'Matola Rio', zona: 'Matola', latitude: -25.9950, longitude: 32.4452 },
  { pais: 'MZ', id: 'machava', nome: 'Estádio da Machava', zona: 'Machava, Matola', latitude: -25.9219, longitude: 32.5022 },
  { pais: 'AO', id: 'aeroporto-luanda', nome: 'Aeroporto 4 de Fevereiro', zona: 'Luanda', latitude: -8.8584, longitude: 13.2312 },
  { pais: 'AO', id: 'epic-sana', nome: 'Hotel Epic Sana', zona: 'Ingombota, Luanda', latitude: -8.8137, longitude: 13.2348 },
  { pais: 'AO', id: 'marginal-luanda', nome: 'Marginal de Luanda', zona: 'Baixa, Luanda', latitude: -8.8105, longitude: 13.2330 },
  { pais: 'AO', id: 'ilha-luanda', nome: 'Ilha de Luanda', zona: 'Luanda', latitude: -8.7860, longitude: 13.2560 },
  { pais: 'AO', id: 'belas-shopping', nome: 'Belas Shopping', zona: 'Talatona, Luanda', latitude: -8.9177, longitude: 13.1869 },
  { pais: 'AO', id: 'fortaleza-sao-miguel', nome: 'Fortaleza de São Miguel', zona: 'Baixa, Luanda', latitude: -8.8079, longitude: 13.2234 },
  { pais: 'AO', id: 'talatona', nome: 'Centro de Convenções de Talatona', zona: 'Talatona, Luanda', latitude: -8.9200, longitude: 13.1830 },
  { pais: 'AO', id: 'mausoleu', nome: 'Memorial Agostinho Neto', zona: 'Praia do Bispo, Luanda', latitude: -8.8257, longitude: 13.2471 },
  { pais: 'AO', id: 'kilamba', nome: 'Centralidade do Kilamba', zona: 'Kilamba, Luanda', latitude: -8.9965, longitude: 13.2745 },
];

/** Os lugares do país da conta. A lista muda no lugar quando muda o país. */
export const LUGARES: Lugar[] = [];

function aplicarPais() {
  const pais = paisAtual().codigo;
  Object.assign(LOCALIZACAO_PADRAO, PADRAO_POR_PAIS[pais]);
  LUGARES.splice(0, LUGARES.length, ...TODOS_LUGARES.filter((l) => l.pais === pais).map(({ pais: _, ...l }) => l));
}
aplicarPais();
aoMudarPais(aplicarPais);

/** Nome do lugar para mostrar: a localização do telemóvel aparece na língua escolhida. */
export function nomeLugar(l: Lugar): string {
  return l.id === LOCALIZACAO_PADRAO.id ? t(LOCALIZACAO_PADRAO.nome) : l.nome;
}

/** Zona do lugar para mostrar, com o mesmo cuidado para a localização atual. */
export function zonaLugar(l: Lugar): string {
  return l.id === LOCALIZACAO_PADRAO.id && l.zona === 'Localização atual' ? t('Localização atual') : l.zona;
}

export function pesquisarLugares(texto: string): Lugar[] {
  const t = normalizar(texto.trim());
  if (!t) return LUGARES;
  return LUGARES.filter((l) => normalizar(`${l.nome} ${l.zona}`).includes(t));
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
