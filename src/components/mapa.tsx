import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

// Centro entre Maputo e Matola.
export const REGIAO_INICIAL = {
  latitude: -25.94,
  longitude: 32.52,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function Mapa() {
  return <MapView style={StyleSheet.absoluteFill} initialRegion={REGIAO_INICIAL} showsUserLocation showsMyLocationButton={false} />;
}
