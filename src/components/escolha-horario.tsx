import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import {
  diasAgendaveis,
  formatarDia,
  formatarHora,
  horariosParaAgendar,
  mesmoDia,
  TAXA_IMEDIATO,
  type Quando,
  type Reserva,
  type TempoConducao,
} from '@/data/agenda';
import type { Ponto } from '@/components/mapa-tipos';
import { Text } from '@/components/texto';
import { t } from '@/i18n';

type Props = {
  viaturaId: string;
  /** Minutos da viagem, da recolha ao destino. */
  duracaoMin: number;
  /** Onde a viagem começa e acaba, para contar o tempo de condução desde e até às outras reservas. */
  locais: { pontoInicio?: Ponto; pontoFim?: Ponto };
  conducao: TempoConducao;
  reservas: Reserva[];
  quando: Quando | null;
  onMudar: (q: Quando | null) => void;
  /** Se o carro está livre para sair já. */
  livreAgora: boolean;
};

/** Escolher entre agendar (o normal) e pedir já, com a agenda do carro. */
export function EscolhaHorario({ viaturaId, duracaoMin, locais, conducao, reservas, quando, onMudar, livreAgora }: Props) {
  const c = usePalette();
  const s = estilos(c);
  const agora = new Date();
  const dias = diasAgendaveis(agora);
  const [diaEscolhido, setDiaEscolhido] = useState(quando?.tipo === 'agendado' ? quando.inicio : dias[0]);
  const imediato = quando?.tipo === 'imediato';
  const horarios = horariosParaAgendar(diaEscolhido, viaturaId, duracaoMin, reservas, agora, locais, conducao);
  const semLivres = !horarios.some((h) => h.livre);

  return (
    <View>
      <View style={s.alternador}>
        <Pressable onPress={() => imediato && onMudar(null)} style={[s.modo, !imediato && s.modoAtivo]}>
          <Text style={[s.textoModo, !imediato && s.textoModoAtivo]}>{t('Agendar')}</Text>
        </Pressable>
        <Pressable onPress={() => onMudar({ tipo: 'imediato' })} style={[s.modo, imediato && s.modoAtivo]}>
          <Text style={[s.textoModo, imediato && s.textoModoAtivo]}>{t('Agora · +{pct}%', { pct: Math.round(TAXA_IMEDIATO * 100) })}</Text>
        </Pressable>
      </View>

      {imediato ? (
        <Text style={[s.aviso, !livreAgora && s.avisoErro]}>
          {livreAgora
            ? t('Pedidos para já têm uma taxa extra de {pct}%. Avisamos o motorista de imediato.', { pct: Math.round(TAXA_IMEDIATO * 100) })
            : t('Este carro está ocupado agora. Agenda para mais tarde ou escolhe outro carro.')}
        </Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
            {dias.map((d) => {
              const ativo = mesmoDia(d, diaEscolhido);
              return (
                <Pressable
                  key={d.getTime()}
                  onPress={() => {
                    setDiaEscolhido(d);
                    onMudar(null);
                  }}
                  style={[s.chip, ativo && s.chipAtivo]}>
                  <Text style={[s.textoChip, ativo && s.textoChipAtivo]}>{formatarDia(d, agora)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
            {horarios.map(({ inicio, livre }) => {
              const ativo = quando?.tipo === 'agendado' && quando.inicio.getTime() === inicio.getTime();
              return (
                <Pressable
                  key={inicio.getTime()}
                  disabled={!livre}
                  onPress={() => onMudar({ tipo: 'agendado', inicio })}
                  accessibilityLabel={livre ? formatarHora(inicio) : t('{hora}, ocupado', { hora: formatarHora(inicio) })}
                  style={[s.chip, ativo && s.chipAtivo, !livre && s.chipOcupado]}>
                  <Text style={[s.textoChip, ativo && s.textoChipAtivo, !livre && s.textoOcupado]}>{formatarHora(inicio)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={s.legenda}>{semLivres ? t('Não há horários livres neste dia. Escolhe outro dia.') : t('Os horários riscados não dão: o carro tem outra reserva ou não chega a tempo da anterior.')}</Text>
        </>
      )}
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    alternador: { flexDirection: 'row', backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: Spacing.one, marginBottom: Spacing.two },
    modo: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    modoAtivo: { backgroundColor: c.primary },
    textoModo: { color: c.textSecondary, fontWeight: '600' },
    textoModoAtivo: { color: c.onPrimary },
    fila: { gap: Spacing.two, paddingVertical: Spacing.one },
    chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    chipAtivo: { backgroundColor: c.primary },
    chipOcupado: { opacity: 0.45 },
    textoChip: { color: c.text, fontWeight: '600' },
    textoChipAtivo: { color: c.onPrimary },
    textoOcupado: { textDecorationLine: 'line-through' },
    legenda: { color: c.textSecondary, fontSize: 12, marginTop: Spacing.one },
    aviso: { color: c.textSecondary, fontSize: 13, paddingVertical: Spacing.two },
    avisoErro: { color: '#D93025' },
  });
}
