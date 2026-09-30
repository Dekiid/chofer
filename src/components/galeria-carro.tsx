import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { Radius, Spacing } from '@/constants/theme';
import { nomeViatura, type FotoGaleria, type Viatura } from '@/data/categorias';

type Props = {
  viatura: Viatura;
  visivel: boolean;
  onFechar: () => void;
};

/** Fotos do carro para o cliente ver antes de pedir: a foto principal, o interior e outros ângulos. */
export function fotosDaGaleria(v: Viatura): FotoGaleria[] {
  return [{ foto: v.foto, credito: v.credito, legenda: 'Exterior' }, ...(v.galeria ?? [])];
}

/** Galeria em ecrã inteiro, com uma foto por página. */
export function GaleriaCarro({ viatura, visivel, onFechar }: Props) {
  const { width, height } = useWindowDimensions();
  // Dentro do Modal o SafeAreaView fica com margens a zero no iOS; as margens do ecrã principal são as certas.
  const insets = useSafeAreaInsets();
  // Proporção de cada foto, para a área tocável ser só a imagem e o resto fechar a galeria.
  const [proporcoes, setProporcoes] = useState<Record<number, number>>({});
  const [pagina, setPagina] = useState(0);
  const [alturaArea, setAlturaArea] = useState(0);
  const rolo = useRef<ScrollView>(null);
  const fotos = fotosDaGaleria(viatura);
  const atual = fotos[Math.min(pagina, fotos.length - 1)];

  // Enquanto as setas mudam de foto, os eventos de scroll intermédios não mexem na página.
  const aMudar = useRef(false);
  function irPara(i: number) {
    aMudar.current = true;
    setTimeout(() => (aMudar.current = false), 450);
    rolo.current?.scrollTo({ x: i * width, animated: true });
    setPagina(i);
  }

  function fechar() {
    setPagina(0);
    arrasto.setValue(0);
    onFechar();
  }

  // Arrastar para cima ou para baixo fecha a galeria; um arrasto curto volta ao lugar.
  const arrasto = useRef(new Animated.Value(0)).current;
  const gesto = useRef(
    PanResponder.create({
      // Só apanha arrastos verticais; os horizontais ficam para passar de foto.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => arrasto.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) > 110 || Math.abs(g.vy) > 0.9) {
          Animated.timing(arrasto, { toValue: Math.sign(g.dy) * height, duration: 180, useNativeDriver: true }).start(() => fecharRef.current());
        } else {
          Animated.spring(arrasto, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(arrasto, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });
  const opacidade = arrasto.interpolate({ inputRange: [-height / 2, 0, height / 2], outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' });

  return (
    <Modal visible={visivel} animationType="fade" transparent onRequestClose={fechar} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <Animated.View style={[estilos.fundo, { opacity: opacidade }]} {...gesto.panHandlers}>
        <Animated.View style={{ flex: 1, transform: [{ translateY: arrasto }] }}>
          <Pressable onPress={fechar} accessible={false} style={[estilos.ecra, { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom }]}>
            <View style={estilos.topo}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.titulo} numberOfLines={1}>
                  {nomeViatura(viatura)}
                </Text>
                <Text style={estilos.subtitulo}>
                  {atual.legenda} · {Math.min(pagina, fotos.length - 1) + 1} de {fotos.length}
                </Text>
              </View>
              <Pressable onPress={fechar} accessibilityLabel="Fechar" hitSlop={12} style={({ pressed }) => [estilos.fechar, pressed && { opacity: 0.6 }]}>
                <Text style={estilos.fecharTexto}>×</Text>
              </Pressable>
            </View>

            <View style={{ flex: 1 }} onLayout={(e) => setAlturaArea(e.nativeEvent.layout.height)}>
              <ScrollView
                ref={rolo}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setPagina(Math.round(e.nativeEvent.contentOffset.x / width))}
                onScroll={(e) => !aMudar.current && setPagina(Math.round(e.nativeEvent.contentOffset.x / width))}
                scrollEventThrottle={64}
                style={StyleSheet.absoluteFill}>
                {fotos.map((f, i) => {
                  const alturaMax = Math.max(0, alturaArea - Spacing.three);
                  const proporcao = proporcoes[i] ?? 4 / 3;
                  const larguraFoto = Math.min(width, alturaMax * proporcao);
                  return (
                    // Tocar fora da foto fecha a galeria; tocar na foto não faz nada.
                    <Pressable key={i} onPress={fechar} style={{ width, height: alturaArea, alignItems: 'center', justifyContent: 'center' }}>
                      <Pressable onPress={() => {}} style={{ width: larguraFoto, height: larguraFoto / proporcao }}>
                        <Image
                          source={f.foto}
                          style={StyleSheet.absoluteFill}
                          contentFit="contain"
                          transition={200}
                          onLoad={(e) => e.source.width > 0 && setProporcoes((p) => ({ ...p, [i]: e.source.width / e.source.height }))}
                          accessibilityLabel={`${nomeViatura(viatura)}: ${f.legenda}`}
                        />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {pagina > 0 && (
                <Pressable onPress={() => irPara(pagina - 1)} accessibilityLabel="Foto anterior" style={[estilos.seta, { left: Spacing.two }]}>
                  <Text style={estilos.setaTexto}>‹</Text>
                </Pressable>
              )}
              {pagina < fotos.length - 1 && (
                <Pressable onPress={() => irPara(pagina + 1)} accessibilityLabel="Foto seguinte" style={[estilos.seta, { right: Spacing.two }]}>
                  <Text style={estilos.setaTexto}>›</Text>
                </Pressable>
              )}
            </View>

            <View style={estilos.rodape}>
              <View style={estilos.pontos}>
                {fotos.map((_, i) => (
                  <View key={i} style={[estilos.ponto, i === pagina && estilos.pontoAtivo]} />
                ))}
              </View>
              {atual.credito ? (
                <Pressable onPress={() => WebBrowser.openBrowserAsync(atual.credito!.pagina)}>
                  <Text style={estilos.credito}>
                    Foto: {atual.credito.autor} · {atual.credito.licenca}
                  </Text>
                </Pressable>
              ) : (
                <Text style={estilos.credito}>Foto enviada pelo motorista</Text>
              )}
              {fotos.length > 1 && <Text style={estilos.dica}>Desliza para ver mais</Text>}
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: '#0B0C0B' },
  ecra: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  titulo: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subtitulo: { color: '#A3A8A5', fontSize: 14, marginTop: 2 },
  fechar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F2120', alignItems: 'center', justifyContent: 'center' },
  fecharTexto: { color: '#FFFFFF', fontSize: 26, lineHeight: 28, marginTop: -2 },
  seta: { position: 'absolute', top: '50%', marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(31,33,32,0.8)', alignItems: 'center', justifyContent: 'center' },
  setaTexto: { color: '#FFFFFF', fontSize: 26, lineHeight: 28, marginTop: -3 },
  rodape: { alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.three, paddingHorizontal: Spacing.three },
  pontos: { flexDirection: 'row', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: '#3A3D3B' },
  pontoAtivo: { width: 18, backgroundColor: '#22C55E' },
  credito: { color: '#A3A8A5', fontSize: 12 },
  dica: { color: '#6B706D', fontSize: 12 },
});
