import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarHora } from '@/data/agenda';
import { useAcompanharChat, useChat, type LadoChat } from '@/state/chat';
import { useModoMotorista } from '@/state/modo-motorista';
import { useSessao } from '@/state/sessao';
import { Text, TextInput } from '@/components/texto';
import { t } from '@/i18n';

// Respostas rápidas, para escrever pouco enquanto se espera pelo carro.
const RAPIDAS: Record<LadoChat, string[]> = {
  cliente: ['Já estou a sair', 'Estou à porta', 'Quanto tempo demora?', 'Tenho bagagem'],
  motorista: ['Estou a chegar', 'Já cheguei', 'Há trânsito, chego em breve', 'Onde estás exatamente?'],
};

/**
 * Mensagens entre o cliente e o motorista da viagem, sem trocar números de telefone.
 * Parâmetros: id da viagem, de que lado está quem escreve, e o nome e o detalhe do outro lado.
 */
export default function Chat() {
  const cores = usePalette();
  const s = estilos(cores);
  const p = useLocalSearchParams<{ id: string; como?: LadoChat; nome?: string; detalhe?: string }>();
  const eu: LadoChat = p.como === 'motorista' ? 'motorista' : 'cliente';
  const chat = useChat();
  const { perfil } = useSessao();
  const modo = useModoMotorista();
  const meuNome = eu === 'motorista' ? modo.eu.nome : (perfil?.nome ?? t('Cliente'));
  const mensagens = chat.mensagens(p.id);
  const outro = p.nome || (eu === 'motorista' ? t('Cliente') : t('Motorista'));
  const [texto, setTexto] = useState('');
  const rolo = useRef<ScrollView>(null);
  useAcompanharChat(p.id, eu);

  // Com o chat aberto, as mensagens do outro lado contam como lidas.
  const { marcarLidas } = chat;
  useEffect(() => {
    marcarLidas(p.id, eu);
  }, [mensagens.length, marcarLidas, p.id, eu]);

  function enviar(mensagem: string) {
    chat.enviar(p.id, eu, meuNome, mensagem);
    setTexto('');
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <View style={s.avatar}>
          <Text style={s.avatarTexto}>{outro[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>{outro}</Text>
          {p.detalhe ? <Text style={s.secundario}>{p.detalhe}</Text> : null}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={rolo} contentContainerStyle={s.lista} onContentSizeChange={() => rolo.current?.scrollToEnd({ animated: true })}>
          <Text style={s.aviso}>{eu === 'cliente' ? t('As mensagens ficam guardadas na viagem. O teu número não é partilhado com o motorista.') : t('As mensagens ficam guardadas na viagem. Não escrevas enquanto conduzes.')}</Text>
          {mensagens.map((m) => (
            <View key={m.id} style={[s.balao, m.de === eu ? s.meu : s.dele]}>
              <Text style={[s.textoBalao, m.de === eu && { color: cores.onPrimary }]}>{m.texto}</Text>
              <Text style={[s.hora, m.de === eu && { color: cores.onPrimary, opacity: 0.7 }]}>{formatarHora(new Date(m.em))}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={s.rapidas} keyboardShouldPersistTaps="handled">
          {RAPIDAS[eu].map((r) => (
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
