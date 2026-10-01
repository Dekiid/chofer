import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { estilosPasso, PassoRegisto } from '@/components/passo-registo';
import { Text } from '@/components/texto';
import { BotaoPrincipal } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { VERSAO_TERMOS } from '@/data/textos-legais';
import { t } from '@/i18n';
import { useSessao } from '@/state/sessao';

export default function Termos() {
  const c = usePalette();
  const s = estilosPasso(c);
  const sessao = useSessao();
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  async function seguinte() {
    setAGuardar(true);
    // Com os termos aceites, o registo fica completo e a app abre sozinha.
    const falhou = await sessao.guardarPerfil({ termos: VERSAO_TERMOS });
    setAGuardar(false);
    if (falhou) setErro(falhou);
  }

  const documento = (titulo: string, doc: 'termos' | 'privacidade') => (
    <Pressable onPress={() => router.push({ pathname: '/legal', params: { doc } })} style={[estilos.documento, { borderBottomColor: c.backgroundSelected }]}>
      <Text style={[estilos.textoDocumento, { color: c.text }]}>{titulo}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 20 }}>›</Text>
    </Pressable>
  );

  return (
    <PassoRegisto
      titulo={t('Aceita os termos e lê a política de privacidade')}
      descricao={t('Ao marcar a caixa, confirmas que leste e aceitas os Termos de Utilização e a Política de Privacidade. Tens de ter pelo menos 18 anos.')}
      onVoltar={() => router.back()}
      rodape={<BotaoPrincipal texto={aGuardar ? t('A guardar…') : t('Seguinte')} escuro onPress={seguinte} desativado={!aceito || aGuardar} />}>
      {documento(t('Termos de Utilização'), 'termos')}
      {documento(t('Política de Privacidade'), 'privacidade')}
      <Pressable
        onPress={() => setAceito((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: aceito }}
        style={[estilos.aceitar, { backgroundColor: c.backgroundElement }]}>
        <View style={[estilos.caixa, aceito ? { backgroundColor: c.go, borderColor: c.go } : { borderColor: c.textSecondary }]}>
          {aceito && <Text style={estilos.visto}>✓</Text>}
        </View>
        <Text style={[estilos.textoDocumento, { color: c.text }]}>{t('Li e aceito')}</Text>
      </Pressable>
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
    </PassoRegisto>
  );
}

const estilos = StyleSheet.create({
  documento: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three, borderBottomWidth: 1 },
  textoDocumento: { fontSize: 16, fontWeight: '700' },
  aceitar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.card, marginTop: Spacing.four, marginBottom: Spacing.two },
  caixa: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  visto: { color: '#000000', fontSize: 16, fontWeight: '800' },
});
