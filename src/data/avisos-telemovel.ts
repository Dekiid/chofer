import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n';

// Notificações locais: o telemóvel avisa quando a app está em segundo plano.
// Com a app aberta já aparece o aviso dentro da app; mostrar também o do sistema duplicava-o.
// Os avisos enviados pelo servidor (push) chegam quando houver backend; no Expo Go
// do Android só funcionam as locais, as push precisam de uma versão instalada.

let configurado = false;
let autorizado: boolean | null = null;

function configurar() {
  if (configurado || Platform.OS === 'web') return;
  configurado = true;
  Notifications.setNotificationHandler({
    // Se chegar alguma com a app aberta, não aparece por cima: o aviso da app chega.
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('viagens', { name: t('Viagens'), importance: Notifications.AndroidImportance.HIGH }).catch(() => {});
  }
}

/** Pede autorização uma vez; devolve se o telemóvel pode mostrar avisos. */
export async function pedirAutorizacao(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  configurar();
  if (autorizado !== null) return autorizado;
  try {
    const atual = await Notifications.getPermissionsAsync();
    autorizado = atual.granted || (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    autorizado = false;
  }
  return autorizado;
}

export async function avisarNoTelemovel(titulo: string, texto: string) {
  // Com a app aberta só se pede a autorização (a primeira vez), para os avisos seguintes chegarem com o telemóvel bloqueado.
  if (!(await pedirAutorizacao()) || AppState.currentState === 'active') return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title: titulo, body: texto }, trigger: Platform.OS === 'android' ? { channelId: 'viagens' } : null });
  } catch {
    // Sem aviso do sistema fica o aviso dentro da app.
  }
}

/**
 * Agenda um aviso do sistema para uma hora certa (lembretes das reservas). Chega mesmo com a app fechada.
 * O mesmo identificador substitui o aviso anterior, por isso pode chamar-se várias vezes.
 */
export async function agendarNoTelemovel(identificador: string, quando: number, titulo: string, texto: string) {
  if (quando <= Date.now() || !(await pedirAutorizacao())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: identificador,
      content: { title: titulo, body: texto },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando, channelId: Platform.OS === 'android' ? 'viagens' : undefined },
    });
  } catch {}
}

/** Tira os avisos agendados com estes identificadores (por exemplo, quando a reserva é cancelada). */
export async function cancelarNoTelemovel(identificadores: string[]) {
  if (Platform.OS === 'web') return;
  await Promise.all(identificadores.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}
