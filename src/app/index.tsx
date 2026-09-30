import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FotoCarro } from '@/components/foto-carro';
import { Mapa } from '@/components/mapa';
import { BotaoPrincipal, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { CATEGORIAS_ALUGUER, formatarMzn, nomeViatura, VIATURAS, type Modo } from '@/data/categorias';
import { LOCALIZACAO_PADRAO } from '@/data/lugares';
import { usePedido } from '@/state/pedido';

export default function Inicio() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const [modo, setModo] = useState<Modo>('motorista');
  const [aluguerEscolhido, setAluguerEscolhido] = useState(CATEGORIAS_ALUGUER[0].id);

  // Usa a localização real como ponto de recolha quando a pessoa autoriza.
  const { setOrigem } = pedido;
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setOrigem({ ...LOCALIZACAO_PADRAO, zona: 'Localização atual', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // Sem localização, fica o ponto padrão na Baixa.
      }
    })();
  }, [setOrigem]);

  return (
    <View style={s.ecra}>
      {modo === 'motorista' ? (
        <View style={[s.ecraCarro, { backgroundColor: cores.backgroundElement }]}>
          <FotoCarro viatura={pedido.viatura} style={s.foto} />
          <View style={s.legenda} pointerEvents="none">
            <Text style={s.nomeCarro}>{nomeViatura(pedido.viatura)}</Text>
            <Text style={s.descricao}>{pedido.viatura.tipo}</Text>
          </View>
        </View>
      ) : (
        <Mapa origem={pedido.origem} />
      )}

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <Text style={s.marca}>Chofer</Text>
      </SafeAreaView>

      <Painel>
        <View style={s.alternador}>
          {(['motorista', 'aluguer'] as const).map((m) => (
            <Pressable key={m} onPress={() => setModo(m)} style={[s.opcaoModo, modo === m && s.opcaoModoAtiva]}>
              <Text style={[s.textoModo, modo === m && s.textoModoAtivo]}>{m === 'motorista' ? 'Com motorista' : 'Aluguer'}</Text>
            </Pressable>
          ))}
        </View>

        {modo === 'motorista' ? (
          <>
            <Text style={s.pergunta}>Escolhe o teu carro</Text>
            <ScrollView style={s.lista} contentContainerStyle={{ gap: Spacing.one }}>
              {VIATURAS.map((v) => {
                const ativa = v.id === pedido.viatura.id;
                return (
                  <Pressable key={v.id} onPress={() => pedido.setViaturaId(v.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.nome}>{nomeViatura(v)}</Text>
                      <Text style={s.descricao}>
                        {v.tipo} · {v.lugares} lugares · chega em {v.chegadaMin} min
                      </Text>
                    </View>
                    <Text style={s.preco}>
                      {formatarMzn(v.porKmMzn)}
                      <Text style={s.lugares}>/km</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <BotaoPrincipal texto="Para onde?" onPress={() => router.push('/destino')} />
          </>
        ) : (
          <>
            <Pressable style={s.destino}>
              <Text style={s.textoDestino}>Onde levantar a viatura?</Text>
            </Pressable>
            <ScrollView style={s.lista} contentContainerStyle={{ gap: Spacing.two }}>
              {CATEGORIAS_ALUGUER.map((c) => {
                const ativa = c.id === aluguerEscolhido;
                return (
                  <Pressable key={c.id} onPress={() => setAluguerEscolhido(c.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.nome}>
                        {c.nome} <Text style={s.lugares}>· {c.lugares} lugares</Text>
                      </Text>
                      <Text style={s.descricao}>{c.descricao}</Text>
                    </View>
                    <Text style={s.preco}>{formatarMzn(c.porDiaMzn)}/dia</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <BotaoPrincipal texto={`Reservar ${CATEGORIAS_ALUGUER.find((c) => c.id === aluguerEscolhido)?.nome}`} onPress={() => {}} />
          </>
        )}
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    ecraCarro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    foto: { position: 'absolute', top: 124, left: Spacing.three, right: Spacing.three, height: '30%' },
    legenda: { position: 'absolute', top: 64, left: 0, right: 0, alignItems: 'center' },
    nomeCarro: { color: c.text, fontSize: 24, fontWeight: '800' },
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
      overflow: 'hidden',
    },
    alternador: { flexDirection: 'row', backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: Spacing.one, marginBottom: Spacing.three },
    opcaoModo: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    opcaoModoAtiva: { backgroundColor: c.primary },
    textoModo: { color: c.textSecondary, fontWeight: '600' },
    textoModoAtivo: { color: c.onPrimary },
    destino: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, marginBottom: Spacing.two },
    textoDestino: { color: c.text, fontSize: 18, fontWeight: '600' },
    pergunta: { color: c.text, fontSize: 20, fontWeight: '700', marginBottom: Spacing.two },
    lista: { marginBottom: Spacing.three, maxHeight: 250 },
    cartao: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent' },
    cartaoAtivo: { borderColor: c.primary, backgroundColor: c.backgroundElement },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    lugares: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    descricao: { color: c.textSecondary, marginTop: 2 },
    preco: { color: c.text, fontSize: 16, fontWeight: '700' },
  });
}
