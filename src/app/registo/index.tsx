import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Text } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { proximoPasso, useSessao } from '@/state/sessao';

const CARRO = require('../../../assets/carros/mercedes-classe-s.webp');

/** Boas-vindas: o primeiro ecrã de quem ainda não tem conta. */
export default function BoasVindas() {
  const sessao = useSessao();
  // Quem já confirmou o número mas não acabou o registo continua onde ficou.
  if (sessao.estado === 'dentro') {
    const passo = proximoPasso(sessao.perfil);
    if (passo) return <Redirect href={passo} />;
  }
  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.corpo}>
        <Logo altura={36} variante="negativo" />
        <Image source={CARRO} style={s.carro} contentFit="contain" accessibilityLabel="Mercedes-Benz Classe S" />
        <Text style={s.titulo}>Viaturas premium, com motorista, à tua porta.</Text>
        <Text style={s.texto}>Escolhe o carro, marca a hora e paga antes. Em Maputo e Matola.</Text>
      </View>
      <View style={s.rodape}>
        <BotaoPrincipal texto="Começar" onPress={() => router.push('/registo/telefone')} />
        <Text style={s.entrar}>
          Já tens conta?{' '}
          <Text style={s.entrarLigacao} onPress={() => router.push('/registo/telefone')}>
            Entrar
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecra: { flex: 1, backgroundColor: '#0B0B0B' },
  corpo: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.five },
  carro: { width: '100%', height: 190, marginTop: Spacing.five, marginBottom: Spacing.four },
  titulo: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', lineHeight: 38, marginBottom: Spacing.three },
  texto: { color: '#9BA19E', fontSize: 16, lineHeight: 23 },
  rodape: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.three },
  entrar: { color: '#9BA19E', fontSize: 14, textAlign: 'center' },
  entrarLigacao: { color: '#FFFFFF', fontWeight: '800' },
});
