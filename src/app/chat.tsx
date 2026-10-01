import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarHora } from '@/data/agenda';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { useConta } from '@/state/conta';
import { usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';
import { t } from '@/i18n';

// Respostas rápidas, para escrever pouco enquanto se espera pelo carro.
const RAPIDAS = ['Já estou a sair', 'Estou à porta', 'Quanto tempo demora?', 'Tenho bagagem'];

/** Mensagens com o motorista dentro da app, sem trocar números de telefone. */
export default function Chat() {
  const cores = usePalette();
  const s = estilos(cores);
  const { mensagens, enviarMensagem, marcarChatLido } = useConta();
  const motorista = usePedido().viatura.motorista ?? MOTORISTA_EXEMPLO;
  const [texto, setTexto] = useState('');
  const rolo = useRef<ScrollView>(null);

  // Com o chat aberto, as mensagens do motorista contam como lidas.
  useEffect(() => {
    marcarChatLido();
  }, [mensagens.length, marcarChatLido]);

  function enviar(mensagem: string) {
    enviarMensagem(mensagem);
    setTexto('');
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <View style={s.avatar}>
          <Text style={s.avatarTexto}>{motorista.nome[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>{motorista.nome}</Text>
          <Text style={s.secundario}>{motorista.matricula}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={rolo} contentContainerStyle={s.lista} onContentSizeChange={() => rolo.current?.scrollToEnd({ animated: true })}>
          <Text style={s.aviso}>{t('As mensagens ficam guardadas na viagem. O teu número não é partilhado com o motorista.')}</Text>
          {mensagens.map((m) => (
            <View key={m.id} style={[s.balao, m.de === 'cliente' ? s.meu : s.dele]}>
              <Text style={[s.textoBalao, m.de === 'cliente' && { color: cores.onPrimary }]}>{m.texto}</Text>
              <Text style={[s.hora, m.de === 'cliente' && { color: cores.onPrimary, opacity: 0.7 }]}>{formatarHora(m.em)}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={s.rapidas} keyboardShouldPersistTaps="handled">
          {RAPIDAS.map((r) => (
            <Pressable key={r} onPress={() => enviar(t(r))} style={s.rapida}>
              <Text style={s.rapidaTexto}>{t(r)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={s.escrever}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={t('Mensagem')}
            placeholderTextColor={cores.textSecondary}
            style={s.input}
            returnKeyType="send"
            onSubmitEditing={() => enviar(texto)}
            maxLength={300}
          />
          <Pressable onPress={() => enviar(texto)} disabled={!texto.trim()} style={[s.enviar, !texto.trim() && { opacity: 0.4 }]} accessibilityLabel={t('Enviar')}>
            <Text style={s.enviarTexto}>{t('Enviar')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.backgroundSelected, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { color: c.text, fontSize: 17, fontWeight: '800' },
    titulo: { color: c.text, fontSize: 17, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 13 },
    lista: { padding: Spacing.three, gap: Spacing.two },
    aviso: { color: c.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: Spacing.two },
    balao: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    meu: { alignSelf: 'flex-end', backgroundColor: c.primary, borderBottomRightRadius: 4 },
    dele: { alignSelf: 'flex-start', backgroundColor: c.backgroundElement, borderBottomLeftRadius: 4 },
    textoBalao: { color: c.text, fontSize: 15 },
    hora: { color: c.textSecondary, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
    rapidas: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    rapida: { borderRadius: Radius.pill, borderWidth: 1, borderColor: c.backgroundSelected, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    rapidaTexto: { color: c.text, fontSize: 13, fontWeight: '600' },
    escrever: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
    input: { flex: 1, backgroundColor: c.backgroundElement, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 4, color: c.text, fontSize: 15 },
    enviar: { backgroundColor: c.go, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 4 },
    enviarTexto: { color: c.onGo, fontWeight: '700' },
  });
}
