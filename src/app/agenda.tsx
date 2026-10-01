import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { diasAgendaveis, formatarDia, type Reserva, formatarHora, horariosDoDia, INTERVALO_MIN, mesmoDia, ocupaODia, reservaDeDias, reservaNoIntervalo, somarMin } from '@/data/agenda';
import { nomeViatura } from '@/data/categorias';
import { t } from '@/i18n';
import { useAgenda } from '@/state/agenda';
import { useModoMotorista } from '@/state/modo-motorista';
import { nomeLugar } from '@/data/lugares';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';
import { etiquetaLembrete, useMeusCarros } from '@/state/vigia-agenda';

// Calendário do dono: cada meia hora aparece livre, ocupada por uma viagem ou bloqueada por ele.
// No produto final cada motorista vê só o seu carro.
export default function Agenda() {
  const cores = usePalette();
  const s = estilos(cores);
  const { viaturas: todas } = usePedido();
  const { reservas, alternarBloqueio } = useAgenda();
  // Com «meus», é a agenda do dono ou do motorista: só os carros dele. Sem ele, é a gestão a ver todos.
  const params = useLocalSearchParams<{ viatura?: string; meus?: string }>();
  const meusCarros = useMeusCarros();
  const viaturas = params.meus ? todas.filter((v) => meusCarros.includes(v.id)) : todas;
  const agora = new Date();
  const dias = diasAgendaveis(agora);
  const [viaturaId, setViaturaId] = useState(params.viatura ?? viaturas[0]?.id ?? todas[0].id);
  const [dia, setDia] = useState(dias[0]);
  // Reservas de clientes (não os bloqueios do dono) por fazer, para os contadores e os lembretes.
  // Mais as que chegaram em direto ao modo motorista e ainda não estão na agenda (por exemplo, as simuladas da demonstração).
  const m = useModoMotorista();
  const diretas: Reserva[] = m.agendadas
    .filter((p) => p.recolhaEm && !reservas.some((r) => r.id === p.id))
    .map((p) => ({ id: p.id, viaturaId: p.viaturaId, inicio: new Date(p.recolhaEm!), fim: somarMin(new Date(p.recolhaEm!), p.minutos), tipo: 'agendada', destino: nomeLugar(p.destino) }));
  const todasReservas = [...reservas, ...diretas];
  const porFazer = todasReservas.filter((r) => r.tipo !== 'bloqueio' && r.fim > agora).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const doCarro = porFazer.filter((r) => r.viaturaId === viaturaId);
  // Um aluguer ou casamento neste dia ocupa-o todo.
  const diaInteiro = todasReservas.find((r) => r.viaturaId === viaturaId && reservaDeDias(r) && ocupaODia(r, dia));
  const proximas = doCarro.map((r) => ({ r, etiqueta: etiquetaLembrete(r.inicio.getTime(), agora.getTime()) })).filter((x) => x.etiqueta);

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{params.meus ? t('A agenda do teu carro') : t('Agenda das viaturas')}</Text>
      </View>

      <View style={s.filtros}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
          {viaturas.map((v) => (
            <Pressable key={v.id} onPress={() => setViaturaId(v.id)} style={[s.chip, v.id === viaturaId && s.chipAtivo]}>
              <Text style={[s.textoChip, v.id === viaturaId && s.textoChipAtivo]}>{nomeViatura(v)}</Text>
              <Contador n={porFazer.filter((r) => r.viaturaId === v.id).length} s={s} />
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
          {dias.map((d) => (
            <Pressable key={d.getTime()} onPress={() => setDia(d)} style={[s.chip, mesmoDia(d, dia) && s.chipAtivo]}>
              <Text style={[s.textoChip, mesmoDia(d, dia) && s.textoChipAtivo]}>{formatarDia(d, agora)}</Text>
              <Contador n={doCarro.filter((r) => (reservaDeDias(r) ? ocupaODia(r, d) : mesmoDia(r.inicio, d))).length} s={s} />
            </Pressable>
          ))}
        </ScrollView>
        {proximas.map(({ r, etiqueta }) => (
          <Pressable key={r.id} onPress={() => setDia(diasAgendaveis(agora).find((d) => mesmoDia(d, r.inicio)) ?? dia)} style={[s.lembrete, etiqueta!.urgente && s.lembreteUrgente]}>
            <Text style={s.textoLembrete} numberOfLines={2}>
              {reservaDeDias(r)
                ? t('Reserva {quando}: {destino}, o dia inteiro. Prepara o carro para a cumprir.', { quando: etiqueta!.texto.toLowerCase(), destino: r.destino ?? '' })
                : t('Reserva {quando}: {hora}{destino}. Prepara o carro para a cumprir.', { quando: etiqueta!.texto.toLowerCase(), hora: formatarHora(r.inicio), destino: r.destino ? ` · ${r.destino}` : '' })}
            </Text>
          </Pressable>
        ))}
        {viaturas.length === 0 ? (
          <Text style={s.ajuda}>{t('Ainda não tens nenhum carro. Escolhe o teu carro no modo motorista ou inscreve-o.')}</Text>
        ) : (
          <Text style={s.ajuda}>{t('O número em cada dia são as reservas desse dia. Toca num horário livre para o bloquear, ou num bloqueado para o libertar.')}</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={s.lista}>
        {diaInteiro ? (
          // Aluguer ou casamento: o dia todo fica numa só caixa, sem horários.
          <View style={s.blocoDia}>
            <Text style={[s.textoBloco, s.textoOcupado, { fontWeight: '800' }]}>{t('Reservado o dia inteiro')}</Text>
            <Text style={[s.textoBloco, s.textoOcupado]}>{diaInteiro.destino}</Text>
            <Text style={[s.textoBloco, s.textoOcupado, { opacity: 0.7 }]}>
              {mesmoDia(diaInteiro.inicio, somarMin(diaInteiro.fim, -1))
                ? formatarDia(diaInteiro.inicio, agora)
                : t('{inicio} a {fim}', { inicio: formatarDia(diaInteiro.inicio, agora), fim: formatarDia(somarMin(diaInteiro.fim, -1), agora) })}
            </Text>
          </View>
        ) : horariosDoDia(dia).map((inicio) => {
          const r = reservaNoIntervalo(todasReservas, viaturaId, inicio, somarMin(inicio, INTERVALO_MIN));
          const passado = somarMin(inicio, INTERVALO_MIN) <= agora;
          const bloqueio = r?.tipo === 'bloqueio';
          const podeTocar = !passado && (!r || bloqueio);
          return (
            <Pressable
              key={inicio.getTime()}
              disabled={!podeTocar}
              onPress={() => alternarBloqueio(viaturaId, inicio)}
              style={[s.linha, passado && { opacity: 0.4 }]}>
              <Text style={s.hora}>{formatarHora(inicio)}</Text>
              <View style={[s.bloco, r ? (bloqueio ? s.bloqueado : s.ocupado) : s.livre]}>
                <Text style={[s.textoBloco, r && !bloqueio && s.textoOcupado]} numberOfLines={1}>
                  {!r
                    ? t('Livre')
                    : bloqueio
                      ? t('Indisponível')
                      : `${r.tipo === 'imediata' ? t('Pedido imediato') : t('Agendada')}${r.destino ? ` · ${r.destino}` : ''}`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A bolinha com o número de reservas, por cima do dia ou do carro. */
function Contador({ n, s }: { n: number; s: ReturnType<typeof estilos> }) {
  if (n === 0) return null;
  return (
    <View style={s.contador}>
      <Text style={s.textoContador}>{n}</Text>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    filtros: { paddingHorizontal: Spacing.three, gap: Spacing.one },
    fila: { gap: Spacing.two, paddingTop: Spacing.two, paddingBottom: Spacing.one, paddingRight: Spacing.two },
    chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    contador: { position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', borderWidth: 2, borderColor: c.background },
    textoContador: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    lembrete: { borderRadius: Radius.card, padding: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: c.backgroundElement, borderWidth: 1.5, borderColor: '#F59E0B' },
    lembreteUrgente: { borderColor: '#DC2626' },
    textoLembrete: { color: c.text, fontSize: 13, fontWeight: '600' },
    chipAtivo: { backgroundColor: c.primary },
    textoChip: { color: c.text, fontWeight: '600' },
    textoChipAtivo: { color: c.onPrimary },
    ajuda: { color: c.textSecondary, fontSize: 12, marginVertical: Spacing.one },
    lista: { padding: Spacing.three, gap: Spacing.one },
    blocoDia: { borderRadius: Radius.card, backgroundColor: c.primary, padding: Spacing.four, gap: Spacing.one, minHeight: 160, justifyContent: 'center' },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    hora: { color: c.textSecondary, width: 44, fontVariant: ['tabular-nums'] },
    bloco: { flex: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: 10 },
    livre: { borderWidth: 1, borderColor: c.backgroundSelected, borderStyle: 'dashed' },
    ocupado: { backgroundColor: c.primary },
    bloqueado: { backgroundColor: c.backgroundSelected },
    textoBloco: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    textoOcupado: { color: c.onPrimary },
  });
}
