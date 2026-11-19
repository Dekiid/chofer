import { useEffect, useState } from 'react';

import type { Ponto } from '@/components/mapa-tipos';
import type { Lugar } from '@/data/lugares';
import { pesquisarMoradas } from '@/data/moradas';

/** Moradas encontradas para o texto, pedidas só quando se para de escrever (300 ms). */
export function usePesquisaMoradas(texto: string, perto: Ponto): { moradas: Lugar[]; aProcurar: boolean } {
  const [moradas, setMoradas] = useState<Lugar[]>([]);
  const [aProcurar, setAProcurar] = useState(false);
  const { latitude, longitude } = perto;

  useEffect(() => {
    if (texto.trim().length < 3) {
      setMoradas([]);
      setAProcurar(false);
      return;
    }
    let atual = true;
    setAProcurar(true);
    const espera = setTimeout(async () => {
      const r = await pesquisarMoradas(texto, { latitude, longitude });
      if (!atual) return;
      setMoradas(r);
      setAProcurar(false);
    }, 300);
    return () => {
      atual = false;
      clearTimeout(espera);
    };
  }, [texto, latitude, longitude]);

  return { moradas, aProcurar };
}
