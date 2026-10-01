import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoSecundario, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { t } from '@/i18n';
import { useConta } from '@/state/conta';
import { useSessao } from '@/state/sessao';

/** Dados para o recibo com NUIT, para quem precisa de justificar a despesa (trabalhadores por conta própria, por exemplo). */
export default function Faturacao() {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const { perfil } = useSessao();
  const [nome, setNome] = useState(conta.faturacao?.nome ?? (perfil?.nome ? `${perfil.nome} ${perfil.apelido ?? ''}`.trim() : ''));
  const [nuit, setNuit] = useState(conta.faturacao?.nuit ?? '');
  const [morada, setMorada] = useState(conta.faturacao?.morada ?? '');
  const nuitValido = /^\d{9}$/.test(nuit);
  const valido = nome.trim().length >= 2 && nuitValido;

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Recibos com NUIT')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={s.ajuda}>{t('O teu nome e NUIT passam a aparecer em todos os recibos em PDF, para justificares a despesa.')}</Text>
          <Text style={s.rotulo}>{t('Nome no recibo')}</Text>
          <TextInput value={nome} onChangeText={setNome} placeholder={t('Nome completo ou da tua atividade')} placeholderTextColor={cores.textSecondary} style={s.campo} />
          <Text style={s.rotulo}>NUIT</Text>
          <TextInput
            value={nuit}
            onChangeText={(v) => setNuit(v.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            placeholder={t('9 números')}
            placeholderTextColor={cores.textSecondary}
            style={s.campo}
          />
          {nuit.length > 0 && !nuitValido && <Text style={s.erro}>{t('O NUIT tem 9 números.')}</Text>}
          <Text style={s.rotulo}>{t('Morada (opcional)')}</Text>
          <TextInput value={morada} onChangeText={setMorada} placeholder={t('Ex.: Av. Julius Nyerere 123, Maputo')} placeholderTextColor={cores.textSecondary} style={s.campo} />
          <View style={{ height: Spacing.three }} />
          <BotaoPrincipal
            texto={t('Guardar')}
            desativado={!valido}
            onPress={() => {
              conta.setFaturacao({ nome: nome.trim(), nuit, morada: morada.trim() });
              router.back();
            }}
          />
          {conta.faturacao && (
            <BotaoSecundario
              texto={t('Deixar de pôr o NUIT')}
              onPress={() => {
                conta.setFaturacao(null);
                router.back();
              }}
            />
          )}
          <Text style={[s.ajuda, { marginTop: Spacing.two }]}>{t('Para viagens de uma empresa, usa antes a conta de empresa: junta tudo numa fatura por mês.')}</Text>
        </ScrollView>
      </FecharTeclado>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
    rotulo: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: Spacing.two },
    ajuda: { color: c.textSecondary, fontSize: 13 },
    erro: { color: '#DC2626', fontSize: 13 },
    campo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 16 },
  });
}
