import type { Viatura } from '@/data/categorias';

/** Proporções de cada tipo de carro genérico, em metros aproximados. */
export type Forma = {
  comprimento: number;
  largura: number;
  alturaChao: number;
  alturaCintura: number;
  alturaTejadilho: number;
  /** Onde acaba o capô e começa o para-brisas, a partir da frente (0 a 1). */
  fimCapo: number;
  /** Onde começa o vidro traseiro (0 a 1). */
  inicioTraseira: number;
  /** Onde acaba o vidro traseiro e começa a mala (0 a 1). */
  fimTraseira: number;
  raioRoda: number;
};

export const FORMAS: Record<'sedan' | 'suv' | 'luxo', Forma> = {
  sedan: {
    comprimento: 4.9, largura: 1.85, alturaChao: 0.3, alturaCintura: 0.95, alturaTejadilho: 1.42,
    fimCapo: 0.3, inicioTraseira: 0.62, fimTraseira: 0.8, raioRoda: 0.34,
  },
  suv: {
    comprimento: 4.9, largura: 1.95, alturaChao: 0.42, alturaCintura: 1.15, alturaTejadilho: 1.75,
    fimCapo: 0.26, inicioTraseira: 0.8, fimTraseira: 0.95, raioRoda: 0.4,
  },
  luxo: {
    comprimento: 5.25, largura: 1.9, alturaChao: 0.3, alturaCintura: 0.98, alturaTejadilho: 1.48,
    fimCapo: 0.32, inicioTraseira: 0.64, fimTraseira: 0.82, raioRoda: 0.36,
  },
};

// Modelos genéricos: cada viatura usa uma forma e uma cor, não o desenho real da marca.
const APARENCIA: Record<string, { forma: keyof typeof FORMAS; cor: string }> = {
  'bmw-serie-5': { forma: 'sedan', cor: '#1F2A44' },
  'mercedes-classe-e': { forma: 'sedan', cor: '#C9CCD1' },
  'bmw-x5': { forma: 'suv', cor: '#F2F2F2' },
  'range-rover-sport': { forma: 'suv', cor: '#2F3A2F' },
  'mercedes-classe-s': { forma: 'luxo', cor: '#111111' },
};

export function aparencia(v: Viatura) {
  const a = APARENCIA[v.id] ?? { forma: 'sedan' as const, cor: '#333333' };
  return { forma: FORMAS[a.forma], cor: a.cor };
}
