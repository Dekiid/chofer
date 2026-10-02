import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { definirPais, paisDoTelefone } from '@/data/paises';
import { supabase } from '@/data/tempo-real';
import { VERSAO_TERMOS } from '@/data/textos-legais';
import { t } from '@/i18n';

/** O que o cliente diz no registo. O telefone vem com indicativo: +25884… (Moçambique) ou +2449… (Angola). */
export type Perfil = {
  telefone: string;
  nome?: string;
  apelido?: string;
  email?: string;
  /** Versão dos termos aceite. */
  termos?: string;
  /** Conta de demonstração do motorista (pedido do Flavio, para testes). */
  motoristaDemo?: boolean;
};

/** Código que entra sem SMS, no modo de teste. */
export const CODIGO_TESTE = '123456';
/** Dígitos do código por SMS (o Supabase manda 6). */
export const DIGITOS_CODIGO = 6;

/**
 * Conta de demonstração do motorista, para testar o modo motorista sem inscrição aprovada.
 * Entra com o número 84121212 e o código 0000, sem SMS. Sai quando houver motoristas reais no servidor.
 */
export const MOTORISTA_DEMO = { telefone: '+25884121212', codigo: '0000' };

/** Quantos dígitos tem o código para este número. */
export const digitosCodigo = (telefone: string) => (telefone === MOTORISTA_DEMO.telefone ? MOTORISTA_DEMO.codigo.length : DIGITOS_CODIGO);

type Sessao = {
  estado: 'a_carregar' | 'fora' | 'dentro';
  perfil: Perfil | null;
  /** Registo feito: nome, email e termos. Sem isto, a app mostra o registo. */
  completo: boolean;
  /** Sem SMS: o código é sempre o mesmo e a conta fica só neste telemóvel. */
  semSms: boolean;
  /** Devolve a mensagem de erro, ou null se o código foi enviado. */
  pedirCodigo: (telefone: string) => Promise<string | null>;
  confirmarCodigo: (telefone: string, codigo: string) => Promise<string | null>;
  /** Passar a entrar sem SMS (enquanto o envio de SMS não está ligado no Supabase). */
  usarSemSms: () => void;
  guardarPerfil: (mudancas: Partial<Perfil>) => Promise<string | null>;
  sair: () => Promise<void>;
  /** Apaga a conta e os dados dela neste telemóvel. Devolve a mensagem de erro, ou null. */
  apagarConta: () => Promise<string | null>;
  /** Mostra o ecrã de boas-vindas logo a seguir ao registo. */
  bemVindo: boolean;
  fecharBemVindo: () => void;
};

const Contexto = createContext<Sessao | null>(null);

// Conta sem SMS (modo de demonstração, ou enquanto o Supabase não envia SMS): fica guardada só neste telemóvel.
const CHAVE_LOCAL = 'chauffeur.conta';

const perfilDe = (u: User): Perfil => {
  const m = u.user_metadata ?? {};
  return {
    telefone: u.phone ? `+${u.phone.replace(/^\+/, '')}` : '',
    nome: m.nome,
    apelido: m.apelido,
    email: m.email_recibos,
    termos: m.termos,
  };
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Explica os erros do Supabase em português. */
function explicar(e: { code?: string; message?: string; status?: number }): string {
  if (e.code === 'phone_provider_disabled' || /provider.*disabled|Unsupported phone provider/i.test(e.message ?? ''))
    return t('O envio de SMS ainda não está ligado no Supabase.');
  if (e.code === 'sms_send_failed') return t('Não foi possível enviar a SMS para este número.');
  if (e.code === 'over_sms_send_rate_limit' || e.status === 429) return t('Pediste muitos códigos seguidos. Espera um pouco e tenta outra vez.');
  if (e.code === 'otp_expired' || /expired|invalid/i.test(e.message ?? '')) return t('Código errado ou expirado.');
  return e.message ?? t('Algo correu mal. Tenta outra vez.');
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Sessao['estado']>('a_carregar');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  // Sem Supabase, nunca há SMS.
  const [semSms, setSemSms] = useState(() => !supabase());
  const [bemVindo, setBemVindo] = useState(false);

  // Ao abrir: a conta do Supabase, se houver; senão, a conta guardada neste telemóvel.
  useEffect(() => {
    let ativo = true;
    const sb = supabase();
    (async () => {
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (!ativo) return;
        if (data.session) {
          setPerfil(perfilDe(data.session.user));
          setEstado('dentro');
          return;
        }
      }
      let local: Perfil | null = null;
      try {
        const texto = await AsyncStorage.getItem(CHAVE_LOCAL);
        local = texto ? (JSON.parse(texto) as Perfil) : null;
      } catch {}
      if (!ativo) return;
      if (local) {
        setSemSms(true);
        setPerfil(local);
        setEstado('dentro');
      } else {
        setEstado('fora');
      }
    })();
    const ouvinte = sb?.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'SIGNED_OUT') return;
      if (sessao) {
        setPerfil(perfilDe(sessao.user));
        setEstado('dentro');
      }
    });
    return () => {
      ativo = false;
      ouvinte?.data.subscription.unsubscribe();
    };
  }, []);

  const guardarLocal = useCallback(async (p: Perfil | null) => {
    try {
      if (p) await AsyncStorage.setItem(CHAVE_LOCAL, JSON.stringify(p));
      else await AsyncStorage.removeItem(CHAVE_LOCAL);
    } catch {}
  }, []);

  const pedirCodigo = useCallback(
    async (telefone: string) => {
      const sb = supabase();
      if (semSms || !sb || telefone === MOTORISTA_DEMO.telefone) {
        await esperar(500);
        return null;
      }
      const { error } = await sb.auth.signInWithOtp({ phone: telefone });
      return error ? explicar(error) : null;
    },
    [semSms],
  );

  const confirmarCodigo = useCallback(
    async (telefone: string, codigo: string) => {
      const sb = supabase();
      if (telefone === MOTORISTA_DEMO.telefone) {
        await esperar(400);
        if (codigo !== MOTORISTA_DEMO.codigo) return t('Código errado.');
        // Já vem com o registo feito, para entrar logo.
        const p: Perfil = {
          telefone,
          nome: 'Motorista',
          apelido: 'Demo',
          email: 'motorista.demo@chauffeur.co.mz',
          termos: VERSAO_TERMOS,
          motoristaDemo: true,
        };
        await guardarLocal(p);
        setSemSms(true);
        setPerfil(p);
        setEstado('dentro');
        return null;
      }
      if (semSms || !sb) {
        await esperar(400);
        if (codigo !== CODIGO_TESTE) return t('Código errado. No modo de teste o código é sempre {codigo}.', { codigo: CODIGO_TESTE });
        // O mesmo número volta a encontrar a conta que já tinha neste telemóvel.
        let anterior: Perfil | null = null;
        try {
          const texto = await AsyncStorage.getItem(`${CHAVE_LOCAL}.${telefone}`);
          anterior = texto ? (JSON.parse(texto) as Perfil) : null;
        } catch {}
        const p = anterior ?? { telefone };
        await guardarLocal(p);
        setPerfil(p);
        setEstado('dentro');
        return null;
      }
      const { data, error } = await sb.auth.verifyOtp({ phone: telefone, token: codigo, type: 'sms' });
      if (error || !data.user) return explicar(error ?? {});
      setPerfil(perfilDe(data.user));
      setEstado('dentro');
      return null;
    },
    [semSms, guardarLocal],
  );

  const guardarPerfil = useCallback(
    async (mudancas: Partial<Perfil>) => {
      if (!perfil) return t('Sem conta.');
      const novo = { ...perfil, ...mudancas };
      const sb = supabase();
      if (semSms || !sb) {
        await guardarLocal(novo);
        try {
          await AsyncStorage.setItem(`${CHAVE_LOCAL}.${novo.telefone}`, JSON.stringify(novo));
        } catch {}
      } else {
        // O email vai para os dados do perfil (não para o login), para não pedir confirmação por email.
        const { error } = await sb.auth.updateUser({
          data: { nome: novo.nome, apelido: novo.apelido, email_recibos: novo.email, termos: novo.termos },
        });
        if (error) return explicar(error);
      }
      setPerfil(novo);
      // Acabou o registo: a app abre com o ecrã de boas-vindas.
      if (mudancas.termos && !perfil.termos) setBemVindo(true);
      return null;
    },
    [perfil, semSms, guardarLocal],
  );

  const sair = useCallback(async () => {
    const sb = supabase();
    if (sb && !semSms) await sb.auth.signOut();
    await guardarLocal(null);
    setPerfil(null);
    setEstado('fora');
    setSemSms(!sb);
  }, [semSms, guardarLocal]);

  const apagarConta = useCallback(async () => {
    if (!perfil) return null;
    const sb = supabase();
    if (sb && !semSms) {
      // Precisa de supabase/apagar-conta.sql no projeto.
      const { error } = await sb.rpc('apagar_conta');
      if (error) return /apagar_conta|function/i.test(error.message) ? t('Falta correr supabase/apagar-conta.sql no Supabase.') : explicar(error);
      await sb.auth.signOut();
    }
    // Tudo o que esta conta guardou neste telemóvel.
    try {
      const chaves = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(chaves.filter((k) => k.includes(perfil.telefone)));
    } catch {}
    await guardarLocal(null);
    setPerfil(null);
    setEstado('fora');
    setSemSms(!sb);
    return null;
  }, [perfil, semSms, guardarLocal]);

  const completo = Boolean(perfil?.nome && perfil.apelido && perfil.email && perfil.termos);

  const valor = useMemo<Sessao>(
    () => ({
      estado,
      perfil,
      completo,
      semSms,
      pedirCodigo,
      confirmarCodigo,
      usarSemSms: () => setSemSms(true),
      guardarPerfil,
      sair,
      apagarConta,
      bemVindo,
      fecharBemVindo: () => setBemVindo(false),
    }),
    [estado, perfil, completo, semSms, pedirCodigo, confirmarCodigo, guardarPerfil, sair, apagarConta, bemVindo],
  );

  // O país da conta (pelo indicativo do número) decide a moeda, os lugares e os pagamentos. Corre antes dos ecrãs.
  if (perfil) definirPais(paisDoTelefone(perfil.telefone).codigo);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Em testes, qualquer conta entra no modo motorista e vê todos os carros (pedido do Flavio).
 * Pôr a false para voltar a exigir inscrição aprovada.
 */
export const MOTORISTA_ABERTO_EM_TESTES = true;

/** Números que já são motoristas, mesmo depois de fechar o modo de testes (pedido do Flavio). */
export const MOTORISTAS_DE_TESTE = ['+258841234567'];

/** Pode usar o modo motorista: a conta de demonstração, ou quem conduz um carro com inscrição aprovada (dono ou motorista indicado). */
export function podeConduzir(perfil: Perfil | null, inscricoes: { telefone: string; estado: string; motorista?: { telefone: string } }[]): boolean {
  if (!perfil) return false;
  if (MOTORISTA_ABERTO_EM_TESTES || perfil.motoristaDemo || MOTORISTAS_DE_TESTE.includes(perfil.telefone)) return true;
  // Quem conduz o carro aprovado: o dono, ou o motorista que o dono indicou.
  return inscricoes.some((i) => i.estado === 'aprovada' && (i.motorista?.telefone ?? i.telefone) === perfil.telefone);
}

export function useSessao(): Sessao {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao tem de estar dentro de SessaoProvider');
  return ctx;
}

/** O próximo passo do registo que falta, para retomar onde ficou. */
export function proximoPasso(p: Perfil | null): '/registo/telefone' | '/registo/nome' | '/registo/email' | '/registo/termos' | null {
  if (!p) return '/registo/telefone';
  if (!p.nome || !p.apelido) return '/registo/nome';
  if (!p.email) return '/registo/email';
  if (!p.termos) return '/registo/termos';
  return null;
}
