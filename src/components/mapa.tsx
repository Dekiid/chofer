import { useEffect, useRef } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';

import { MAPA_ESCURO } from './mapa-escuro';
import type { MapaProps, Ponto } from './mapa-tipos';
import { paisAtual } from '@/data/paises';
import { t } from '@/i18n';

// Centro entre Maputo e Matola; em Angola, Luanda (ver initialRegion).
export const REGIAO_INICIAL = {
  latitude: -25.94,
  longitude: 32.52,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function Mapa({ origem, destino, paragens, carro, rota, seguirCarro, margemInferior = 0, onMoverOrigem, onMoverDestino, onMoverParagem, zonas }: MapaProps) {
  const ref = useRef<MapView>(null);
  const escuro = useColorScheme() === 'dark';
  const corLinha = escuro ? '#FFFFFF' : '#000000';
  const linha = rota ?? (origem && destino ? [origem, destino] : []);

  // Com um só ponto (o carro parado), aproxima-se a esse ponto em vez de fazer o zoom máximo.
  function enquadrar(pontos: Ponto[], margem: { top: number; right: number; bottom: number; left: number }) {
    if (pontos.length === 1) {
      ref.current?.animateToRegion({ ...pontos[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
      return;
    }
    ref.current?.fitToCoordinates(pontos, { edgePadding: margem, animated: true });
  }

  // Enquadra a origem e o destino quando mudam.
  useEffect(() => {
    const pontos = [origem, destino, ...(rota ?? [])].filter((p) => p != null);
    if (pontos.length === 0) return;
    enquadrar(pontos, { top: 80, right: 60, bottom: margemInferior + 40, left: 60 });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a rota muda a cada passo do carro; só se reenquadra quando mudam os pontos fixos.
  }, [origem, destino, margemInferior]);

  // Acompanhar o carro: de segundo a segundo e meio, enquadra o carro e o que falta da rota.
  // O zoom aproxima-se à medida que o carro chega, e o carro nunca sai do ecrã.
  const ultimoEnquadramento = useRef(0);
  useEffect(() => {
    if (!seguirCarro || !carro) return;
    const agora = Date.now();
    if (agora - ultimoEnquadramento.current < 1500) return;
    ultimoEnquadramento.current = agora;
    const pontos = rota && rota.length > 1 ? rota : [carro, ...[origem, destino].filter((p) => p != null)];
    enquadrar(pontos, { top: 100, right: 70, bottom: margemInferior + 60, left: 70 });
  }, [seguirCarro, carro, rota, origem, destino, margemInferior]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...REGIAO_INICIAL, ...paisAtual().centro }}
      showsUserLocation
      showsMyLocationButton={false}
      userInterfaceStyle={escuro ? 'dark' : 'light'}
      customMapStyle={escuro ? MAPA_ESCURO : []}>
      {zonas?.map((z, i) => (
        <Circle key={`zona-${i}`} center={z.ponto} radius={z.raioM} fillColor={`rgba(34,197,94,${0.12 + z.nivel * 0.08})`} strokeColor="rgba(34,197,94,0.6)" strokeWidth={1} />
      ))}
      {linha.length > 1 && <Polyline coordinates={linha} strokeWidth={4} strokeColor={corLinha} />}
      {origem && (
        <Marker
          coordinate={origem}
          title={t('Recolha')}
          anchor={{ x: 0.5, y: 0.5 }}
          draggable={!!onMoverOrigem}
          onDragEnd={(e) => onMoverOrigem?.(e.nativeEvent.coordinate)}>
          <View style={marcas.halo}>
            <View style={marcas.recolha} />
          </View>
        </Marker>
      )}
      {destino && (
        <Marker
          coordinate={destino}
          title={t('Destino')}
          anchor={{ x: 0.5, y: 0.5 }}
          draggable={!!onMoverDestino}
          onDragEnd={(e) => onMoverDestino?.(e.nativeEvent.coordinate)}>
          <View style={[marcas.destino, { backgroundColor: corLinha, borderColor: escuro ? '#000000' : '#FFFFFF' }]} />
        </Marker>
      )}
      {paragens?.map((p, i) => (
        <Marker
          key={`paragem-${i}`}
          coordinate={p}
          title={t('Paragem {n}', { n: i + 1 })}
          anchor={{ x: 0.5, y: 0.5 }}
          draggable={!!onMoverParagem}
          onDragEnd={(e) => onMoverParagem?.(i, e.nativeEvent.coordinate)}>
          <View style={[marcas.paragem, { borderColor: corLinha }]} />
        </Marker>
      ))}
      {carro && (
        <Marker coordinate={carro} title={t('Motorista')} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={marcas.carro} />
        </Marker>
      )}
    </MapView>
  );
}

// Marcadores do manual de identidade: recolha verde com borda branca e halo, carros como rectângulos pretos.
const marcas = StyleSheet.create({
  halo: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.22)', alignItems: 'center', justifyContent: 'center' },
  recolha: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E', borderWidth: 3, borderColor: '#FFFFFF' },
  destino: { width: 14, height: 14, borderWidth: 3 },
  paragem: { width: 12, height: 12, borderWidth: 3, backgroundColor: '#FFFFFF' },
  carro: { width: 14, height: 26, borderRadius: 5, backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF' },
});
