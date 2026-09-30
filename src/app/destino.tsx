import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { pesquisarLugares, type Lugar } from '@/data/lugares';
import { LOCAIS, useConta, type TipoLocal } from '@/state/conta';
import { MAX_PARAGENS, usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';

/** Campo que se está a preencher: a recolha, o destino ou uma das paragens pelo caminho. */
type Campo = { tipo: 'origem' } | { tipo: 'destino' } | { tipo: 'paragem'; i: number };

export default function Destino() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const conta = useConta();
  // campo=origem abre na recolha; guardar=casa|trabalho|aeroporto escolhe a morada de um local guardado e volta atrás.
  const params = useLocalSearchParams<{ campo?: string; guardar?: string }>();
  const soGuardar = LOCAIS.find((l) => l.tipo === params.guardar)?.tipo;
  const [campo, setCampo] = useState<Campo>({ tipo: params.campo === 'origem' ? 'origem' : 'destino' });
  const [texto, setTexto] = useState('');
  // Local guardado ainda sem morada: a próxima escolha fica guardada com esse nome.
  const [aGuardar, setAGuardar] = useState<TipoLocal | null>(soGuardar ?? null);
  const encontrados = pesquisarLugares(texto);
  // Na recolha, a localização do telemóvel aparece sempre primeiro, para poder voltar a ela.
  const resultados = campo.tipo === 'origem' && !texto.trim() && !aGuardar ? [pedido.localAtual, ...encontrados] : encontrados;

  // O teclado só abre quando a pessoa toca num campo para escrever, não ao abrir o ecrã.
  const [focar, setFocar] = useState(false);

  function editar(c: Campo) {
    setCampo(c);
    setTexto('');
    setFocar(true);
  }

  function escolher(l: Lugar) {
    if (aGuardar) {
      const nome = LOCAIS.find((x) => x.tipo === aGuardar)!.nome;
      conta.guardarLocal(aGuardar, { ...l, id: `local-${aGuardar}`, nome, zona: l.nome === 'A tua localização' ? l.zona : l.nome });
      setAGuardar(null);
      if (soGuardar) {
        router.back();
        return;
      }
    }
    if (campo.tipo === 'origem') {
      pedido.setOrigem(l);
      // Se o destino já estava escolhido (veio da confirmação), volta logo para lá.
      if (pedido.destino) router.replace('/confirmar');
      else editar({ tipo: 'destino' });
      return;
    }
    if (campo.tipo === 'paragem') {
      pedido.setParagem(campo.i, l);
      if (pedido.destino) router.replace('/confirmar');
      else editar({ tipo: 'destino' });
      return;
    }
    pedido.setDestino(l);
    router.replace('/confirmar');
  }

  function usarLocal(tipo: TipoLocal) {
    const l = conta.locais[tipo];
    if (l) escolher(l);
    else setAGuardar(tipo);
  }

  const campoInput = (placeholder: string) => (
    <TextInput autoFocus={focar} value={texto} onChangeText={setTexto} placeholder={placeholder} placeholderTextColor={cores.textSecondary} style={s.input} />
  );
  const eParagem = (i: number) => campo.tipo === 'paragem' && campo.i === i;
  // Uma paragem nova ainda não está na lista até se escolher o lugar.
  const paragemNova = campo.tipo === 'paragem' && campo.i >= pedido.paragens.length;
  const nomeAGuardar = aGuardar && LOCAIS.find((x) => x.tipo === aGuardar)!.nome;

  if (soGuardar) {
    return (
      <SafeAreaView style={s.ecra}>
        <View style={s.cabecalho}>
          <BotaoVoltar onPress={() => router.back()} />
          <Text style={s.titulo}>Morada de {nomeAGuardar ?? LOCAIS.find((x) => x.tipo === soGuardar)!.nome}</Text>
        </View>
        <View style={s.campos}>
          <View style={[s.linhaCampo, s.campoAtivo]}>
            <View style={s.ponto} />
            {campoInput('Procura a morada')}
          </View>
        </View>
        <ListaLugares resultados={resultados} onEscolher={escolher} s={s} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecra}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{campo.tipo === 'origem' ? 'Onde te vamos buscar?' : campo.tipo === 'paragem' ? 'Onde paramos pelo caminho?' : 'Para onde vamos?'}</Text>
      </View>

      <View style={s.campos}>
        <Pressable onPress={() => editar({ tipo: 'origem' })} style={[s.linhaCampo, campo.tipo === 'origem' && s.campoAtivo]}>
          <View style={s.pontoRecolha} />
          {campo.tipo === 'origem' ? (
            campoInput('Ponto de recolha')
          ) : (
            <>
              <Text style={s.origem} numberOfLines={1}>
                {pedido.origem.nome}
              </Text>
              <Text style={s.mudar}>Mudar</Text>
            </>
          )}
        </Pressable>

        {pedido.paragens.map((p, i) => (
          <Pressable key={`${p.id}-${i}`} onPress={() => editar({ tipo: 'paragem', i })} style={[s.linhaCampo, eParagem(i) && s.campoAtivo]}>
            <View style={s.pontoParagem} />
            {eParagem(i) ? (
              campoInput(`Paragem ${i + 1}`)
            ) : (
              <Text style={s.origem} numberOfLines={1}>
                {p.nome}
              </Text>
            )}
            <Pressable onPress={() => pedido.removerParagem(i)} hitSlop={10} accessibilityLabel={`Tirar a paragem ${i + 1}`}>
              <Text style={s.tirar}>×</Text>
            </Pressable>
          </Pressable>
        ))}
        {paragemNova && (
          <View style={[s.linhaCampo, s.campoAtivo]}>
            <View style={s.pontoParagem} />
            {campoInput(`Paragem ${pedido.paragens.length + 1}`)}
            <Pressable onPress={() => editar({ tipo: 'destino' })} hitSlop={10} accessibilityLabel="Não acrescentar paragem">
              <Text style={s.tirar}>×</Text>
            </Pressable>
          </View>
        )}

        <Pressable onPress={() => editar({ tipo: 'destino' })} style={[s.linhaCampo, campo.tipo === 'destino' && s.campoAtivo]}>
          <View style={s.ponto} />
          {campo.tipo === 'destino' ? (
            campoInput('Destino')
          ) : (
            <Text style={s.origem} numberOfLines={1}>
              {pedido.destino?.nome ?? 'Para onde?'}
            </Text>
          )}
        </Pressable>

        {pedido.paragens.length < MAX_PARAGENS && !paragemNova && (
          <Pressable onPress={() => editar({ tipo: 'paragem', i: pedido.paragens.length })} style={s.acrescentar} hitSlop={6}>
            <Text style={s.acrescentarTexto}>+ Acrescentar paragem</Text>
          </Pressable>
        )}
        {campo.tipo === 'origem' && <Text style={s.ajuda}>Podes pedir para outra pessoa: escolhe onde o motorista a deve ir buscar.</Text>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.locais} style={{ flexGrow: 0, flexShrink: 0 }} keyboardShouldPersistTaps="handled">
        {LOCAIS.map(({ tipo, nome }) => {
          const l = conta.locais[tipo];
          return (
            <Pressable key={tipo} onPress={() => usarLocal(tipo)} style={[s.local, aGuardar === tipo && s.campoAtivo]}>
              <Text style={s.localNome}>{nome}</Text>
              <Text style={s.localZona} numberOfLines={1}>
                {l ? l.zona : 'Guardar'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {aGuardar && <Text style={[s.ajuda, { marginHorizontal: Spacing.three, marginBottom: Spacing.two }]}>Escolhe a morada de {nomeAGuardar}. Fica guardada para a próxima vez.</Text>}

      <ListaLugares resultados={resultados} onEscolher={escolher} s={s} />
    </SafeAreaView>
  );
}

function ListaLugares({ resultados, onEscolher, s }: { resultados: Lugar[]; onEscolher: (l: Lugar) => void; s: ReturnType<typeof estilos> }) {
  return (
    <FlatList
      data={resultados}
      keyExtractor={(l) => l.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListEmptyComponent={<Text style={s.vazio}>Nenhum lugar encontrado.</Text>}
      renderItem={({ item }) => (
        <Pressable style={s.item} onPress={() => onEscolher(item)}>
          <Text style={s.nome}>{item.nome}</Text>
          <Text style={s.zona}>{item.zona}</Text>
        </Pressable>
      )}
    />
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700', flexShrink: 1 },
    campos: { margin: Spacing.three, gap: Spacing.two },
    linhaCampo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.botao, paddingHorizontal: Spacing.three },
    // Recolha: o ponto verde da marca. Destino: quadrado preto. Paragem: quadrado vazado.
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    ponto: { width: 8, height: 8, backgroundColor: c.text },
    pontoParagem: { width: 8, height: 8, borderWidth: 2, borderColor: c.text },
    origem: { flex: 1, color: c.textSecondary, fontSize: 16, paddingVertical: Spacing.three },
    campoAtivo: { borderWidth: 1.5, borderColor: c.primary },
    mudar: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
    tirar: { color: c.textSecondary, fontSize: 22, fontWeight: '600', paddingHorizontal: 2 },
    acrescentar: { alignSelf: 'flex-start', paddingVertical: 2 },
    acrescentarTexto: { color: c.text, fontSize: 14, fontWeight: '700' },
    ajuda: { color: c.textSecondary, fontSize: 13 },
    input: { flex: 1, color: c.text, fontSize: 17, fontWeight: '600', paddingVertical: Spacing.three, outlineWidth: 0 },
    locais: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
    local: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minWidth: 110, maxWidth: 180 },
    localNome: { color: c.text, fontSize: 14, fontWeight: '700' },
    localZona: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
    item: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    nome: { color: c.text, fontSize: 16, fontWeight: '600' },
    zona: { color: c.textSecondary, marginTop: 2 },
    vazio: { color: c.textSecondary, textAlign: 'center', marginTop: Spacing.five },
  });
}
