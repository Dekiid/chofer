import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { t } from '@/i18n';

import { publicar } from './tempo-real';

// Localização do motorista em segundo plano, durante uma viagem: o cliente continua a ver o carro
// mesmo com a app do motorista minimizada ou o ecrã bloqueado.
// Precisa de uma versão instalada (development build): no iOS não funciona no Expo Go.
// Este ficheiro tem de ser importado quando a app arranca (em src/app/_layout.tsx),
// porque a tarefa tem de estar definida antes de o sistema a chamar.

export const TAREFA_LOCALIZACAO = 'chauffeur-localizacao-viagem';

/** Viagem em curso; a tarefa publica a posição para esta viagem. */
let viagemAtual: string | null = null;

function tratarPosicoes(locais: Location.LocationObject[]) {
  const id = viagemAtual;
  const ultimo = locais[locais.length - 1];
  if (!id || !ultimo) return;
  publicar({ tipo: 'posicao', id, posicao: { latitude: ultimo.coords.latitude, longitude: ultimo.coords.longitude } });
}

// A documentação exige que a tarefa seja definida no nível de topo do módulo.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREFA_LOCALIZACAO, async ({ data, error }) => {
    if (error) {
      console.warn('Localização em segundo plano', error.message);
      return;
    }
    if (data?.locations) tratarPosicoes(data.locations);
  });
}

/** Começa a partilhar a posição em segundo plano. Devolve false na web ou sem autorização. */
export async function comecarLocalizacaoFundo(viagemId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  viagemAtual = viagemId;
  try {
    // No Android é preciso pedir as duas; no iOS, a de segundo plano corresponde a "Sempre".
    const primeiro = await Location.requestForegroundPermissionsAsync();
    if (!primeiro.granted) return false;
    const fundo = await Location.requestBackgroundPermissionsAsync();
    if (!fundo.granted) return false;

    if (await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO)) return true;
    await Location.startLocationUpdatesAsync(TAREFA_LOCALIZACAO, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: t('Chauffeur · viagem em curso'),
        notificationBody: t('A partilhar a tua localização com o cliente.'),
        notificationColor: '#22C55E',
      },
    });
    return true;
  } catch (e) {
    console.warn('Localização em segundo plano: não foi possível começar', String(e));
    return false;
  }
}

/** Pára a partilha em segundo plano (fim ou cancelamento da viagem). */
export async function pararLocalizacaoFundo(): Promise<void> {
  viagemAtual = null;
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO)) {
      await Location.stopLocationUpdatesAsync(TAREFA_LOCALIZACAO);
    }
  } catch (e) {
    console.warn('Localização em segundo plano: não foi possível parar', String(e));
  }
}
