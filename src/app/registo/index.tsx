import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Text } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { entrarCom, fornecedoresDisponiveis, type Fornecedor } from '@/data/entrar-social';
import { t } from '@/i18n';
import { proximoPasso, useSessao } from '@/state/sessao';

const CARRO = require('../../../assets/carros/mercedes-classe-s.webp');

/** Boas-vindas: o primeiro ecrã de quem ainda não tem conta. */
export default function BoasVindas() {
  const sessao = useSessao();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [aEntrar, setAEntrar] = useState<Fornecedor | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    fornecedoresDisponiveis().then(setFornecedores);
  }, []);

  async function social(f: Fornecedor) {
    setErro('');
    setAEntrar(f);
    const falhou = await entrarCom(f);
    setAEntrar(null);
    if (falhou) setErro(falhou);
  }
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
        <Text style={s.titulo}>{t('Viaturas premium, com motorista, à tua porta.')}</Text>
        <Text style={s.texto}>{t('Escolhe o carro, marca a hora e paga antes. Em Maputo, Matola e Luanda.')}</Text>
      </View>
      <View style={s.rodape}>
        <BotaoPrincipal texto={t('Começar')} onPress={() => router.push('/registo/telefone')} />
        {fornecedores.map((f) => (
          <Pressable key={f} style={s.social} onPress={() => social(f)} disabled={aEntrar != null} accessibilityRole="button">
            {aEntrar === f ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.socialTexto}>{f === 'apple' ? t(' Continuar com a Apple') : t('Continuar com o Google')}</Text>
            )}
          </Pressable>
        ))}
        {erro ? <Text style={s.erro}>{erro}</Text> : null}
        <Text style={s.entrar}>
          {t('Já tens conta?')}{' '}
          <Text style={s.entrarLigacao} onPress={() => router.push('/registo/telefone')}>
            {t('Entrar')}
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
  social: { borderRadius: Radius.botao, borderWidth: 1, borderColor: '#3A3F3C', paddingVertical: 14, alignItems: 'center' },
  socialTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  erro: { color: '#F87171', fontSize: 13, textAlign: 'center' },
  entrar: { color: '#9BA19E', fontSize: 14, textAlign: 'center' },
  entrarLigacao: { color: '#FFFFFF', fontWeight: '800' },
});
