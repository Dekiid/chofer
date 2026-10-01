import { createContext, Fragment, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useGuardado } from '@/data/guardar';
import { definirIdioma, type Idioma } from '@/i18n';

type Contexto = { idioma: Idioma; setIdioma: (i: Idioma) => void };
const Ctx = createContext<Contexto | null>(null);

/** Guarda a língua escolhida e volta a desenhar a app toda quando muda. */
export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useGuardado<Idioma>('chauffeur.idioma', 'pt');
  definirIdioma(idioma);
  useEffect(() => definirIdioma(idioma), [idioma]);
  const valor = useMemo(() => ({ idioma, setIdioma }), [idioma, setIdioma]);
  // A chave muda com a língua: os ecrãs voltam a montar e cada t() lê a língua nova.
  return (
    <Ctx.Provider value={valor}>
      <Fragment key={idioma}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useIdioma(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useIdioma tem de estar dentro de IdiomaProvider');
  return ctx;
}
