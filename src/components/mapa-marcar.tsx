import { StyleSheet, useColorScheme } from 'react-native';
import MapView from 'react-native-maps';

import { MAPA_ESCURO } from './mapa-escuro';
import type { Ponto } from './mapa-tipos';

export type MapaMarcarProps = {
  /** Onde o mapa abre: o local que já estava escolhido. */
  inicial: Ponto;
  /** O mapa começou a mexer; o nome do local deixa de valer. */
  onMexer: () => void;
  /** O mapa parou: o centro, onde está o pin, é o local escolhido. */
  onMover: (p: Ponto) => void;
};

/** Mapa para marcar um local: a pessoa arrasta o mapa por baixo de um pin fixo ao centro, como na Uber. */
export function MapaMarcar({ inicial, onMexer, onMover }: MapaMarcarProps) {
  const escuro = useColorScheme() === 'dark';
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...inicial, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
      showsUserLocation
      showsMyLocationButton={false}
      showsPointsOfInterests
      userInterfaceStyle={escuro ? 'dark' : 'light'}
      customMapStyle={escuro ? MAPA_ESCURO : []}
      onRegionChangeStart={onMexer}
      onRegionChangeComplete={(r) => onMover({ latitude: r.latitude, longitude: r.longitude })}
    />
  );
}
