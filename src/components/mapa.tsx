import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { MapaProps } from './mapa-tipos';

// Centro entre Maputo e Matola.
export const REGIAO_INICIAL = {
  latitude: -25.94,
  longitude: 32.52,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function Mapa({ origem, destino, carro, margemInferior = 0 }: MapaProps) {
  const ref = useRef<MapView>(null);

  // Enquadra a origem e o destino quando mudam.
  useEffect(() => {
    const pontos = [origem, destino].filter((p) => p != null);
    if (pontos.length === 0) return;
    ref.current?.fitToCoordinates(pontos, {
      edgePadding: { top: 80, right: 60, bottom: margemInferior + 40, left: 60 },
      animated: true,
    });
  }, [origem, destino, margemInferior]);

  return (
    <MapView ref={ref} style={StyleSheet.absoluteFill} initialRegion={REGIAO_INICIAL} showsUserLocation showsMyLocationButton={false}>
      {origem && <Marker coordinate={origem} title="Recolha" pinColor="black" />}
      {destino && <Marker coordinate={destino} title="Destino" pinColor="#B8914A" />}
      {origem && destino && <Polyline coordinates={[origem, destino]} strokeWidth={4} strokeColor="#000000" />}
      {carro && <Marker coordinate={carro} title="Motorista" pinColor="#2E2E2E" />}
    </MapView>
  );
}
