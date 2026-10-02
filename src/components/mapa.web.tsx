import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { paisAtual } from '@/data/paises';
import { Text } from '@/components/texto';
import { usePalette } from '@/constants/use-palette';

import type { MapaProps, Ponto } from './mapa-tipos';
import { t } from '@/i18n';

// react-native-maps não funciona na web; esta vista só serve para pré-visualizar o layout.
// Os pontos são projetados na parte de cima do ecrã (a de baixo fica tapada pelo painel),
// com os marcadores do manual de identidade.
export function Mapa({ origem, destino, paragens, carro, rota, zonas }: MapaProps) {
  const cores = usePalette();
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 });
  const linha = rota ?? (origem && destino ? [origem, destino] : []);
  const todos = [origem, destino, carro, ...(paragens ?? []), ...linha, ...(zonas ?? []).map((z) => z.ponto)].filter((p): p is Ponto => p != null);

  // A área só cresce, para os marcadores não saltarem enquanto o carro se aproxima.
  const caixa = useRef({ minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });
  for (const p of todos) {
    const c = caixa.current;
    caixa.current = {
      minLat: Math.min(c.minLat, p.latitude),
      maxLat: Math.max(c.maxLat, p.latitude),
      minLng: Math.min(c.minLng, p.longitude),
      maxLng: Math.max(c.maxLng, p.longitude),
    };
  }
  const { minLat, maxLat, minLng, maxLng } = caixa.current;
  const xy = (p: Ponto) => ({
    x: tamanho.w * (0.2 + 0.6 * (maxLng === minLng ? 0.5 : (p.longitude - minLng) / (maxLng - minLng))),
    y: tamanho.h * (0.12 + 0.16 * (maxLat === minLat ? 0.5 : (maxLat - p.latitude) / (maxLat - minLat))),
  });

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: cores.mapa, alignItems: 'center', paddingTop: 60 }]}
      onLayout={(e) => setTamanho({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Text style={{ color: cores.textSecondary }}>{t('Mapa de {zona}', { zona: t(paisAtual().zonaServico) })}</Text>
      {tamanho.w > 0 &&
        zonas?.map((z, i) => {
          const c = xy(z.ponto);
          // Raio em píxeis com a mesma escala do eixo das longitudes.
          const grausLng = maxLng === minLng ? 0.05 : maxLng - minLng;
          const r = Math.max(10, ((z.raioM / 111320 / Math.cos((z.ponto.latitude * Math.PI) / 180)) / grausLng) * tamanho.w * 0.6);
          return (
            <View
              key={`zona-${i}`}
              style={{ position: 'absolute', left: c.x - r, top: c.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: `rgba(34,197,94,${0.12 + z.nivel * 0.08})`, borderWidth: 1, borderColor: 'rgba(34,197,94,0.6)' }}
            />
          );
        })}
      {tamanho.w > 0 &&
        linha.slice(1).map((p, i) => {
          const a = xy(linha[i]);
          const b = xy(p);
          const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
          const angulo = Math.atan2(b.y - a.y, b.x - a.x);
          return (
            <View
              key={i}
              style={[
                estilos.rota,
                { backgroundColor: cores.text, left: (a.x + b.x) / 2 - comprimento / 2, top: (a.y + b.y) / 2 - 2, width: comprimento, transform: [{ rotate: `${angulo}rad` }] },
              ]}
            />
          );
        })}
      {tamanho.w > 0 && destino && <View style={[estilos.destino, { backgroundColor: cores.text, borderColor: cores.background, left: xy(destino).x - 7, top: xy(destino).y - 7 }]} />}
      {tamanho.w > 0 && origem && (
        <View style={[estilos.halo, { left: xy(origem).x - 18, top: xy(origem).y - 18 }]}>
          <View style={estilos.recolha} />
        </View>
      )}
      {tamanho.w > 0 &&
        paragens?.map((p, i) => <View key={`paragem-${i}`} style={[estilos.paragem, { borderColor: cores.text, left: xy(p).x - 6, top: xy(p).y - 6 }]} />)}
      {tamanho.w > 0 && carro && <View style={[estilos.carro, { left: xy(carro).x - 13, top: xy(carro).y - 7 }]} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  halo: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.22)', alignItems: 'center', justifyContent: 'center' },
  recolha: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E', borderWidth: 3, borderColor: '#FFFFFF' },
  destino: { position: 'absolute', width: 14, height: 14, borderWidth: 3 },
  paragem: { position: 'absolute', width: 12, height: 12, borderWidth: 3, backgroundColor: '#FFFFFF' },
  carro: { position: 'absolute', width: 26, height: 14, borderRadius: 4, backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF' },
  rota: { position: 'absolute', height: 4, borderRadius: 2 },
});
