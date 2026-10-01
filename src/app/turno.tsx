import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoPrincipal, BotaoSecundario, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { duracaoTexto } from '@/data/datas';
import { t } from '@/i18n';
import { formatarNota, useAvaliacoes } from '@/state/avaliacoes';
import { ganhoMotorista, useModoMotorista } from '@/state/modo-motorista';

const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Fim do turno: o resumo do turno que acabou e do dia todo, como na Uber. */
export default function Turno() {
  const cores = usePalette();
  const s = estilos(cores);
  const m = useModoMotorista();
  const avaliacoes = useAvaliacoes();
  const { inicio } = useLocalSearchParams<{ inicio?: string }>();
  const resumo = m.turnos.find((x) => x.inicio === inicio) ?? m.turnos[0];
  const hoje = new Date();

  // O dia todo: os turnos de hoje, as viagens e as avaliações que chegaram hoje.
  const turnosHoje = m.turnos.filter((x) => mesmoDia(new Date(x.fim), hoje));
  const feitasHoje = m.feitas.filter((f) => mesmoDia(new Date(f.concluidaEm), hoje));
  const notasHoje = avaliacoes.doMotorista(m.eu.telefone).filter((a) => mesmoDia(new Date(a.em), hoje));
  const mediaHoje = notasHoje.length ? notasHoje.reduce((t, a) => t + a.estrelas, 0) / notasHoje.length : null;
  const dia = {
    online: turnosHoje.reduce((t, x) => t + x.minutosOnline, 0),
    pausa: turnosHoje.reduce((t, x) => t + x.minutosPausa, 0),
    viagens: feitasHoje.length,
    ganhos: feitasHoje.reduce((t, f) => t + ganhoMotorista(f.pedido), 0),
    km: feitasHoje.reduce((t, f) => t + f.pedido.km, 0),
  };
  const porHora = dia.online >= 30 ? Math.round(dia.ganhos / (dia.online / 60)) : null;

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Resumo do dia')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        {resumo && (
          <View style={s.cartao}>
            <Text style={s.subtitulo}>{t('Turno terminado')}</Text>
            <Text style={s.secundario}>
              {formatarDia(new Date(resumo.inicio), hoje)}, {formatarHora(new Date(resumo.inicio))} – {formatarHora(new Date(resumo.fim))}
            </Text>
            <Text style={s.total}>{formatarMzn(resumo.ganhosMzn)}</Text>
            <Linha s={s} nome={t('Viagens')} valor={String(resumo.viagens)} />
            <Linha s={s} nome={t('A trabalhar')} valor={duracaoTexto(resumo.minutosOnline)} />
            <Linha s={s} nome={t('Pausas')} valor={duracaoTexto(resumo.minutosPausa)} />
            <Linha s={s} nome={t('Distância com clientes')} valor={`${resumo.km.toFixed(1).replace('.', ',')} km`} />
          </View>
        )}

        <View style={s.cartao}>
          <Text style={s.subtitulo}>{t('Hoje')}</Text>
          <Linha s={s} nome={t('Ganhos, já sem a comissão')} valor={formatarMzn(dia.ganhos)} forte />
          <Linha s={s} nome={t('Viagens')} valor={String(dia.viagens)} />
          <Linha s={s} nome={t('A trabalhar')} valor={duracaoTexto(dia.online)} />
          {dia.pausa > 0 && <Linha s={s} nome={t('Pausas')} valor={duracaoTexto(dia.pausa)} />}
          <Linha s={s} nome={t('Distância com clientes')} valor={`${dia.km.toFixed(1).replace('.', ',')} km`} />
          {porHora != null && <Linha s={s} nome={t('Média por hora')} valor={formatarMzn(porHora)} />}
          <Linha
            s={s}
            nome={t('Avaliações de hoje')}
            valor={mediaHoje != null ? `★ ${formatarNota(mediaHoje)} (${notasHoje.length})` : '—'}
          />
        </View>

        {m.turnos.length > 1 && (
          <>
            <Text style={s.subtitulo}>{t('Turnos anteriores')}</Text>
            {m.turnos.slice(resumo ? 1 : 0, 8).map((x) => (
              <View key={x.inicio} style={s.turno}>
                <View style={{ flex: 1 }}>
                  <Text style={s.texto}>
                    {formatarDia(new Date(x.inicio), hoje)}, {formatarHora(new Date(x.inicio))} – {formatarHora(new Date(x.fim))}
                  </Text>
                  <Text style={s.secundario}>
                    {x.viagens === 1 ? t('{n} viagem', { n: x.viagens }) : t('{n} viagens', { n: x.viagens })} · {duracaoTexto(x.minutosOnline)}
                  </Text>
                </View>
                <Text style={s.valor}>{formatarMzn(x.ganhosMzn)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ gap: Spacing.two }}>
          <BotaoPrincipal texto={t('Ver ganhos da semana')} onPress={() => router.replace('/ganhos')} />
          <BotaoSecundario texto={t('Fechar')} onPress={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Linha({ s, nome, valor, forte }: { s: ReturnType<typeof estilos>; nome: string; valor: string; forte?: boolean }) {
  return (
    <View style={s.linha}>
      <Text style={s.texto}>{nome}</Text>
      <Text style={[s.valor, forte && { fontSize: 18 }]}>{valor}</Text>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
    subtitulo: { color: c.text, fontSize: 17, fontWeight: '800' },
    total: { color: c.text, fontSize: 36, fontWeight: '800', textAlign: 'center', marginVertical: Spacing.one },
    linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    texto: { color: c.text, fontSize: 15, fontWeight: '600' },
    valor: { color: c.text, fontSize: 15, fontWeight: '800' },
    secundario: { color: c.textSecondary, fontSize: 13 },
    turno: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three },
  });
}
