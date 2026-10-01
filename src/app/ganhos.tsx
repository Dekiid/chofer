import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { COMISSAO, formatarMzn } from '@/data/categorias';
import { ganhoMotorista, useModoMotorista } from '@/state/modo-motorista';

const DIA = 86_400_000;

/** Segunda-feira da semana desta data, às 00:00. */
function inicioDaSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/**
 * Ganhos do motorista, como na Uber: o total da semana, as barras por dia, o que já foi pago e o que falta receber.
 * Protótipo: o pagamento ao motorista é simulado, todas as segundas-feiras por M-Pesa, com a semana anterior.
 */
export default function Ganhos() {
  const cores = usePalette();
  const s = estilos(cores);
  const m = useModoMotorista();
  const [semanasAtras, setSemanasAtras] = useState(0);

  const hoje = new Date();
  const inicio = new Date(inicioDaSemana(hoje).getTime() - semanasAtras * 7 * DIA);
  const fim = new Date(inicio.getTime() + 7 * DIA);
  const daSemana = m.feitas.filter((f) => {
    const t = new Date(f.concluidaEm).getTime();
    return t >= inicio.getTime() && t < fim.getTime();
  });
  const bruto = daSemana.reduce((t, f) => t + f.pedido.precoMzn, 0);
  const liquido = daSemana.reduce((t, f) => t + ganhoMotorista(f.pedido), 0);
  const porDia = LETRAS.map((_, i) =>
    daSemana.filter((f) => Math.floor((new Date(f.concluidaEm).getTime() - inicio.getTime()) / DIA) === i).reduce((t, f) => t + ganhoMotorista(f.pedido), 0),
  );
  const maximo = Math.max(1, ...porDia);

  const semanaAtual = inicioDaSemana(hoje).getTime();
  const porReceber = m.feitas.filter((f) => new Date(f.concluidaEm).getTime() >= semanaAtual).reduce((t, f) => t + ganhoMotorista(f.pedido), 0);
  const jaPago = m.feitas.filter((f) => new Date(f.concluidaEm).getTime() < semanaAtual).reduce((t, f) => t + ganhoMotorista(f.pedido), 0);
  const proximaSegunda = new Date(semanaAtual + 7 * DIA);

  const titulo = semanasAtras === 0 ? 'Esta semana' : semanasAtras === 1 ? 'Semana passada' : `${inicio.getDate()}/${inicio.getMonth() + 1} a ${new Date(fim.getTime() - DIA).getDate()}/${new Date(fim.getTime() - DIA).getMonth() + 1}`;

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>Ganhos</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.cartao}>
          <View style={s.semana}>
            <Pressable onPress={() => setSemanasAtras((n) => n + 1)} hitSlop={12} accessibilityLabel="Semana anterior">
              <Text style={s.seta}>‹</Text>
            </Pressable>
            <Text style={s.nomeSemana}>{titulo}</Text>
            <Pressable onPress={() => setSemanasAtras((n) => Math.max(0, n - 1))} hitSlop={12} disabled={semanasAtras === 0} accessibilityLabel="Semana seguinte">
              <Text style={[s.seta, semanasAtras === 0 && { opacity: 0.25 }]}>›</Text>
            </Pressable>
          </View>
          <Text style={s.total}>{formatarMzn(liquido)}</Text>
          <Text style={s.secundario}>
            {daSemana.length} {daSemana.length === 1 ? 'viagem' : 'viagens'} · clientes pagaram {formatarMzn(bruto)} · comissão {Math.round(COMISSAO * 100)}% {formatarMzn(bruto - liquido)}
          </Text>
          <View style={s.barras}>
            {porDia.map((v, i) => {
              const eHoje = semanasAtras === 0 && i === (hoje.getDay() + 6) % 7;
              return (
                <View key={i} style={s.coluna}>
                  <View style={s.trilho}>
                    <View style={[s.barra, { height: `${Math.max(v > 0 ? 6 : 0, (v / maximo) * 100)}%`, backgroundColor: eHoje ? cores.go : cores.text }]} />
                  </View>
                  <Text style={[s.letra, eHoje && { color: cores.text, fontWeight: '800' }]}>{LETRAS[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.cartao}>
          <Text style={s.subtitulo}>Pagamentos</Text>
          <View style={s.linha}>
            <Text style={s.texto}>Por receber</Text>
            <Text style={s.valor}>{formatarMzn(porReceber)}</Text>
          </View>
          <Text style={s.secundario}>
            Recebes na segunda-feira, {proximaSegunda.getDate()}/{proximaSegunda.getMonth() + 1}, por M-Pesa, já sem a comissão.
          </Text>
          <View style={s.linha}>
            <Text style={s.texto}>Já pago</Text>
            <Text style={s.valor}>{formatarMzn(jaPago)}</Text>
          </View>
          <Text style={s.nota}>Em testes: os pagamentos aos motoristas são simulados.</Text>
        </View>

        <Text style={s.subtitulo}>Viagens</Text>
        {daSemana.length === 0 && <Text style={s.vazio}>Sem viagens nesta semana.</Text>}
        {daSemana.map(({ pedido, concluidaEm }) => {
          const d = new Date(concluidaEm);
          return (
            <View key={pedido.id} style={s.viagem}>
              <View style={{ flex: 1 }}>
                <Text style={s.texto} numberOfLines={1}>
                  {pedido.destino.nome}
                </Text>
                <Text style={s.secundario}>
                  {formatarDia(d, hoje)}, {formatarHora(d)} · {pedido.km.toFixed(1).replace('.', ',')} km
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.valor}>{formatarMzn(ganhoMotorista(pedido))}</Text>
                <Text style={s.secundario}>de {formatarMzn(pedido.precoMzn)}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    semana: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    seta: { color: c.text, fontSize: 28, fontWeight: '700', paddingHorizontal: Spacing.two },
    nomeSemana: { color: c.text, fontSize: 15, fontWeight: '700' },
    total: { color: c.text, fontSize: 36, fontWeight: '800', textAlign: 'center' },
    barras: { flexDirection: 'row', height: 130, gap: Spacing.two, marginTop: Spacing.two },
    coluna: { flex: 1, alignItems: 'center', gap: 6 },
    trilho: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    barra: { width: '100%', borderRadius: 6 },
    letra: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    subtitulo: { color: c.text, fontSize: 17, fontWeight: '800' },
    linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: Spacing.one },
    texto: { color: c.text, fontSize: 15, fontWeight: '600' },
    valor: { color: c.text, fontSize: 16, fontWeight: '800' },
    secundario: { color: c.textSecondary, fontSize: 13 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: Spacing.one },
    vazio: { color: c.textSecondary },
    viagem: { flexDirection: 'row', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three },
  });
}
