import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/i18n';

import { supabase } from './tempo-real';

// Avisos push (remotos): o motorista recebe os pedidos novos mesmo com a app fechada ou o telemóvel bloqueado.
// Precisa de:
// - uma versão instalada (development build). No Expo Go do Android as push não funcionam desde o SDK 53;
// - o projectId do EAS (corre `eas init` uma vez; fica em app.json > extra.eas.projectId);
// - a tabela push_motoristas do ficheiro supabase/push.sql.

/** Canal do Android para os pedidos novos: importância alta e com som. O envio usa o mesmo id. */
export const CANAL_PEDIDOS = 'pedidos';

const TABELA = 'push_motoristas';

/**
 * Com EXPO_PUBLIC_AVISOS_SERVIDOR=1 a app já não lê os tokens: grava o seu pela função guardar_push
 * e pede o envio à função enviar-aviso (supabase/push-fechar.sql e a pasta supabase/functions/enviar-aviso).
 */
const AVISOS_NO_SERVIDOR = process.env.EXPO_PUBLIC_AVISOS_SERVIDOR === '1';

function projectId(): string | null {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Pede autorização, cria o canal do Android e guarda no Supabase o token push deste telemóvel para o carro.
 * Devolve o token, ou null se não for possível (web, simulador, sem projectId, sem autorização ou sem Supabase).
 */
export async function registarPushMotorista(viaturaId: string, telefone: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const sb = supabase();
  if (!sb) return null;
  if (!Device.isDevice) {
    console.warn('Push: só funciona num telemóvel a sério, não no simulador.');
    return null;
  }
  const id = projectId();
  if (!id) {
    console.warn('Push: falta o projectId do EAS. Corre `eas init` e faz uma nova versão instalada.');
    return null;
  }

  try {
    // No Android 13+, o pedido de autorização só aparece depois de existir um canal.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PEDIDOS, {
        name: t('Pedidos novos'),
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    const autorizado = atual.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!autorizado) {
      console.warn('Push: o motorista não autorizou as notificações.');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const { error } = AVISOS_NO_SERVIDOR
      ? await sb.rpc('guardar_push', { p_viatura: viaturaId, p_telefone: telefone, p_token: token })
      : await sb
          .from(TABELA)
          .upsert({ viatura_id: viaturaId, telefone, token, atualizado_em: new Date().toISOString() }, { onConflict: 'viatura_id' });
    if (error) console.warn('Push: não foi possível guardar o token', error.message);
    return token;
  } catch (e) {
    console.warn('Push: falhou o registo', String(e));
    return null;
  }
}

/**
 * Envia um aviso push ao telemóvel do motorista do carro.
 *
 * Sem EXPO_PUBLIC_AVISOS_SERVIDOR=1 envia a partir da app do cliente, o que é só para testes:
 * qualquer pessoa com a app poderia ler os tokens. Antes do lançamento liga-se o envio pelo servidor.
 */
export async function avisarMotoristaPorPush(viaturaId: string, titulo: string, texto: string, dados?: object): Promise<void> {
  if (Platform.OS === 'web') return;
  const sb = supabase();
  if (!sb) return;
  if (AVISOS_NO_SERVIDOR) {
    const { error } = await sb.functions.invoke('enviar-aviso', { body: { viatura_id: viaturaId, titulo, texto, dados: dados ?? {} } });
    if (error) console.warn('Push: o servidor não enviou o aviso', error.message);
    return;
  }
  try {
    const { data, error } = await sb.from(TABELA).select('token').eq('viatura_id', viaturaId).maybeSingle();
    if (error) {
      console.warn('Push: não foi possível ler o token', error.message);
      return;
    }
    const token = (data as { token?: string } | null)?.token;
    if (!token) return;

    const resposta = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: titulo,
        body: texto,
        data: dados ?? {},
        priority: 'high',
        sound: 'default',
        channelId: CANAL_PEDIDOS,
      }),
    });
    if (!resposta.ok) console.warn('Push: o Expo recusou o envio', resposta.status);
  } catch (e) {
    console.warn('Push: falhou o envio', String(e));
  }
}
