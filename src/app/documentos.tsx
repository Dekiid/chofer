import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarData, lerData, mascaraData } from '@/data/datas';
import { AVISO_VALIDADE_DIAS, estadoDocumentos, useInscricoes, type Documento } from '@/state/inscricoes';
import { t } from '@/i18n';

const COR = { ok: '#22C55E', a_expirar: '#F59E0B', expirado: '#DC2626', em_falta: '#DC2626' } as const;

/** O motorista vê a validade da carta, do seguro e da inspeção, e renova-as. Com algum expirado, não fica online. */
export default function Documentos() {
  const cores = usePalette();
  const s = estilos(cores);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { inscricoes, renovarDocumento } = useInscricoes();
  const inscricao = inscricoes.find((i) => i.id === id);
  const [textos, setTextos] = useState<Partial<Record<Documento, string>>>({});
  const [guardado, setGuardado] = useState(false);

  if (!inscricao) return null;
  const documentos = estadoDocumentos(inscricao.validades);
  const invalidos = Object.entries(textos).filter(([, t]) => t && !lerData(t)).length;

  const guardar = () => {
    for (const [doc, t] of Object.entries(textos) as [Documento, string][]) {
      const d = t ? lerData(t) : null;
      if (d) renovarDocumento(inscricao.id, doc, d);
    }
    setTextos({});
    setGuardado(true);
  };

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Documentos')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={s.secundario}>
            {t('Mantém os documentos em dia. Avisamos {n} dias antes de expirarem. Com algum expirado, não podes ficar online.', { n: AVISO_VALIDADE_DIAS })}
          </Text>
          {documentos.map((d) => (
            <View key={d.documento} style={s.cartao}>
              <View style={s.linha}>
                <View style={[s.ponto, { backgroundColor: COR[d.estado] }]} />
                <Text style={s.nome}>{t(d.nome)}</Text>
              </View>
              <Text style={s.secundario}>
                {d.estado === 'em_falta'
                  ? t('Falta a data de validade.')
                  : d.estado === 'expirado'
                    ? t('Expirou a {data}.', { data: formatarData(d.validade!) })
                    : d.estado === 'a_expirar'
                      ? d.dias === 1
                        ? t('Válido até {data}, falta {n} dia.', { data: formatarData(d.validade!), n: d.dias })
                        : t('Válido até {data}, faltam {n} dias.', { data: formatarData(d.validade!), n: d.dias ?? 0 })
                      : t('Válido até {data}.', { data: formatarData(d.validade!) })}
              </Text>
              <TextInput
                style={s.campo}
                placeholder={t('Nova validade (DD/MM/AAAA)')}
                placeholderTextColor={cores.textSecondary}
                keyboardType="number-pad"
                value={textos[d.documento] ?? ''}
                onChangeText={(t) => {
                  setGuardado(false);
                  setTextos((x) => ({ ...x, [d.documento]: mascaraData(t) }));
                }}
                accessibilityLabel={t('Nova validade: {doc}', { doc: t(d.nome) })}
              />
            </View>
          ))}
          <Text style={s.nota}>{t('Em testes basta a data. Antes do lançamento, pedimos também a foto do documento novo e a aprovação passa pelo painel de gestão.')}</Text>
          {guardado && <Text style={[s.secundario, { color: COR.ok }]}>{t('Guardado.')}</Text>}
          <BotaoPrincipal texto={t('Guardar')} desativado={invalidos > 0 || !Object.values(textos).some((t) => t && lerData(t))} onPress={guardar} />
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
    conteudo: { padding: Spacing.three, gap: Spacing.three },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    ponto: { width: 10, height: 10, borderRadius: 5 },
    nome: { color: c.text, fontSize: 16, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic' },
    campo: { backgroundColor: c.background, borderRadius: Radius.botao, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, color: c.text, fontSize: 15 },
  });
}
