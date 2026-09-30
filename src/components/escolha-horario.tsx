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
} from '@/data/agenda';
import { Text } from '@/components/texto';

type Props = {
  viaturaId: string;
  /** Minutos que a viagem ocupa o carro, margem incluída. */
  ocupadoMin: number;
  reservas: Reserva[];
  quando: Quando | null;
  onMudar: (q: Quando | null) => void;
  /** Se o carro está livre para sair já. */
  livreAgora: boolean;
};

/** Escolher entre agendar (o normal) e pedir já, com a agenda do carro. */
export function EscolhaHorario({ viaturaId, ocupadoMin, reservas, quando, onMudar, livreAgora }: Props) {
  const c = usePalette();
  const s = estilos(c);
  const agora = new Date();
  const dias = diasAgendaveis(agora);
  const [diaEscolhido, setDiaEscolhido] = useState(quando?.tipo === 'agendado' ? quando.inicio : dias[0]);
  const imediato = quando?.tipo === 'imediato';
  const horarios = horariosParaAgendar(diaEscolhido, viaturaId, ocupadoMin, reservas, agora);
  const semLivres = !horarios.some((h) => h.livre);

  return (
    <View>
      <View style={s.alternador}>
        <Pressable onPress={() => imediato && onMudar(null)} style={[s.modo, !imediato && s.modoAtivo]}>
          <Text style={[s.textoModo, !imediato && s.textoModoAtivo]}>Agendar</Text>
        </Pressable>
        <Pressable onPress={() => onMudar({ tipo: 'imediato' })} style={[s.modo, imediato && s.modoAtivo]}>
          <Text style={[s.textoModo, imediato && s.textoModoAtivo]}>Agora · +{Math.round(TAXA_IMEDIATO * 100)}%</Text>
        </Pressable>
      </View>

      {imediato ? (
        <Text style={[s.aviso, !livreAgora && s.avisoErro]}>
          {livreAgora
            ? `Pedidos para já têm uma taxa extra de ${Math.round(TAXA_IMEDIATO * 100)}%. Avisamos o motorista de imediato.`
            : 'Este carro está ocupado agora. Agenda para mais tarde ou escolhe outro carro.'}
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
                  accessibilityLabel={`${formatarHora(inicio)}${livre ? '' : ', ocupado'}`}
                  style={[s.chip, ativo && s.chipAtivo, !livre && s.chipOcupado]}>
                  <Text style={[s.textoChip, ativo && s.textoChipAtivo, !livre && s.textoOcupado]}>{formatarHora(inicio)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={s.legenda}>{semLivres ? 'Não há horários livres neste dia. Escolhe outro dia.' : 'Os horários riscados já estão ocupados.'}</Text>
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
