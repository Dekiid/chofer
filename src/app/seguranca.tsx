import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import type { PartilhaAuto } from '@/data/extras-viagem';
import { formatarTelefone, normalizarTelefone } from '@/data/motorista';
import { t } from '@/i18n';
import { useConta } from '@/state/conta';

const MAX_CONTACTOS = 5;

/** Contactos de confiança: recebem a viagem partilhada sozinha (sempre ou à noite) e quando tocas no SOS. */
export default function Seguranca() {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const valido = normalizarTelefone(telefone);
  const regras: { v: PartilhaAuto; nome: string }[] = [
    { v: 'sempre', nome: t('Sempre') },
    { v: 'noite', nome: t('À noite') },
    { v: 'nunca', nome: t('Nunca') },
  ];

  function juntar() {
    if (!valido || nome.trim().length < 2) return;
    conta.setContactosConfianca([...conta.contactosConfianca, { nome: nome.trim(), telefone: valido }].slice(0, MAX_CONTACTOS));
    setNome('');
    setTelefone('');
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Contactos de confiança')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={s.ajuda}>{t('Recebem o percurso, o carro, a matrícula e o motorista da tua viagem. Também são avisados quando tocas no SOS.')}</Text>

          <Text style={s.secao}>{t('Partilhar a viagem sozinha')}</Text>
          <View style={s.segmentos}>
            {regras.map((r) => {
              const ativo = conta.partilhaAuto === r.v;
              return (
                <Pressable key={r.v} onPress={() => conta.setPartilhaAuto(r.v)} style={[s.segmento, ativo && s.segmentoAtivo]}>
                  <Text style={[s.textoSegmento, ativo && s.textoSegmentoAtivo]}>{r.nome}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.ajuda}>{conta.partilhaAuto === 'noite' ? t('Das 20h às 6h.') : conta.partilhaAuto === 'sempre' ? t('Em todas as viagens.') : t('Só quando partilhares tu.')}</Text>

          <Text style={s.secao}>{t('Os teus contactos')}</Text>
          {conta.contactosConfianca.length === 0 && <Text style={s.ajuda}>{t('Ainda não tens contactos de confiança.')}</Text>}
          {conta.contactosConfianca.map((c, i) => (
            <View key={c.telefone} style={s.contacto}>
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{c.nome}</Text>
                <Text style={s.ajuda}>{formatarTelefone(c.telefone)}</Text>
              </View>
              <Text style={s.tirar} onPress={() => conta.setContactosConfianca(conta.contactosConfianca.filter((_, j) => j !== i))}>
                {t('Tirar')}
              </Text>
            </View>
          ))}

          {conta.contactosConfianca.length < MAX_CONTACTOS && (
            <>
              <Text style={s.rotulo}>{t('Juntar um contacto')}</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder={t('Nome')} placeholderTextColor={cores.textSecondary} style={s.campo} />
              <TextInput
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder={t('Telemóvel, ex.: 84 123 4567')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              <BotaoPrincipal texto={t('Juntar')} desativado={!valido || nome.trim().length < 2} onPress={juntar} />
            </>
          )}
          <Text style={s.nota}>{t('Em testes, a partilha aparece como aviso na app. O envio por SMS liga-se com o fornecedor de SMS.')}</Text>
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
    secao: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: Spacing.three },
    rotulo: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: Spacing.two },
    ajuda: { color: c.textSecondary, fontSize: 13 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: Spacing.two },
    campo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 16 },
    segmentos: { flexDirection: 'row', backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: 4 },
    segmento: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    segmentoAtivo: { backgroundColor: c.background },
    textoSegmento: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    textoSegmentoAtivo: { color: c.text, fontWeight: '800' },
    contacto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three },
    nome: { color: c.text, fontSize: 15, fontWeight: '700' },
    tirar: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
  });
}
