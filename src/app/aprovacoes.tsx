import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { COMISSAO, formatarMzn } from '@/data/categorias';
import { formatarData } from '@/data/datas';
import { formatarTelefone } from '@/data/motorista';
import { t } from '@/i18n';
import { estadoDocumentos, FOTOS_PEDIDAS, useInscricoes, type Documento, type Inscricao } from '@/state/inscricoes';
import { Text, TextInput } from '@/components/texto';

// Nome curto de cada documento, na linha das validades.
const NOME_CURTO: Record<Documento, () => string> = { carta: () => t('carta'), seguro: () => t('seguro'), inspecao: () => t('inspeção') };

// Aprovação interna. No protótipo fica na app; no produto final passa para o painel de gestão, só para a equipa.
export default function Aprovacoes() {
  const cores = usePalette();
  const s = estilos(cores);
  const { inscricoes } = useInscricoes();
  const pendentes = inscricoes.filter((i) => i.estado === 'pendente');
  const decididas = inscricoes.filter((i) => i.estado !== 'pendente');

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Aprovar inscrições')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {inscricoes.length === 0 && <Text style={s.secundario}>{t('Ainda não há inscrições.')}</Text>}
        {pendentes.length > 0 && <Text style={s.secao}>{t('À espera de aprovação ({n})', { n: pendentes.length })}</Text>}
        {pendentes.map((i) => (
          <CartaoPendente key={i.id} inscricao={i} />
        ))}
        {decididas.length > 0 && <Text style={s.secao}>{t('Já decididas')}</Text>}
        {decididas.map((i) => (
          <View key={i.id} style={s.resumo}>
            <Image source={{ uri: i.fotos.frente }} style={s.miniatura} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>
                {i.marca} {i.modelo}
              </Text>
              <Text style={s.secundario}>
                {i.nome} · {i.estado === 'aprovada' ? t('aprovada, {preco}/km', { preco: formatarMzn(i.porKmMzn) }) : t('rejeitada')}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function CartaoPendente({ inscricao: i }: { inscricao: Inscricao }) {
  const cores = usePalette();
  const s = estilos(cores);
  const { aprovar, rejeitar } = useInscricoes();
  const [preco, setPreco] = useState(String(i.porKmMzn));
  const precoValido = Number(preco) > 0;

  return (
    <View style={s.cartao}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        {FOTOS_PEDIDAS.map((f) => (
          <View key={f.id}>
            <Image source={{ uri: i.fotos[f.id] }} style={s.fotoGrande} contentFit="cover" />
            <Text style={s.legendaFoto}>{t(f.nome)}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={[s.nome, { marginTop: Spacing.three }]}>
        {i.marca} {i.modelo} ({i.ano})
      </Text>
      <Text style={s.secundario}>
        {i.tipo} · {t('{n} lugares', { n: i.lugares })} · {i.matricula}
      </Text>

      <View style={s.dados}>
        <Text style={s.texto}>{i.motorista ? t('Dono: {nome}', { nome: i.nome }) : i.nome}</Text>
        <Text style={s.secundario}>{t('BI {bi} · Carta {carta}', { bi: i.documento, carta: i.cartaConducao })}</Text>
        {i.validades && (
          <Text style={s.secundario}>
            {t('Validade: {lista}', {
              lista: estadoDocumentos(i.validades)
                .map((d) => `${NOME_CURTO[d.documento]()} ${d.validade ? formatarData(d.validade) : '—'}`)
                .join(' · '),
            })}
          </Text>
        )}
        <Pressable onPress={() => Linking.openURL(`tel:${i.telefone}`)}>
          <Text style={s.link}>{formatarTelefone(i.telefone)}</Text>
        </Pressable>
        {i.motorista && (
          <>
            <Text style={[s.texto, { marginTop: Spacing.two }]}>{t('Conduzido por {nome}', { nome: i.motorista.nome })}</Text>
            <Text style={s.secundario}>{t('A carta acima é a do motorista.')}</Text>
            <Pressable onPress={() => Linking.openURL(`tel:${i.motorista!.telefone}`)}>
              <Text style={s.link}>{formatarTelefone(i.motorista.telefone)}</Text>
            </Pressable>
          </>
        )}
      </View>

      {i.casamento?.foto && <Image source={i.casamento.foto} style={[s.fotoGrande, { marginBottom: Spacing.one }]} contentFit="cover" />}
      {i.casamento && (
        <Text style={[s.secundario, { marginBottom: Spacing.two }]}>
          {t('Casamentos: {sem} sem decoração · {com} com decoração', { sem: formatarMzn(i.casamento.semDecoracaoMzn), com: formatarMzn(i.casamento.comDecoracaoMzn) })}
        </Text>
      )}
      <Text style={s.rotulo}>{t('Preço por km proposto pelo motorista (MT)')}</Text>
      <TextInput value={preco} onChangeText={setPreco} keyboardType="number-pad" style={s.input} />
      <Text style={[s.secundario, { marginTop: Spacing.one }]}>
        {Number(preco) !== i.porKmMzn ? `${t('Proposta original: {preco}/km.', { preco: formatarMzn(i.porKmMzn) })} ` : ''}
        {t('Comissão do Chauffeur: {pct}% do total.', { pct: Math.round(COMISSAO * 100) })}
      </Text>

      <View style={s.botoes}>
        <Pressable onPress={() => rejeitar(i.id)} style={[s.botao, { backgroundColor: cores.backgroundSelected }]}>
          <Text style={[s.textoBotao, { color: cores.text }]}>{t('Rejeitar')}</Text>
        </Pressable>
        <Pressable
          disabled={!precoValido}
          onPress={() => aprovar(i.id, Number(preco))}
          style={[s.botao, { backgroundColor: cores.primary, opacity: precoValido ? 1 : 0.4 }]}>
          <Text style={[s.textoBotao, { color: cores.onPrimary }]}>{t('Aprovar')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.three },
    secao: { color: c.text, fontSize: 18, fontWeight: '700' },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three },
    fotoGrande: { width: 200, height: 140, borderRadius: 10 },
    legendaFoto: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    texto: { color: c.text, fontSize: 15, fontWeight: '600' },
    secundario: { color: c.textSecondary, fontSize: 14 },
    link: { color: c.text, fontSize: 15, textDecorationLine: 'underline', marginTop: 2 },
    dados: { marginVertical: Spacing.three, gap: 2 },
    rotulo: { color: c.text, fontWeight: '600', marginBottom: Spacing.one },
    input: { backgroundColor: c.background, color: c.text, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 16 },
    botoes: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
    botao: { flex: 1, borderRadius: Radius.card, paddingVertical: 12, alignItems: 'center' },
    textoBotao: { fontSize: 16, fontWeight: '700' },
    resumo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    miniatura: { width: 64, height: 48, borderRadius: 8 },
  });
}
