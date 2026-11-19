import type { PrecoCasamento } from './categorias';

export type Decoracao = 'com' | 'sem';

export function precoCasamento(preco: PrecoCasamento, decoracao: Decoracao): number {
  return decoracao === 'com' ? preco.comDecoracaoMzn : preco.semDecoracaoMzn;
}
