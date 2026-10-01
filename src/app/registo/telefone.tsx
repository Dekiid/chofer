import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarNumero, NUMERO_VALIDO } from '@/data/telefone';
import { CODIGO_TESTE, MOTORISTA_DEMO, useSessao } from '@/state/sessao';

export default function Telefone() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const [digitos, setDigitos] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const [semSmsNoServidor, setSemSmsNoServidor] = useState(false);
  // O número da conta de demonstração do motorista tem 8 dígitos.
  const demo = `+258${digitos}` === MOTORISTA_DEMO.telefone;
  const valido = NUMERO_VALIDO.test(digitos) || demo;

  async function continuar() {
    setAEnviar(true);
    setErro('');
    const telefone = `+258${digitos}`;
    const falhou = await sessao.pedirCodigo(telefone);
    setAEnviar(false);
    if (falhou) {
      setErro(falhou);
      setSemSmsNoServidor(falhou.startsWith('O envio de SMS ainda não está ligado'));
      return;
    }
    router.push({ pathname: '/registo/codigo', params: { telefone } });
  }

  return (
    <PassoRegisto
      titulo="Qual é o teu número de telemóvel?"
      descricao="Enviamos um código por SMS para confirmar."
      onVoltar={() => router.back()}
      rodape={
        aEnviar ? (
          <ActivityIndicator color={c.text} style={{ paddingVertical: Spacing.three }} />
        ) : (
          <BotaoPrincipal texto="Continuar" escuro onPress={continuar} desativado={!valido} />
        )
      }>
      <View style={[s.campo, s.campoAtivo, estilos.linha]}>
        <Text style={[estilos.prefixo, { color: c.text, borderRightColor: c.backgroundSelected }]} numberOfLines={1}>
          🇲🇿 +258
        </Text>
        <TextInput
          value={formatarNumero(digitos)}
          onChangeText={(t) => {
            setDigitos(t.replace(/\D/g, '').replace(/^258/, '').slice(0, 9));
            setErro('');
          }}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          placeholder="84 123 4567"
          placeholderTextColor={c.textSecondary}
          onSubmitEditing={() => valido && continuar()}
          accessibilityLabel="Número de telemóvel"
          style={[estilos.numero, { color: c.text }]}
        />
      </View>
      {digitos.length === 9 && !valido ? <Text style={s.erro}>O número tem de começar por 82, 83, 84, 85, 86 ou 87.</Text> : null}
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      {semSmsNoServidor && (
        <Text
          style={s.ligacao}
          onPress={() => {
            sessao.usarSemSms();
            setErro('');
            setSemSmsNoServidor(false);
          }}>
          Continuar sem SMS (teste)
        </Text>
      )}
      {sessao.semSms && !demo && (
        <View style={[estilos.teste, { backgroundColor: c.backgroundElement }]}>
          <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>
            Modo de teste, sem SMS: o código é sempre {CODIGO_TESTE} e a conta fica só neste telemóvel.
          </Text>
        </View>
      )}
      <Text style={s.nota}>Ao continuar, aceitas receber chamadas e SMS do Chauffeur, incluindo mensagens automáticas, para este número.</Text>
    </PassoRegisto>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 0 },
  prefixo: { flexShrink: 0, fontSize: 18, fontWeight: '700', paddingRight: Spacing.three, borderRightWidth: 1, paddingVertical: Spacing.three },
  numero: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '700', paddingVertical: Spacing.three, outlineWidth: 0 },
  teste: { borderRadius: Radius.card, padding: Spacing.three, marginTop: Spacing.two },
});
