import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './tempo-real';
import { t } from '@/i18n';

// Entrar com Apple ou Google pelo Supabase Auth. Depois de entrar, a app ainda pede o número de telemóvel
// (confirmado por SMS), porque o número é o que liga a conta ao país, aos pagamentos e ao modo motorista.
// Configuração no Supabase: guia /mnt/project-files/guias/entrar-com-apple-e-google.md.

export type Fornecedor = 'apple' | 'google';

/** Apple só no iPhone e com o Supabase ligado; Google com o Supabase ligado. */
export async function fornecedoresDisponiveis(): Promise<Fornecedor[]> {
  if (!supabase()) return [];
  const apple = Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
  return apple ? ['apple', 'google'] : ['google'];
}

/** Devolve null quando entrou (a sessão muda sozinha), ou a mensagem para mostrar. Cancelar não é erro: devolve ''. */
export async function entrarCom(fornecedor: Fornecedor): Promise<string | null> {
  const sb = supabase();
  if (!sb) return t('O Supabase ainda não está ligado.');
  try {
    if (fornecedor === 'apple') {
      const c = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!c.identityToken) return t('A Apple não devolveu a identificação. Tenta outra vez.');
      const { error } = await sb.auth.signInWithIdToken({ provider: 'apple', token: c.identityToken });
      if (error) return error.message;
      // A Apple só manda o nome na primeira vez: guarda-se logo no perfil.
      if (c.fullName?.givenName) await sb.auth.updateUser({ data: { nome: c.fullName.givenName, apelido: c.fullName.familyName ?? '' } });
      return null;
    }
    const voltar = Linking.createURL('registo');
    const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: voltar, skipBrowserRedirect: true } });
    if (error || !data.url) return error?.message ?? t('Algo correu mal. Tenta outra vez.');
    const r = await WebBrowser.openAuthSessionAsync(data.url, voltar);
    if (r.type !== 'success') return '';
    const codigo = /[?&]code=([^&#]+)/.exec(r.url)?.[1];
    if (!codigo) return t('O Google não devolveu a autorização. Tenta outra vez.');
    const troca = await sb.auth.exchangeCodeForSession(decodeURIComponent(codigo));
    return troca.error ? troca.error.message : null;
  } catch (e) {
    // Fechar a janela da Apple chega aqui como ERR_REQUEST_CANCELED.
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return '';
    return e instanceof Error ? e.message : t('Algo correu mal. Tenta outra vez.');
  }
}
