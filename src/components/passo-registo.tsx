import type { ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';

/** Um passo do registo, ao estilo da Uber: pergunta grande, explicação curta, campos, e o botão em baixo. */
export function PassoRegisto({
  titulo,
  descricao,
  children,
  rodape,
  onVoltar,
}: {
  titulo: string;
  descricao?: string;
  children?: ReactNode;
  rodape?: ReactNode;
  onVoltar?: () => void;
}) {
  const c = usePalette();
  const s = estilosPasso(c);
  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Tocar fora dos campos esconde o teclado. */}
        <Pressable style={s.corpo} onPress={Keyboard.dismiss} accessible={false}>
          {onVoltar ? <BotaoVoltar onPress={onVoltar} /> : <View style={{ height: 40 }} />}
          <Text style={s.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          {descricao ? <Text style={s.descricao}>{descricao}</Text> : null}
          {children}
        </Pressable>
        {rodape ? <View style={s.rodape}>{rodape}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Estilos partilhados pelos passos do registo. */
export function estilosPasso(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    corpo: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
    titulo: { color: c.text, fontSize: 28, fontWeight: '800', lineHeight: 34, marginTop: Spacing.four, marginBottom: Spacing.two },
    descricao: { color: c.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: Spacing.four },
    campo: {
      backgroundColor: c.backgroundElement,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      color: c.text,
      fontSize: 18,
      fontWeight: '600',
      borderWidth: 2,
      borderColor: 'transparent',
      marginBottom: Spacing.three,
      outlineWidth: 0,
    },
    campoAtivo: { borderColor: c.text, backgroundColor: c.background },
    erro: { color: '#D93025', fontSize: 14, marginBottom: Spacing.two },
    nota: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: Spacing.two },
    ligacao: { color: c.text, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline', paddingVertical: Spacing.two },
    rodape: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.two },
  });
}
