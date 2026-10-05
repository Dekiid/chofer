import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia } from '@/data/agenda';
import { t } from '@/i18n';
import { formatarNota, useAvaliacoes } from '@/state/avaliacoes';
import { useModoMotorista } from '@/state/modo-motorista';

/** As avaliações que os clientes deram ao motorista: a média, as estrelas, os elogios e os comentários. Sem o nome dos clientes. */
export default function AvaliacoesMotorista() {
  const cores = usePalette();
  const s = estilos(cores);
  const m = useModoMotorista();
  const avaliacoes = useAvaliacoes();
  const lista = avaliacoes.doMotorista(m.eu.telefone);
  const nota = avaliacoes.mediaMotorista(m.eu.telefone);
  const porEstrelas = [5, 4, 3, 2, 1].map((n) => ({ n, total: lista.filter((a) => a.estrelas === n).length }));
  const maximo = Math.max(1, ...porEstrelas.map((x) => x.total));
  const elogios = Object.entries(
    lista.flatMap((a) => a.elogios).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e]: (acc[e] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const comentarios = lista.filter((a) => a.comentario);
  const hoje = new Date();

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('As tuas avaliações')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.cartao}>
          <Text style={s.media}>{nota ? `★ ${formatarNota(nota.media)}` : '—'}</Text>
          <Text style={[s.secundario, { textAlign: 'center' }]}>
            {nota ? (nota.n === 1 ? t('{n} avaliação', { n: nota.n }) : t('{n} avaliações', { n: nota.n })) : t('Ainda sem avaliações. Aparecem aqui quando os clientes te avaliarem no fim da viagem.')}
          </Text>
          {nota &&
            porEstrelas.map((x) => (
              <View key={x.n} style={s.linhaEstrelas}>
                <Text style={s.numero}>{x.n} ★</Text>
                <View style={s.trilho}>
                  <View style={[s.barra, { width: `${(x.total / maximo) * 100}%` }]} />
                </View>
                <Text style={s.numero}>{x.total}</Text>
              </View>
            ))}
        </View>

        {elogios.length > 0 && (
          <>
            <Text style={s.subtitulo}>{t('Elogios')}</Text>
            <View style={s.chips}>
              {elogios.map(([e, n]) => (
                <View key={e} style={s.chip}>
                  <Text style={s.textoChip}>
                    {t(e)} · {n}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.subtitulo}>{t('Comentários')}</Text>
        {comentarios.length === 0 && <Text style={s.secundario}>{t('Ainda sem comentários.')}</Text>}
        {comentarios.map((a) => (
          <View key={a.viagemId} style={s.comentario}>
            <View style={s.linhaComentario}>
              <Text style={s.estrelas}>{'★'.repeat(a.estrelas)}</Text>
              <Text style={s.secundario}>{formatarDia(new Date(a.em), hoje)}</Text>
            </View>
            <Text style={s.texto}>«{a.comentario}»</Text>
          </View>
        ))}
        <Text style={s.nota}>{t('Os clientes avaliam sem o nome aparecer. A média conta as tuas avaliações todas.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
    media: { color: c.text, fontSize: 40, fontWeight: '800', textAlign: 'center' },
    linhaEstrelas: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    numero: { color: c.text, fontSize: 13, fontWeight: '700', width: 32 },
    trilho: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.backgroundSelected, overflow: 'hidden' },
    barra: { height: 8, borderRadius: 4, backgroundColor: c.accent },
    subtitulo: { color: c.text, fontSize: 17, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    chip: { backgroundColor: c.backgroundElement, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    textoChip: { color: c.text, fontSize: 14, fontWeight: '600' },
    comentario: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one },
    linhaComentario: { flexDirection: 'row', justifyContent: 'space-between' },
    estrelas: { color: c.accent, fontSize: 15 },
    texto: { color: c.text, fontSize: 15 },
    secundario: { color: c.textSecondary, fontSize: 13 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic' },
  });
}
