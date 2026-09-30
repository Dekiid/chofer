import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { pesquisarLugares } from '@/data/lugares';
import { usePedido } from '@/state/pedido';

export default function Destino() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const [texto, setTexto] = useState('');
  const resultados = pesquisarLugares(texto);

  return (
    <SafeAreaView style={s.ecra}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>Escolher destino</Text>
      </View>

      <View style={s.campos}>
        <View style={s.linhaCampo}>
          <View style={[s.ponto, { borderRadius: 5 }]} />
          <Text style={s.origem} numberOfLines={1}>
            {pedido.origem.nome}
          </Text>
        </View>
        <View style={s.linhaCampo}>
          <View style={s.ponto} />
          <TextInput
            autoFocus
            value={texto}
            onChangeText={setTexto}
            placeholder="Para onde?"
            placeholderTextColor={cores.textSecondary}
            style={s.input}
          />
        </View>
      </View>

      <FlatList
        data={resultados}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.vazio}>Nenhum lugar encontrado.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={s.item}
            onPress={() => {
              pedido.setDestino(item);
              router.replace('/confirmar');
            }}>
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
    linhaCampo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, paddingHorizontal: Spacing.three },
    ponto: { width: 10, height: 10, backgroundColor: c.text },
    origem: { flex: 1, color: c.textSecondary, fontSize: 16, paddingVertical: Spacing.three },
    input: { flex: 1, color: c.text, fontSize: 17, fontWeight: '600', paddingVertical: Spacing.three },
    item: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    nome: { color: c.text, fontSize: 16, fontWeight: '600' },
    zona: { color: c.textSecondary, marginTop: 2 },
    vazio: { color: c.textSecondary, textAlign: 'center', marginTop: Spacing.five },
  });
}
