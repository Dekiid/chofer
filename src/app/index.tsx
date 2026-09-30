import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FotoCarro } from '@/components/foto-carro';
import { Logo } from '@/components/logo';
import { BotaoPrincipal, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn, nomeViatura, type Modo, type Viatura } from '@/data/categorias';
import { precoCasamento, type Decoracao } from '@/data/casamento';
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
  const [decoracao, setDecoracao] = useState<Decoracao>('com');
  const lista = pedido.viaturas.filter((v) => disponivel(v, modo));
  // Com decoração mostra o mesmo modelo decorado para casamento, quando há essa foto.
  const casamento = pedido.viatura.casamento;
  const fotoDecorada = modo === 'casamento' && decoracao === 'com' && casamento?.foto ? { foto: casamento.foto, credito: casamento.credito } : undefined;

  function mudarModo(m: Modo) {
    setModo(m);
    // Nem todos os carros estão para aluguer ou casamentos; se o escolhido não estiver, passa para o primeiro que está.
    if (!disponivel(pedido.viatura, m)) {
      const primeiro = pedido.viaturas.find((v) => disponivel(v, m));
      if (primeiro) pedido.setViaturaId(primeiro.id);
    }
  }

  function preco(v: Viatura): { valor: number; unidade: string; descricao: string } {
    if (modo === 'aluguer') return { valor: v.porDiaMzn ?? 0, unidade: '/dia', descricao: `${v.tipo} · ${v.lugares} lugares · sem motorista` };
    if (modo === 'casamento' && v.casamento)
      return { valor: precoCasamento(v.casamento, decoracao), unidade: '/evento', descricao: `${v.tipo} · ${v.lugares} lugares` };
    return { valor: v.porKmMzn, unidade: '/km', descricao: `${v.tipo} · ${v.lugares} lugares · chega em ${v.chegadaMin} min` };
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
        <FotoCarro
          viatura={pedido.viatura}
          style={s.foto}
          ilustracao={fotoDecorada && { ...fotoDecorada, etiqueta: 'Decorado para casamento' }}
        />
        <View style={s.legenda} pointerEvents="none">
          <Text style={s.nomeCarro}>{nomeViatura(pedido.viatura)}</Text>
          <Text style={s.descricao}>{pedido.viatura.tipo}</Text>
        </View>
      </View>

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <Logo altura={30} style={s.marca} />
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
          {MODOS.map((m) => (
            <Pressable key={m.id} onPress={() => mudarModo(m.id)} style={[s.opcaoModo, modo === m.id && s.opcaoModoAtiva]}>
              <Text style={[s.textoModo, modo === m.id && s.textoModoAtivo]}>{m.nome}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.pergunta}>{MODOS.find((m) => m.id === modo)?.pergunta}</Text>
        {modo === 'casamento' && (
          <View style={s.decoracoes}>
            {(['com', 'sem'] as const).map((d) => (
              <Pressable key={d} onPress={() => setDecoracao(d)} style={[s.decoracao, decoracao === d && s.opcaoModoAtiva]}>
                <Text style={[s.textoModo, decoracao === d && s.textoModoAtivo]}>{d === 'com' ? 'Com decoração' : 'Sem decoração'}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <ScrollView style={[s.lista, modo === 'casamento' && s.listaCasamento]} contentContainerStyle={{ gap: Spacing.one }}>
          {lista.map((v) => {
            const ativa = v.id === pedido.viatura.id;
            const p = preco(v);
            return (
              <Pressable key={v.id} onPress={() => pedido.setViaturaId(v.id)} style={[s.cartao, ativa && s.cartaoAtivo]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{nomeViatura(v)}</Text>
                  <Text style={s.descricao}>{p.descricao}</Text>
                </View>
                <Text style={s.preco}>
                  {formatarMzn(p.valor)}
                  <Text style={s.lugares}>{p.unidade}</Text>
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
        ) : modo === 'aluguer' ? (
          <BotaoPrincipal texto={`Alugar ${nomeViatura(pedido.viatura)}`} onPress={() => {}} />
        ) : (
          <>
            <BotaoPrincipal texto={`Reservar ${nomeViatura(pedido.viatura)}`} onPress={() => {}} />
            <Text style={[s.descricao, s.notaCasamento]}>
              {decoracao === 'com' ? 'Com motorista e decoração de flores e fitas.' : 'Com motorista, sem decoração.'}
            </Text>
          </>
        )}
      </Painel>
    </View>
  );
}

const MODOS: { id: Modo; nome: string; pergunta: string }[] = [
  { id: 'motorista', nome: 'Com motorista', pergunta: 'Escolhe o teu carro' },
  { id: 'aluguer', nome: 'Aluguer', pergunta: 'Escolhe o carro para alugar' },
  { id: 'casamento', nome: 'Casamento', pergunta: 'Carro para o teu casamento' },
];

function disponivel(v: Viatura, modo: Modo): boolean {
  if (modo === 'aluguer') return v.porDiaMzn !== undefined;
  if (modo === 'casamento') return v.casamento !== undefined;
  return true;
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
    marca: { marginTop: Spacing.two + 2, marginLeft: -2 },
    alternador: { flexDirection: 'row', backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: Spacing.one, marginBottom: Spacing.three },
    opcaoModo: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    opcaoModoAtiva: { backgroundColor: c.primary },
    textoModo: { color: c.textSecondary, fontWeight: '600' },
    textoModoAtivo: { color: c.onPrimary },
    decoracoes: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
    decoracao: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: c.backgroundElement },
    notaCasamento: { textAlign: 'center', paddingTop: Spacing.two, fontSize: 13 },
    pergunta: { color: c.text, fontSize: 20, fontWeight: '700', marginBottom: Spacing.two },
    lista: { marginBottom: Spacing.three, maxHeight: 250 },
    // A escolha da decoração e a nota ocupam espaço; a lista encolhe para o painel não tapar a foto.
    listaCasamento: { maxHeight: 180 },
    cartao: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent' },
    cartaoAtivo: { borderColor: c.primary, backgroundColor: c.backgroundElement },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    lugares: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    descricao: { color: c.textSecondary, marginTop: 2 },
    preco: { color: c.text, fontSize: 16, fontWeight: '700' },
  });
}
