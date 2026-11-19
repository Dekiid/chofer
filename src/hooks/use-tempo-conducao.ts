import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import type { Ponto } from '@/components/mapa-tipos';
import type { TempoConducao } from '@/data/agenda';
import { carregarTemposConducao, ouvirTemposConducao, tempoConducao, versaoTemposConducao } from '@/data/rotas';

/**
 * Tempos de condução entre estes pares de pontos, pelo Mapbox. Até a resposta chegar usa a estimativa,
 * e o ecrã volta a desenhar-se quando os tempos reais chegam.
 */
export function useTempoConducao(pares: [Ponto, Ponto][]): TempoConducao {
  const versao = useSyncExternalStore(ouvirTemposConducao, versaoTemposConducao);
  const chave = pares.map(([a, b]) => `${a.latitude},${a.longitude}>${b.latitude},${b.longitude}`).join('|');
  const atuais = useRef(pares);
  useEffect(() => {
    atuais.current = pares;
  });
  useEffect(() => {
    if (chave) carregarTemposConducao(atuais.current);
  }, [chave]);
  // Uma função nova a cada resposta, para os horários livres serem recalculados.
  return useMemo<TempoConducao>(() => (versao >= 0 ? (a, b) => tempoConducao(a, b) : tempoConducao), [versao]);
}
