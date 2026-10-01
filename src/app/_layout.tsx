import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AvisoTopo } from '@/components/aviso-topo';
import { BemVindo } from '@/components/bem-vindo';
import { Logo } from '@/components/logo';
import { Text } from '@/components/texto';
// Define a tarefa da localização em segundo plano logo ao abrir a app, como o TaskManager exige.
import '@/data/localizacao-fundo';

import { AgendaProvider } from '@/state/agenda';
import { ContaProvider } from '@/state/conta';
import { InscricoesProvider } from '@/state/inscricoes';
import { ModoMotoristaProvider } from '@/state/modo-motorista';
import { PedidoProvider } from '@/state/pedido';
import { useMotoristaAprovado } from '@/state/permissoes';
import { SessaoProvider, useSessao } from '@/state/sessao';
import { SuporteProvider } from '@/state/suporte';

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
  if (abertura) return <Abertura />;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessaoProvider>
        <AgendaProvider>
          <InscricoesProvider>
            <PedidoProvider>
              <ModoMotoristaProvider>
                <ContaProvider>
                  <SuporteProvider>
                    <StatusBar style="auto" />
                    <Navegacao />
                    <AvisoTopo />
                    <BemVindo />
                  </SuporteProvider>
                </ContaProvider>
              </ModoMotoristaProvider>
            </PedidoProvider>
          </InscricoesProvider>
        </AgendaProvider>
      </SessaoProvider>
    </ThemeProvider>
  );
}

/** Abertura do manual: fundo preto, logótipo e cidade. */
function Abertura() {
  return (
    <View style={estilos.abertura}>
      <StatusBar style="light" />
      <Logo altura={44} variante="negativo" />
      <Text style={estilos.cidade}>Maputo · Moçambique</Text>
    </View>
  );
}

/** Sem conta (ou com o registo a meio) só se vê o registo; com conta, a app toda. */
function Navegacao() {
  const sessao = useSessao();
  const motorista = useMotoristaAprovado();
  if (sessao.estado === 'a_carregar') return <Abertura />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={sessao.completo}>
        <Stack.Screen name="index" />
        <Stack.Screen name="destino" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="confirmar" />
        <Stack.Screen name="reserva" />
        <Stack.Screen name="pagamento" options={{ gestureEnabled: false }} />
        <Stack.Screen name="viagem" options={{ gestureEnabled: false }} />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="recibo" />
        <Stack.Screen name="viagens" />
        <Stack.Screen name="conta" />
        <Stack.Screen name="inscricao" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="aprovacoes" />
        <Stack.Screen name="gestao" />
        <Stack.Screen name="agenda" />
        <Stack.Screen name="ajuda" />
        <Stack.Screen name="suporte" />
        <Stack.Screen name="empresa" />
        {/* Só para motoristas aprovados (ou a conta de demonstração). */}
        <Stack.Protected guard={motorista.pode}>
          {/* No motorista, deslizar para aceitar não pode ativar o gesto de voltar atrás do iPhone. */}
          <Stack.Screen name="motorista" options={{ gestureEnabled: false }} />
          <Stack.Screen name="pedidos-motorista" options={{ gestureEnabled: false }} />
          <Stack.Screen name="ganhos" />
          <Stack.Screen name="documentos" />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={!sessao.completo}>
        <Stack.Screen name="registo" />
      </Stack.Protected>
      {/* Os termos abrem-se do registo e da conta. */}
      <Stack.Screen name="legal" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

const estilos = StyleSheet.create({
  abertura: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  cidade: { position: 'absolute', bottom: 48, color: '#8A908C', fontSize: 13, fontWeight: '500' },
});
