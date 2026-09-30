import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as ScrollViewGestos } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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

  const arrasto = useSharedValue(0);

  function fechar() {
    setPagina(0);
    onFechar();
  }

  // A foto só volta ao centro depois de o Modal acabar de desaparecer. Repô-la logo ao fechar
  // fazia-a saltar de volta ao meio durante o fade, e isso via-se como um tremor.
  useEffect(() => {
    if (visivel) return;
    const t = setTimeout(() => (arrasto.value = 0), 400);
    return () => clearTimeout(t);
  }, [visivel, arrasto]);

  // Arrastar para cima ou para baixo fecha a galeria; um arrasto curto volta ao lugar.
  // Com o Gesture Handler o gesto funciona também em cima da foto: o arrasto vertical é dele,
  // o horizontal falha logo e fica para o ScrollView passar de foto.
  const gesto = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onUpdate((e) => {
      // Desconta os 12 px que o gesto espera antes de começar, para a foto não dar um salto.
      arrasto.value = e.translationY - Math.sign(e.translationY) * 12;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > 110 || Math.abs(e.velocityY) > 900) {
        arrasto.value = withTiming(Math.sign(e.translationY || e.velocityY) * height, { duration: 180 }, (acabou) => {
          if (acabou) runOnJS(fechar)();
        });
      } else {
        arrasto.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });
  const estiloFundo = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(arrasto.value), [0, height / 2], [1, 0.2], 'clamp') }));
  const estiloEcra = useAnimatedStyle(() => ({ transform: [{ translateY: arrasto.value }] }));

  return (
    <Modal visible={visivel} animationType="fade" transparent onRequestClose={fechar} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      {/* No Android o Modal é uma janela à parte e precisa da sua própria raiz de gestos. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={gesto}>
          <Animated.View style={[estilos.fundo, estiloFundo]}>
            <Animated.View style={[{ flex: 1 }, estiloEcra]}>
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
                    {/* Um X desenhado com dois traços fica sempre no centro; o carácter × dependia da letra. */}
                    <View style={[estilos.traco, { transform: [{ rotate: '45deg' }] }]} />
                    <View style={[estilos.traco, { transform: [{ rotate: '-45deg' }] }]} />
                  </Pressable>
                </View>

                <View style={{ flex: 1 }} onLayout={(e) => setAlturaArea(e.nativeEvent.layout.height)}>
                  <Rolo
                    ref={rolo}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => setPagina(Math.round(e.nativeEvent.contentOffset.x / width))}
                    onScroll={(e) => !aMudar.current && setPagina(Math.round(e.nativeEvent.contentOffset.x / width))}
                    scrollEventThrottle={64}
                    style={[StyleSheet.absoluteFill, ARRASTO_VERTICAL_NA_WEB]}>
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
                  </Rolo>
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
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// No telemóvel o rolo do Gesture Handler combina o arrasto horizontal com o vertical de fechar.
// No browser esse rolo deixa o browser ficar com o arrasto vertical (e cancelar o gesto),
// por isso lá usa-se o normal, só com arrasto horizontal.
const Rolo = Platform.OS === 'web' ? ScrollView : ScrollViewGestos;
const ARRASTO_VERTICAL_NA_WEB = Platform.OS === 'web' ? ({ touchAction: 'pan-x' } as object) : null;

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: '#0B0C0B' },
  ecra: { flex: 1 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  titulo: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subtitulo: { color: '#A3A8A5', fontSize: 14, marginTop: 2 },
  fechar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F2120', alignItems: 'center', justifyContent: 'center' },
  traco: { position: 'absolute', width: 16, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  seta: { position: 'absolute', top: '50%', marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(31,33,32,0.8)', alignItems: 'center', justifyContent: 'center' },
  setaTexto: { color: '#FFFFFF', fontSize: 26, lineHeight: 28, marginTop: -3 },
  rodape: { alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.three, paddingHorizontal: Spacing.three },
  pontos: { flexDirection: 'row', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: Radius.pill, backgroundColor: '#3A3D3B' },
  pontoAtivo: { width: 18, backgroundColor: '#22C55E' },
  credito: { color: '#A3A8A5', fontSize: 12 },
  dica: { color: '#6B706D', fontSize: 12 },
});
