import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { diasAgendaveis, formatarDia, formatarHora, horariosDoDia, INTERVALO_MIN, mesmoDia, reservaNoIntervalo, somarMin } from '@/data/agenda';
import { nomeViatura } from '@/data/categorias';
import { t } from '@/i18n';
import { useAgenda } from '@/state/agenda';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';

// Calendário do dono: cada meia hora aparece livre, ocupada por uma viagem ou bloqueada por ele.
// No produto final cada motorista vê só o seu carro.
export default function Agenda() {
  const cores = usePalette();
  const s = estilos(cores);
  const { viaturas } = usePedido();
  const { reservas, alternarBloqueio } = useAgenda();
  const agora = new Date();
  const dias = diasAgendaveis(agora);
  const [viaturaId, setViaturaId] = useState(viaturas[0].id);
  const [dia, setDia] = useState(dias[0]);

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Agenda das viaturas')}</Text>
      </View>

      <View style={s.filtros}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
          {viaturas.map((v) => (
            <Pressable key={v.id} onPress={() => setViaturaId(v.id)} style={[s.chip, v.id === viaturaId && s.chipAtivo]}>
              <Text style={[s.textoChip, v.id === viaturaId && s.textoChipAtivo]}>{nomeViatura(v)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
          {dias.map((d) => (
            <Pressable key={d.getTime()} onPress={() => setDia(d)} style={[s.chip, mesmoDia(d, dia) && s.chipAtivo]}>
              <Text style={[s.textoChip, mesmoDia(d, dia) && s.textoChipAtivo]}>{formatarDia(d, agora)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={s.ajuda}>{t('Toca num horário livre para o bloquear, ou num bloqueado para o libertar.')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.lista}>
        {horariosDoDia(dia).map((inicio) => {
          const r = reservaNoIntervalo(reservas, viaturaId, inicio, somarMin(inicio, INTERVALO_MIN));
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

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    filtros: { paddingHorizontal: Spacing.three, gap: Spacing.one },
    fila: { gap: Spacing.two, paddingVertical: Spacing.one },
    chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    chipAtivo: { backgroundColor: c.primary },
    textoChip: { color: c.text, fontWeight: '600' },
    textoChipAtivo: { color: c.onPrimary },
    ajuda: { color: c.textSecondary, fontSize: 12, marginVertical: Spacing.one },
    lista: { padding: Spacing.three, gap: Spacing.one },
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
