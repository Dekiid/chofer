import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { definirPais, paisAtual, PAISES, type CodigoPais } from '@/data/paises';
import { t } from '@/i18n';
import { CODIGO_TESTE, contaDemo, useSessao } from '@/state/sessao';

export default function Telefone() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const [codigoPais, setCodigoPais] = useState<CodigoPais>(paisAtual().codigo);
  const pais = PAISES[codigoPais];
  const [digitos, setDigitos] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const [semSmsNoServidor, setSemSmsNoServidor] = useState(false);
  // O número da conta de demonstração do motorista tem 8 dígitos.
  const demo = Boolean(contaDemo(`${pais.indicativo}${digitos}`));
  const valido = pais.numero.test(digitos) || demo;

  function escolherPais(codigo: CodigoPais) {
    setCodigoPais(codigo);
    setDigitos('');
    setErro('');
    // Os preços e os lugares passam logo para o país escolhido.
    definirPais(codigo);
  }

  async function continuar() {
    setAEnviar(true);
    setErro('');
    const telefone = `${pais.indicativo}${digitos}`;
    const falhou = await sessao.pedirCodigo(telefone);
    setAEnviar(false);
    if (falhou) {
      setErro(falhou);
      setSemSmsNoServidor(falhou === t('O envio de SMS ainda não está ligado no Supabase.'));
      return;
    }
    router.push({ pathname: '/registo/codigo', params: { telefone } });
  }

  return (
    <PassoRegisto
      titulo={t('Qual é o teu número de telemóvel?')}
      descricao={t('Enviamos um código por SMS para confirmar.')}
      onVoltar={() => router.back()}
      rodape={
        aEnviar ? (
          <ActivityIndicator color={c.text} style={{ paddingVertical: Spacing.three }} />
        ) : (
          <BotaoPrincipal texto={t('Continuar')} escuro onPress={continuar} desativado={!valido} />
        )
      }>
      <View style={estilos.paises}>
        {Object.values(PAISES).map((p) => {
          const ativo = p.codigo === codigoPais;
          return (
            <Pressable
              key={p.codigo}
              onPress={() => escolherPais(p.codigo)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              style={[estilos.pais, { backgroundColor: c.backgroundElement, borderColor: ativo ? c.text : 'transparent' }]}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: ativo ? '800' : '600' }} numberOfLines={1}>
                {p.bandeira} {t(p.nome)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.campo, s.campoAtivo, estilos.linha]}>
        <Text style={[estilos.prefixo, { color: c.text, borderRightColor: c.backgroundSelected }]} numberOfLines={1}>
          {pais.bandeira} {pais.indicativo}
        </Text>
        <TextInput
          value={pais.formatar(digitos)}
          onChangeText={(t) => {
            setDigitos(t.replace(/\D/g, '').replace(new RegExp(`^${pais.indicativo.slice(1)}`), '').slice(0, 9));
            setErro('');
          }}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          placeholder={pais.exemploNumero}
          placeholderTextColor={c.textSecondary}
          onSubmitEditing={() => valido && continuar()}
          accessibilityLabel={t('Número de telemóvel')}
          style={[estilos.numero, { color: c.text }]}
        />
      </View>
      {digitos.length === 9 && !valido ? <Text style={s.erro}>{t('O número tem de começar por {prefixos}.', { prefixos: pais.prefixos.replace(' ou ', ` ${t('ou')} `).replace(' a ', ` ${t('a')} `) })}</Text> : null}
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      {semSmsNoServidor && (
        <Text
          style={s.ligacao}
          onPress={() => {
            sessao.usarSemSms();
            setErro('');
            setSemSmsNoServidor(false);
          }}>
          {t('Continuar sem SMS (teste)')}
        </Text>
      )}
      {sessao.semSms && !demo && (
        <View style={[estilos.teste, { backgroundColor: c.backgroundElement }]}>
          <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>
            {t('Modo de teste, sem SMS: o código é sempre {codigo} e a conta fica só neste telemóvel.', { codigo: CODIGO_TESTE })}
          </Text>
        </View>
      )}
      <Text style={s.nota}>{t('Ao continuar, aceitas receber chamadas e SMS do Chauffeur, incluindo mensagens automáticas, para este número.')}</Text>
    </PassoRegisto>
  );
}

const estilos = StyleSheet.create({
  paises: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  pais: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two + 2, borderRadius: Radius.card, borderWidth: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 0 },
  prefixo: { flexShrink: 0, fontSize: 18, fontWeight: '700', paddingRight: Spacing.three, borderRightWidth: 1, paddingVertical: Spacing.three },
  numero: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '700', paddingVertical: Spacing.three, outlineWidth: 0 },
  teste: { borderRadius: Radius.card, padding: Spacing.three, marginTop: Spacing.two },
});
