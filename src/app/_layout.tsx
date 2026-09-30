import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Logo } from '@/components/logo';
import { Text } from '@/components/texto';

import { AgendaProvider } from '@/state/agenda';
import { InscricoesProvider } from '@/state/inscricoes';
import { PedidoProvider } from '@/state/pedido';

// O ecrã de abertura (fundo preto com o logótipo) fica até a letra da marca carregar.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [letraPronta, erroLetra] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  const pronto = letraPronta || erroLetra != null;
  const [abertura, setAbertura] = useState(true);

  useEffect(() => {
    if (!pronto) return;
    SplashScreen.hideAsync().catch(() => {});
    // Abertura do manual: fundo preto, logótipo e cidade, durante um instante.
    const t = setTimeout(() => setAbertura(false), 1400);
    return () => clearTimeout(t);
  }, [pronto]);

  if (!pronto) return null;
  if (abertura) {
    return (
      <View style={estilos.abertura}>
        <StatusBar style="light" />
        <Logo altura={44} variante="negativo" />
        <Text style={estilos.cidade}>Maputo · Moçambique</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AgendaProvider>
        <InscricoesProvider>
          <PedidoProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="destino" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="viagem" options={{ gestureEnabled: false }} />
              <Stack.Screen name="pagamento" options={{ gestureEnabled: false }} />
              <Stack.Screen name="inscricao" options={{ animation: 'slide_from_bottom' }} />
            </Stack>
          </PedidoProvider>
        </InscricoesProvider>
      </AgendaProvider>
    </ThemeProvider>
  );
}

const estilos = StyleSheet.create({
  abertura: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  cidade: { position: 'absolute', bottom: 48, color: '#8A908C', fontSize: 13, fontWeight: '500' },
});
