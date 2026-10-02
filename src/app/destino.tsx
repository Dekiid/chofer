import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarcarNoMapa } from '@/components/marcar-no-mapa';
import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { nomeLugar, pesquisarLugares, zonaLugar, type Lugar } from '@/data/lugares';
import { LOCAIS, useConta, type TipoLocal } from '@/state/conta';
import { MAX_PARAGENS, usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';
import { t } from '@/i18n';

/** Campo que se está a preencher: a recolha, o destino ou uma das paragens pelo caminho. */
type Campo = { tipo: 'origem' } | { tipo: 'destino' } | { tipo: 'paragem'; i: number };

export default function Destino() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const conta = useConta();
  // campo=origem abre na recolha; guardar=casa|trabalho|aeroporto escolhe a morada de um local guardado e volta atrás.
  // para=reserva volta ao aluguer ou casamento depois de escolher o local.
  const params = useLocalSearchParams<{ campo?: string; guardar?: string; para?: string }>();
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
  // Marcar o local com o pin, em vez de o procurar pelo nome.
  const [noMapa, setNoMapa] = useState(false);

  function editar(c: Campo) {
    setCampo(c);
    setTexto('');
    setFocar(true);
  }

  function escolher(l: Lugar) {
    if (aGuardar) {
      const nome = LOCAIS.find((x) => x.tipo === aGuardar)!.nome;
      conta.guardarLocal(aGuardar, { ...l, id: `local-${aGuardar}`, nome, zona: l.id === 'atual' ? zonaLugar(l) : l.nome });
      setAGuardar(null);
      if (soGuardar) {
        router.back();
        return;
      }
    }
    if (campo.tipo === 'origem') {
      pedido.setOrigem(l);
      if (params.para === 'reserva') {
        router.back();
        return;
      }
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

  if (noMapa) {
    // O mapa abre no local que já estava escolhido para este campo, ou perto da recolha.
    const atual = campo.tipo === 'origem' ? pedido.origem : campo.tipo === 'paragem' ? (pedido.paragens[campo.i] ?? pedido.destino ?? pedido.origem) : (pedido.destino ?? pedido.origem);
    return (
      <MarcarNoMapa
        tipo={aGuardar ? 'destino' : campo.tipo}
        inicial={atual}
        onVoltar={() => setNoMapa(false)}
        onConfirmar={(l) => {
          setNoMapa(false);
          escolher(l);
        }}
      />
    );
  }

  if (soGuardar) {
    return (
      <SafeAreaView style={s.ecra}>
        <View style={s.cabecalho}>
          <BotaoVoltar onPress={() => router.back()} />
          <Text style={s.titulo}>{t('Morada de {local}', { local: t(nomeAGuardar ?? LOCAIS.find((x) => x.tipo === soGuardar)!.nome) })}</Text>
        </View>
        <View style={s.campos}>
          <View style={[s.linhaCampo, s.campoAtivo]}>
            <View style={s.ponto} />
            {campoInput(t('Procura a morada'))}
          </View>
        </View>
        <ListaLugares resultados={resultados} onEscolher={escolher} onMapa={() => setNoMapa(true)} s={s} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecra}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{campo.tipo === 'origem' ? t('Onde te vamos buscar?') : campo.tipo === 'paragem' ? t('Onde paramos pelo caminho?') : t('Para onde vamos?')}</Text>
      </View>

      <View style={s.campos}>
        <Pressable onPress={() => editar({ tipo: 'origem' })} style={[s.linhaCampo, campo.tipo === 'origem' && s.campoAtivo]}>
          <View style={s.pontoRecolha} />
          {campo.tipo === 'origem' ? (
            campoInput(t('Ponto de recolha'))
          ) : (
            <>
              <Text style={s.origem} numberOfLines={1}>
                {nomeLugar(pedido.origem)}
              </Text>
              <Text style={s.mudar}>{t('Mudar')}</Text>
            </>
          )}
        </Pressable>

        {pedido.paragens.map((p, i) => (
          <Pressable key={`${p.id}-${i}`} onPress={() => editar({ tipo: 'paragem', i })} style={[s.linhaCampo, eParagem(i) && s.campoAtivo]}>
            <View style={s.pontoParagem} />
            {eParagem(i) ? (
              campoInput(t('Paragem {n}', { n: i + 1 }))
            ) : (
              <Text style={s.origem} numberOfLines={1}>
                {p.nome}
              </Text>
            )}
            <Pressable onPress={() => pedido.removerParagem(i)} hitSlop={10} accessibilityLabel={t('Tirar a paragem {n}', { n: i + 1 })}>
              <Text style={s.tirar}>×</Text>
            </Pressable>
          </Pressable>
        ))}
        {paragemNova && (
          <View style={[s.linhaCampo, s.campoAtivo]}>
            <View style={s.pontoParagem} />
            {campoInput(t('Paragem {n}', { n: pedido.paragens.length + 1 }))}
            <Pressable onPress={() => editar({ tipo: 'destino' })} hitSlop={10} accessibilityLabel={t('Não acrescentar paragem')}>
              <Text style={s.tirar}>×</Text>
            </Pressable>
          </View>
        )}

        <Pressable onPress={() => editar({ tipo: 'destino' })} style={[s.linhaCampo, campo.tipo === 'destino' && s.campoAtivo]}>
          <View style={s.ponto} />
          {campo.tipo === 'destino' ? (
            campoInput(t('Destino'))
          ) : (
            <Text style={s.origem} numberOfLines={1}>
              {pedido.destino ? nomeLugar(pedido.destino) : t('Para onde?')}
            </Text>
          )}
        </Pressable>

        {pedido.paragens.length < MAX_PARAGENS && !paragemNova && (
          <Pressable onPress={() => editar({ tipo: 'paragem', i: pedido.paragens.length })} style={s.acrescentar} hitSlop={6}>
            <Text style={s.acrescentarTexto}>{t('+ Acrescentar paragem')}</Text>
          </Pressable>
        )}
        {campo.tipo === 'origem' && <Text style={s.ajuda}>{t('Podes pedir para outra pessoa: escolhe onde o motorista a deve ir buscar.')}</Text>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.locais} style={{ flexGrow: 0, flexShrink: 0 }} keyboardShouldPersistTaps="handled">
        {LOCAIS.map(({ tipo, nome }) => {
          const l = conta.locais[tipo];
          return (
            <Pressable key={tipo} onPress={() => usarLocal(tipo)} style={[s.local, aGuardar === tipo && s.campoAtivo]}>
              <Text style={s.localNome}>{t(nome)}</Text>
              <Text style={s.localZona} numberOfLines={1}>
                {l ? l.zona : t('Guardar')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {aGuardar && <Text style={[s.ajuda, { marginHorizontal: Spacing.three, marginBottom: Spacing.two }]}>{t('Escolhe a morada de {local}. Fica guardada para a próxima vez.', { local: t(nomeAGuardar ?? '') })}</Text>}

      <ListaLugares resultados={resultados} onEscolher={escolher} onMapa={() => setNoMapa(true)} s={s} />
    </SafeAreaView>
  );
}

function ListaLugares({ resultados, onEscolher, onMapa, s }: { resultados: Lugar[]; onEscolher: (l: Lugar) => void; onMapa: () => void; s: ReturnType<typeof estilos> }) {
  return (
    <FlatList
      data={resultados}
      ListHeaderComponent={
        <Pressable style={[s.item, s.itemMapa]} onPress={onMapa}>
          <View style={s.iconePin}>
            <View style={s.cabecaPin} />
            <View style={s.hastePin} />
          </View>
          <View>
            <Text style={s.nome}>{t('Marcar no mapa')}</Text>
            <Text style={s.zona}>{t('Põe o pin no sítio exato')}</Text>
          </View>
        </Pressable>
      }
      keyExtractor={(l) => l.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListEmptyComponent={<Text style={s.vazio}>{t('Nenhum lugar encontrado.')}</Text>}
      renderItem={({ item }) => (
        <Pressable style={s.item} onPress={() => onEscolher(item)}>
          <Text style={s.nome}>{nomeLugar(item)}</Text>
          <Text style={s.zona}>{zonaLugar(item)}</Text>
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
    itemMapa: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    iconePin: { width: 20, alignItems: 'center' },
    cabecaPin: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: c.text },
    hastePin: { width: 2, height: 7, backgroundColor: c.text },
    nome: { color: c.text, fontSize: 16, fontWeight: '600' },
    zona: { color: c.textSecondary, marginTop: 2 },
    vazio: { color: c.textSecondary, textAlign: 'center', marginTop: Spacing.five },
  });
}
