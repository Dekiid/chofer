import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { supabase } from './tempo-real';

// Os dados ficam guardados no telemóvel, para não se perderem ao fechar a app.
// Numa conta real (login por SMS), os que têm nome de conta também vão para o Supabase (tabela dados_conta,
// supabase/base-de-dados.sql): ao entrar noutro telemóvel, a conta volta com eles.

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

/** O cliente do Supabase, só com sessão de uma conta real (as contas de teste entram como anónimas). */
async function comContaReal() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u && !u.is_anonymous ? sb : null;
}

/** O valor guardado na conta (no servidor), ou undefined se não há conta real, nem valor, nem rede. */
async function lerDaConta<T>(conta: string): Promise<T | undefined> {
  try {
    const sb = await comContaReal();
    if (!sb) return undefined;
    const { data, error } = await sb.from('dados_conta').select('valor').eq('chave', conta).maybeSingle();
    if (error || !data) return undefined;
    return JSON.parse(JSON.stringify(data.valor), reviver) as T;
  } catch {
    return undefined;
  }
}

async function guardarNaConta(conta: string, valor: unknown): Promise<void> {
  try {
    const sb = await comContaReal();
    if (!sb) return;
    if (valor === null || valor === undefined) await sb.from('dados_conta').delete().eq('chave', conta);
    else await sb.from('dados_conta').upsert({ chave: conta, valor }, { onConflict: 'user_id,chave' });
  } catch {}
}

/**
 * useState que fica guardado no telemóvel com esta chave. Lê o valor guardado ao abrir,
 * e guarda cada mudança depois disso. As datas voltam como Date.
 * Com `conta` (ex.: 'locais'), numa conta real também fica no servidor: o que lá estiver ganha ao abrir,
 * e cada mudança é enviada pouco depois.
 */
export function useGuardado<T>(chave: string | null, inicial: T | (() => T), conta?: string): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [valor, setValor] = useState<T>(inicial);
  const [pronto, setPronto] = useState(false);
  const inicialRef = useRef(inicial);
  // O último valor que o servidor já tem (em texto), para não reenviar o que veio de lá.
  const noServidor = useRef<string | null>(null);
  // Só se envia depois de ler o servidor, para um telemóvel novo não apagar a conta com o valor inicial.
  const lidoDaConta = useRef(false);

  useEffect(() => {
    let ativo = true;
    setPronto(false);
    if (!chave) {
      setPronto(true);
      return;
    }
    noServidor.current = null;
    lidoDaConta.current = false;
    lerGuardado<T>(chave).then(async (v) => {
      if (!ativo) return;
      const i = inicialRef.current;
      setValor(v ?? (typeof i === 'function' ? (i as () => T)() : i));
      setPronto(true);
      if (!conta) return;
      const daConta = await lerDaConta<T>(conta);
      if (!ativo) return;
      lidoDaConta.current = true;
      if (daConta !== undefined) {
        noServidor.current = JSON.stringify(daConta);
        setValor(daConta);
      } else if (v !== null) {
        // Primeira vez com esta conta no servidor: leva o que já estava neste telemóvel.
        noServidor.current = JSON.stringify(v);
        guardarNaConta(conta, v);
      }
    });
    return () => {
      ativo = false;
    };
  }, [chave, conta]);

  useEffect(() => {
    if (!pronto || !chave) return;
    guardar(chave, valor);
    if (!conta || !lidoDaConta.current) return;
    const texto = JSON.stringify(valor ?? null);
    if (texto === noServidor.current) return;
    // Espera um pouco, para juntar várias mudanças seguidas num só envio.
    const espera = setTimeout(() => {
      noServidor.current = texto;
      guardarNaConta(conta, valor);
    }, 1500);
    return () => clearTimeout(espera);
  }, [chave, conta, valor, pronto]);

  return [valor, setValor, pronto];
}
