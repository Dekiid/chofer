import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FotoCarro } from '@/components/foto-carro';
import { BotaoPrincipal, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn, nomeViatura, type Modo } from '@/data/categorias';
import { LOCALIZACAO_PADRAO } from '@/data/lugares';
import { useAgenda } from '@/state/agenda';
import { useInscricoes } from '@/state/inscricoes';
import { usePedido } from '@/state/pedido';

export default function Inicio() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { naoLidas } = useAgenda();
  const avisos = useInscricoes().inscricoes.filter((i) => i.estado === 'pendente').length + naoLidas;
  const [modo, setModo] = useState<Modo>('motorista');
  const lista = modo === 'motorista' ? pedido.viaturas : pedido.viaturas.filter((v) => v.porDiaMzn !== undefined);

  function mudarModo(m: Modo) {
    setModo(m);
    // Nem todos os carros estão para aluguer; se o escolhido não estiver, passa para o primeiro que está.
    if (m === 'aluguer' && pedido.viatura.porDiaMzn === undefined) {
      const primeiro = pedido.viaturas.find((v) => v.porDiaMzn !== undefined);
      if (primeiro) pedido.setViaturaId(primeiro.id);
    }
  }

  // Usa a localização real como ponto de recolha quando a pessoa autoriza.
  const { setLocalAtual } = pedido;
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocalAtual({ ...LOCALIZACAO_PADRAO, zona: 'Localização atual', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // Sem localização, fica o ponto padrão na Baixa.
      }
    })();
  }, [setLocalAtual]);

  return (
    <View style={s.ecra}>
      <View style={[s.ecraCarro, { backgroundColor: cores.backgroundElement }]}>
        <FotoCarro viatura={pedido.viatura} style={s.foto} />
        <View style={s.legenda} pointerEvents="none">
          <Text style={s.nomeCarro}>{nomeViatura(pedido.viatura)}</Text>
          <Text style={s.descricao}>{pedido.viatura.tipo}</Text>
        </View>
      </View>

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <Text style={s.marca}>Chauffeur</Text>
        {/* Só para a equipa; no produto final a aprovação fica no painel de gestão. */}
        <Pressable onPress={() => router.push('/gestao')} style={s.gestao}>
          <Text style={s.textoGestao}>Gestão</Text>
          {avisos > 0 && (
            <View style={s.contador}>
              <Text style={s.textoContador}>{avisos}</Text>
            </View>
          )}
        </Pressable>
      </SafeAreaView>

      <Painel>
        <View style={s.alternador}>
          {(['motorista', 'aluguer'] as const).map((m) => (
            <Pressable key={m} onPress={() => mudarModo(m)} style={[s.opcaoModo, modo === m && s.opcaoModoAtiva]}>
              <Text style={[s.textoModo, modo === m && s.textoModoAtivo]}>{m === 'motorista' ? 'Com motorista' : 'Aluguer'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.pergunta}>{modo === 'motorista' ? 'Escolhe o teu carro' : 'Escolhe o carro para alugar'}</Text>
        <ScrollView style={s.lista} contentContainerStyle={{ gap: Spacing.one }}>
          {lista.map((v) => {
            const ativa = v.id === pedido.viatura.id;
            return (
              <Pressable key={v.id} onPress={() => pedido.setViaturaId(v.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{nomeViatura(v)}</Text>
                  <Text style={s.descricao}>
                    {modo === 'motorista' ? `${v.tipo} · ${v.lugares} lugares · chega em ${v.chegadaMin} min` : `${v.tipo} · ${v.lugares} lugares · sem motorista`}
                  </Text>
                </View>
                <Text style={s.preco}>
                  {formatarMzn(modo === 'motorista' ? v.porKmMzn : (v.porDiaMzn ?? 0))}
                  <Text style={s.lugares}>{modo === 'motorista' ? '/km' : '/dia'}</Text>
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {modo === 'motorista' ? (
          <>
            <BotaoPrincipal texto="Para onde?" onPress={() => router.push('/destino')} />
            <Pressable onPress={() => router.push('/inscricao')} style={s.inscrever}>
              <Text style={s.descricao}>
                Tens um carro premium? <Text style={s.textoInscrever}>Inscreve-te como motorista</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <BotaoPrincipal texto={`Alugar ${nomeViatura(pedido.viatura)}`} onPress={() => {}} />
        )}
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    ecraCarro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    // Todas as fotos estão em 16:9, com o carro a ocupar a mesma largura.
    foto: { position: 'absolute', top: 124, left: Spacing.three, right: Spacing.three, aspectRatio: 16 / 9 },
    legenda: { position: 'absolute', top: 64, left: 0, right: 0, alignItems: 'center' },
    nomeCarro: { color: c.text, fontSize: 24, fontWeight: '800' },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    contador: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    textoContador: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    gestao: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    textoGestao: { color: c.text, fontSize: 14, fontWeight: '600' },
    inscrever: { alignItems: 'center', paddingTop: Spacing.three },
    textoInscrever: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
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
