import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mapa } from '@/components/mapa';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { CATEGORIAS, formatarMzn, type Modo } from '@/data/categorias';

export default function Inicio() {
  const cores = usePalette();
  const s = estilos(cores);
  const [modo, setModo] = useState<Modo>('motorista');
  const [escolhida, setEscolhida] = useState(CATEGORIAS.motorista[0].id);

  const categorias = CATEGORIAS[modo];

  function mudarModo(novo: Modo) {
    setModo(novo);
    setEscolhida(CATEGORIAS[novo][0].id);
  }

  return (
    <View style={s.ecra}>
      <Mapa />

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <Text style={s.marca}>Chofer</Text>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={s.painel}>
        <View style={s.pega} />

        <View style={s.alternador}>
          {(['motorista', 'aluguer'] as const).map((m) => (
            <Pressable key={m} onPress={() => mudarModo(m)} style={[s.opcaoModo, modo === m && s.opcaoModoAtiva]}>
              <Text style={[s.textoModo, modo === m && s.textoModoAtivo]}>
                {m === 'motorista' ? 'Com motorista' : 'Aluguer'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={s.destino}>
          <Text style={s.textoDestino}>{modo === 'motorista' ? 'Para onde?' : 'Onde levantar a viatura?'}</Text>
        </Pressable>

        <ScrollView style={s.lista} contentContainerStyle={{ gap: Spacing.two }}>
          {categorias.map((c) => {
            const ativa = c.id === escolhida;
            return (
              <Pressable key={c.id} onPress={() => setEscolhida(c.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>
                    {c.nome} <Text style={s.lugares}>· {c.lugares} lugares</Text>
                  </Text>
                  <Text style={s.descricao}>
                    {c.chegadaMin ? `Chega em ${c.chegadaMin} min · ` : ''}
                    {c.descricao}
                  </Text>
                </View>
                <Text style={s.preco}>
                  {formatarMzn(c.precoMzn)}
                  {modo === 'aluguer' ? '/dia' : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={s.botao}>
          <Text style={s.textoBotao}>
            {modo === 'motorista' ? 'Pedir' : 'Reservar'} {categorias.find((c) => c.id === escolhida)?.nome}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three },
    marca: {
      alignSelf: 'flex-start',
      marginTop: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radius.pill,
      backgroundColor: c.primary,
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    painel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '62%',
      backgroundColor: c.background,
      borderTopLeftRadius: Radius.sheet,
      borderTopRightRadius: Radius.sheet,
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.three,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    pega: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.backgroundSelected, marginVertical: Spacing.two },
    alternador: { flexDirection: 'row', backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: Spacing.one, marginBottom: Spacing.three },
    opcaoModo: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    opcaoModoAtiva: { backgroundColor: c.primary },
    textoModo: { color: c.textSecondary, fontWeight: '600' },
    textoModoAtivo: { color: c.onPrimary },
    destino: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, marginBottom: Spacing.three },
    textoDestino: { color: c.text, fontSize: 18, fontWeight: '600' },
    lista: { marginBottom: Spacing.three },
    cartao: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent' },
    cartaoAtivo: { borderColor: c.primary, backgroundColor: c.backgroundElement },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    lugares: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    descricao: { color: c.textSecondary, marginTop: 2 },
    preco: { color: c.text, fontSize: 16, fontWeight: '700' },
    botao: { backgroundColor: c.primary, borderRadius: Radius.card, paddingVertical: Spacing.three, alignItems: 'center' },
    textoBotao: { color: c.onPrimary, fontSize: 17, fontWeight: '700' },
  });
}
