import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { TEXTOS_LEGAIS, type DocumentoLegal } from '@/data/textos-legais';
import { idiomaAtual, t } from '@/i18n';

/** Termos de Utilização ou Política de Privacidade, abertos a partir do registo ou da conta. */
export default function Legal() {
  const c = usePalette();
  const s = estilos(c);
  const { doc } = useLocalSearchParams<{ doc: DocumentoLegal }>();
  const texto = TEXTOS_LEGAIS[doc === 'privacidade' ? 'privacidade' : 'termos'];

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        {/* Os textos legais só existem em português. */}
        {idiomaAtual() === 'en' && <Text style={[s.paragrafo, { color: c.textSecondary, fontStyle: 'italic' }]}>{t('Os textos legais estão em português.')}</Text>}
        {blocos(texto, s)}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Desenha o texto (títulos, parágrafos, listas e tabelas simples), com **negrito**. */
function blocos(texto: string, s: ReturnType<typeof estilos>): ReactNode[] {
  const linhas = texto.split('\n');
  const saida: ReactNode[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l.trim()) continue;
    if (l.startsWith('## ')) saida.push(<Text key={i} style={s.titulo} accessibilityRole="header">{l.slice(3)}</Text>);
    else if (l.startsWith('### ')) saida.push(<Text key={i} style={s.secao} accessibilityRole="header">{l.slice(4)}</Text>);
    else if (l.startsWith('- ')) {
      saida.push(
        <View key={i} style={s.item}>
          <Text style={s.paragrafo}>•</Text>
          <Text style={[s.paragrafo, { flex: 1 }]}>{negrito(l.slice(2), s)}</Text>
        </View>,
      );
    } else if (l.startsWith('|')) {
      // Tabela: o cabeçalho dá os nomes; cada linha vira um cartão.
      const celulas = (x: string) => x.split('|').slice(1, -1).map((t) => t.trim());
      const cabecalho = celulas(l);
      i += 2;
      while (i < linhas.length && linhas[i].startsWith('|')) {
        const linha = celulas(linhas[i]);
        saida.push(
          <View key={i} style={s.cartao}>
            <Text style={s.cartaoTitulo}>{linha[0]}</Text>
            {linha.slice(1).map((t, j) => (
              <Text key={j} style={s.cartaoTexto}>
                <Text style={{ fontWeight: '700' }}>{cabecalho[j + 1]}: </Text>
                {t}
              </Text>
            ))}
          </View>,
        );
        i++;
      }
      i--;
    } else saida.push(<Text key={i} style={s.paragrafo}>{negrito(l, s)}</Text>);
  }
  return saida;
}

function negrito(texto: string, s: ReturnType<typeof estilos>): ReactNode {
  return texto.split(/(\*\*[^*]+\*\*)/).map((parte, i) =>
    parte.startsWith('**') ? (
      <Text key={i} style={s.forte}>
        {parte.slice(2, -2)}
      </Text>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    ),
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    conteudo: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.two },
    titulo: { color: c.text, fontSize: 26, fontWeight: '800', marginBottom: Spacing.two },
    secao: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: Spacing.three },
    paragrafo: { color: c.text, fontSize: 15, lineHeight: 22 },
    forte: { fontWeight: '800' },
    item: { flexDirection: 'row', gap: Spacing.two },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    cartaoTitulo: { color: c.text, fontSize: 15, fontWeight: '800' },
    cartaoTexto: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  });
}
