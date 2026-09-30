import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { linhasRecibo, nomePagamento, numeroRecibo, partilharRecibo } from '@/data/recibo';
import { totalPago, useConta } from '@/state/conta';
import { Text } from '@/components/texto';

export default function Recibo() {
  const cores = usePalette();
  const s = estilos(cores);
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useConta().viagens.find((x) => x.id === id);
  const [aGerar, setAGerar] = useState(false);
  if (!v) return <Redirect href="/viagens" />;

  const percurso = [v.origem, ...v.paragens, v.destino];

  async function pdf() {
    setAGerar(true);
    try {
      await partilharRecibo(v!);
    } finally {
      setAGerar(false);
    }
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>Recibo</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <Text style={s.secundario}>{numeroRecibo(v)}</Text>
        <Text style={s.total}>{formatarMzn(totalPago(v))}</Text>
        <Text style={s.secundario}>
          {formatarDia(v.recolhaEm, new Date())}, {formatarHora(v.recolhaEm)} · pago por {nomePagamento(v)}
        </Text>

        <View style={s.caixa}>
          {percurso.map((l, i) => (
            <View key={`${l.id}-${i}`} style={s.paragem}>
              <View style={i === 0 ? s.pontoRecolha : i === percurso.length - 1 ? s.ponto : s.pontoParagem} />
              <Text style={s.lugar} numberOfLines={1}>
                {l.nome}
              </Text>
            </View>
          ))}
          <Text style={[s.secundario, { marginTop: Spacing.two }]}>
            {v.viatura} · {v.motorista.nome} · {v.motorista.matricula}
          </Text>
        </View>

        <View style={s.caixa}>
          {linhasRecibo(v).map((l) => (
            <View key={l.nome} style={s.linha}>
              <Text style={s.secundario}>{l.nome}</Text>
              <Text style={s.valor}>
                {l.valor < 0 ? '−' : ''}
                {formatarMzn(Math.abs(l.valor))}
              </Text>
            </View>
          ))}
          <View style={[s.linha, s.linhaTotal]}>
            <Text style={s.totalLinha}>Total pago</Text>
            <Text style={s.totalLinha}>{formatarMzn(totalPago(v))}</Text>
          </View>
        </View>
        {v.avaliacao && (
          <Text style={s.secundario}>
            A tua avaliação: {'★'.repeat(v.avaliacao.estrelas)}
            {v.avaliacao.elogios.length ? ` · ${v.avaliacao.elogios.join(', ')}` : ''}
          </Text>
        )}
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrincipal texto={aGerar ? 'A preparar o PDF…' : 'Guardar ou partilhar PDF'} onPress={pdf} desativado={aGerar || v.estado === 'cancelada'} />
      </View>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two },
    total: { color: c.text, fontSize: 36, fontWeight: '800' },
    caixa: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one, marginTop: Spacing.two },
    paragem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    ponto: { width: 8, height: 8, backgroundColor: c.text },
    pontoParagem: { width: 8, height: 8, borderWidth: 2, borderColor: c.text },
    lugar: { color: c.text, fontSize: 15, fontWeight: '600', flex: 1 },
    linha: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: 2 },
    linhaTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two, marginTop: Spacing.one },
    secundario: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
    valor: { color: c.text, fontSize: 14, fontWeight: '600' },
    totalLinha: { color: c.text, fontSize: 18, fontWeight: '800' },
    rodape: { padding: Spacing.three },
  });
}
