import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AgendaProvider } from '@/state/agenda';
import { InscricoesProvider } from '@/state/inscricoes';
import { PedidoProvider } from '@/state/pedido';

// O ecrã de abertura (fundo preto com o logótipo) fica até a letra da marca carregar.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [letraPronta, erroLetra] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  const pronto = letraPronta || erroLetra != null;

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync().catch(() => {});
  }, [pronto]);

  if (!pronto) return null;

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
