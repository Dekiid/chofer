import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

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
    Notifications.setNotificationChannelAsync('viagens', { name: 'Viagens', importance: Notifications.AndroidImportance.HIGH }).catch(() => {});
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
