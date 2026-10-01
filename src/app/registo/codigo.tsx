import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type TextInput as RNTextInput } from 'react-native';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text, TextInput } from '@/components/texto';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarNumero } from '@/data/telefone';
import { t } from '@/i18n';
import { digitosCodigo, MOTORISTA_DEMO, proximoPasso, useSessao } from '@/state/sessao';

// Tempo até se poder pedir outro código.
const ESPERA_REENVIO = 30;

export default function Codigo() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const { telefone = '' } = useLocalSearchParams<{ telefone: string }>();
  const [codigo, setCodigo] = useState('');
  const [aConfirmar, setAConfirmar] = useState(false);
  const [erro, setErro] = useState('');
  const [segundos, setSegundos] = useState(ESPERA_REENVIO);
  const [confirmado, setConfirmado] = useState(false);
  const campo = useRef<RNTextInput>(null);
  const digitos = digitosCodigo(telefone);
  const demo = telefone === MOTORISTA_DEMO.telefone;

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  // Número confirmado: segue para o passo que falta. Quem já tinha a conta completa entra logo na app.
  useEffect(() => {
    if (!confirmado || sessao.estado !== 'dentro') return;
    const passo = proximoPasso(sessao.perfil);
    if (passo) router.replace(passo);
  }, [confirmado, sessao.estado, sessao.perfil]);

  async function confirmar(valor: string) {
    setAConfirmar(true);
    setErro('');
    const falhou = await sessao.confirmarCodigo(telefone, valor);
    setAConfirmar(false);
    if (falhou) {
      setErro(falhou);
      setCodigo('');
      campo.current?.focus();
      return;
    }
    setConfirmado(true);
  }

  async function reenviar() {
    setErro('');
    setSegundos(ESPERA_REENVIO);
    const falhou = await sessao.pedirCodigo(telefone);
    if (falhou) setErro(falhou);
  }

  return (
    <PassoRegisto
      titulo={t('Escreve o código de {n} dígitos', { n: digitos })}
      descricao={demo ? t('Conta de demonstração do motorista: escreve o código de acesso.') : t('Enviámos para +258 {numero}.', { numero: formatarNumero(telefone) })}
      onVoltar={() => router.back()}>
      {/* Um campo escondido recebe os dígitos (e o código da SMS, que o telemóvel sugere sozinho); as caixas só mostram. */}
      <Pressable onPress={() => campo.current?.focus()} style={estilos.caixas} accessibilityLabel={t('Código de confirmação')}>
        {Array.from({ length: digitos }, (_, i) => {
          const ativo = i === codigo.length && !aConfirmar;
          return (
            <View key={i} style={[estilos.caixa, { backgroundColor: ativo ? c.background : c.backgroundElement, borderColor: ativo ? c.text : 'transparent' }]}>
              <Text style={[estilos.digito, { color: c.text }]}>{codigo[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={campo}
        value={codigo}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, digitos);
          setCodigo(v);
          setErro('');
          if (v.length === digitos) confirmar(v);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={digitos}
        editable={!aConfirmar}
        accessibilityLabel={t('Código')}
        style={estilos.escondido}
      />
      {aConfirmar && <ActivityIndicator color={c.text} style={{ alignSelf: 'flex-start', marginBottom: Spacing.two }} />}
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      {demo ? null : segundos > 0 ? (
        <Text style={[s.ligacao, { color: c.textSecondary, textDecorationLine: 'none' }]}>{t('Reenviar código em 0:{s}', { s: String(segundos).padStart(2, '0') })}</Text>
      ) : (
        <Text style={s.ligacao} onPress={reenviar}>
          {t('Reenviar código')}
        </Text>
      )}
      <Text style={s.ligacao} onPress={() => router.back()}>
        {t('Mudar o número')}
      </Text>
    </PassoRegisto>
  );
}

const estilos = StyleSheet.create({
  caixas: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  caixa: { flex: 1, maxWidth: 56, height: 62, borderRadius: Radius.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  digito: { fontSize: 26, fontWeight: '800' },
  escondido: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
