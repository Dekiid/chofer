import { Alert, Linking, Platform } from 'react-native';

import type { Ponto } from '@/components/mapa-tipos';
import { t } from '@/i18n';

// Ligações que abrem a app de navegação já com o destino (se a app não estiver instalada, abre no navegador).
const googleMaps = (p: Ponto) => `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
const waze = (p: Ponto) => `https://waze.com/ul?ll=${p.latitude},${p.longitude}&navigate=yes`;
const mapasApple = (p: Ponto) => `https://maps.apple.com/?daddr=${p.latitude},${p.longitude}&dirflg=d`;

/** O motorista escolhe a app onde quer seguir a rota até ao ponto: Google Maps, Waze ou (no iPhone) Mapas. */
export function abrirNavegacao(p: Ponto) {
  if (Platform.OS === 'web') {
    Linking.openURL(googleMaps(p));
    return;
  }
  Alert.alert(t('Navegar com'), undefined, [
    { text: 'Google Maps', onPress: () => Linking.openURL(googleMaps(p)) },
    { text: 'Waze', onPress: () => Linking.openURL(waze(p)) },
    ...(Platform.OS === 'ios' ? [{ text: t('Mapas'), onPress: () => Linking.openURL(mapasApple(p)) }] : []),
    { text: t('Cancelar'), style: 'cancel' as const },
  ]);
}
