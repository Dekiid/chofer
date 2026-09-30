export type Lugar = {
  id: string;
  nome: string;
  zona: string;
  latitude: number;
  longitude: number;
};

export const LOCALIZACAO_PADRAO: Lugar = {
  id: 'atual',
  nome: 'A tua localização',
  zona: 'Baixa, Maputo',
  latitude: -25.9692,
  longitude: 32.5732,
};

// Lista provisória de destinos frequentes; mais tarde vem de uma pesquisa de moradas (Google Places).
export const LUGARES: Lugar[] = [
  { id: 'aeroporto', nome: 'Aeroporto Internacional de Maputo', zona: 'Maputo', latitude: -25.9208, longitude: 32.5726 },
  { id: 'polana', nome: 'Hotel Polana Serena', zona: 'Polana, Maputo', latitude: -25.9686, longitude: 32.5977 },
  { id: 'marginal', nome: 'Avenida Marginal', zona: 'Costa do Sol, Maputo', latitude: -25.9366, longitude: 32.6199 },
  { id: 'baia-mall', nome: 'Baía Mall', zona: 'Marginal, Maputo', latitude: -25.9573, longitude: 32.6045 },
  { id: 'julius', nome: 'Avenida Julius Nyerere', zona: 'Sommerschield, Maputo', latitude: -25.9535, longitude: 32.5957 },
  { id: 'fortaleza', nome: 'Fortaleza de Maputo', zona: 'Baixa, Maputo', latitude: -25.9729, longitude: 32.5711 },
  { id: 'matola-shopping', nome: 'Matola Shopping', zona: 'Matola', latitude: -25.9531, longitude: 32.4697 },
  { id: 'matola-rio', nome: 'Matola Rio', zona: 'Matola', latitude: -25.9950, longitude: 32.4452 },
  { id: 'machava', nome: 'Estádio da Machava', zona: 'Machava, Matola', latitude: -25.9219, longitude: 32.5022 },
];

export function pesquisarLugares(texto: string): Lugar[] {
  const t = normalizar(texto.trim());
  if (!t) return LUGARES;
  return LUGARES.filter((l) => normalizar(`${l.nome} ${l.zona}`).includes(t));
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
