import { useEffect, useRef } from 'react';

import { guardarPartilha, type DadosPartilha } from '@/data/partilha';

/** Mantém a viagem partilhada atualizada no servidor: quando muda o estado e de 15 em 15 segundos, com a posição do carro. */
export function SincronizarPartilha({ id, dados }: { id: string; dados: DadosPartilha }) {
  const atual = useRef(dados);
  useEffect(() => {
    atual.current = dados;
  });
  const { estado } = dados;
  useEffect(() => {
    const enviar = () => guardarPartilha(id, { ...atual.current, atualizadaEm: new Date().toISOString() });
    enviar();
    if (estado === 'concluida' || estado === 'cancelada') return;
    const t = setInterval(enviar, 15000);
    return () => clearInterval(t);
  }, [id, estado]);
  return null;
}
