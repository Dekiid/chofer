import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { InscricoesProvider } from '@/state/inscricoes';
import { PedidoProvider } from '@/state/pedido';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
    </ThemeProvider>
  );
}
