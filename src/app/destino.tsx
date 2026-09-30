import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { pesquisarLugares, type Lugar } from '@/data/lugares';
import { usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';

export default function Destino() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  // Qual dos dois campos se está a preencher: o destino (o normal) ou o ponto de recolha.
  const params = useLocalSearchParams<{ campo?: string }>();
  const [campo, setCampo] = useState<'origem' | 'destino'>(params.campo === 'origem' ? 'origem' : 'destino');
  const [texto, setTexto] = useState('');
  const encontrados = pesquisarLugares(texto);
  // Na recolha, a localização do telemóvel aparece sempre primeiro, para poder voltar a ela.
  const resultados = campo === 'origem' && !texto.trim() ? [pedido.localAtual, ...encontrados] : encontrados;

  // O teclado só abre quando a pessoa toca num campo para escrever, não ao abrir o ecrã.
  const [focar, setFocar] = useState(false);

  function editar(c: 'origem' | 'destino') {
    setCampo(c);
    setTexto('');
    setFocar(true);
  }

  function escolher(l: Lugar) {
    if (campo === 'origem') {
      pedido.setOrigem(l);
      // Se o destino já estava escolhido (veio da confirmação), volta logo para lá.
      if (pedido.destino) router.replace('/confirmar');
      else editar('destino');
      return;
    }
    pedido.setDestino(l);
    router.replace('/confirmar');
  }

  return (
    <SafeAreaView style={s.ecra}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{campo === 'origem' ? 'Onde te vamos buscar?' : 'Para onde vamos?'}</Text>
      </View>

      <View style={s.campos}>
        <Pressable onPress={() => editar('origem')} style={[s.linhaCampo, campo === 'origem' && s.campoAtivo]}>
          <View style={s.pontoRecolha} />
          {campo === 'origem' ? (
            <TextInput
              autoFocus={focar}
              value={texto}
              onChangeText={setTexto}
              placeholder="Ponto de recolha"
              placeholderTextColor={cores.textSecondary}
              style={s.input}
            />
          ) : (
            <>
              <Text style={s.origem} numberOfLines={1}>
                {pedido.origem.nome}
              </Text>
              <Text style={s.mudar}>Mudar</Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={() => editar('destino')} style={[s.linhaCampo, campo === 'destino' && s.campoAtivo]}>
          <View style={s.ponto} />
          {campo === 'destino' ? (
            <TextInput
              autoFocus={focar}
              value={texto}
              onChangeText={setTexto}
              placeholder="Destino"
              placeholderTextColor={cores.textSecondary}
              style={s.input}
            />
          ) : (
            <Text style={s.origem} numberOfLines={1}>
              {pedido.destino?.nome ?? 'Para onde?'}
            </Text>
          )}
        </Pressable>
        {campo === 'origem' && <Text style={s.ajuda}>Podes pedir para outra pessoa: escolhe onde o motorista a deve ir buscar.</Text>}
      </View>

      <FlatList
        data={resultados}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<Text style={s.vazio}>Nenhum lugar encontrado.</Text>}
        renderItem={({ item }) => (
          <Pressable style={s.item} onPress={() => escolher(item)}>
            <Text style={s.nome}>{item.nome}</Text>
            <Text style={s.zona}>{item.zona}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    campos: { margin: Spacing.three, gap: Spacing.two },
    linhaCampo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.botao, paddingHorizontal: Spacing.three },
    // Recolha: o ponto verde da marca. Destino: quadrado preto.
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    ponto: { width: 8, height: 8, backgroundColor: c.text },
    origem: { flex: 1, color: c.textSecondary, fontSize: 16, paddingVertical: Spacing.three },
    campoAtivo: { borderWidth: 1.5, borderColor: c.primary },
    mudar: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
    ajuda: { color: c.textSecondary, fontSize: 13 },
    input: { flex: 1, color: c.text, fontSize: 17, fontWeight: '600', paddingVertical: Spacing.three, outlineWidth: 0 },
    item: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    nome: { color: c.text, fontSize: 16, fontWeight: '600' },
    zona: { color: c.textSecondary, marginTop: 2 },
    vazio: { color: c.textSecondary, textAlign: 'center', marginTop: Spacing.five },
  });
}
