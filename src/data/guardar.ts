import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

// Protótipo: os dados de teste ficam guardados no telemóvel, para não se perderem ao fechar a app.
// No produto final vivem no Supabase.

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const reviver = (_: string, v: unknown) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v);

export async function lerGuardado<T>(chave: string): Promise<T | null> {
  try {
    const texto = await AsyncStorage.getItem(chave);
    return texto ? (JSON.parse(texto, reviver) as T) : null;
  } catch {
    return null;
  }
}

export async function guardar(chave: string, valor: unknown): Promise<void> {
  try {
    if (valor === null || valor === undefined) await AsyncStorage.removeItem(chave);
    else await AsyncStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
}

/**
 * useState que fica guardado no telemóvel com esta chave. Lê o valor guardado ao abrir,
 * e guarda cada mudança depois disso. As datas voltam como Date.
 */
export function useGuardado<T>(chave: string | null, inicial: T | (() => T)): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [valor, setValor] = useState<T>(inicial);
  const [pronto, setPronto] = useState(false);
  const inicialRef = useRef(inicial);

  useEffect(() => {
    let ativo = true;
    setPronto(false);
    if (!chave) {
      setPronto(true);
      return;
    }
    lerGuardado<T>(chave).then((v) => {
      if (!ativo) return;
      const i = inicialRef.current;
      setValor(v ?? (typeof i === 'function' ? (i as () => T)() : i));
      setPronto(true);
    });
    return () => {
      ativo = false;
    };
  }, [chave]);

  useEffect(() => {
    if (pronto && chave) guardar(chave, valor);
  }, [chave, valor, pronto]);

  return [valor, setValor, pronto];
}
