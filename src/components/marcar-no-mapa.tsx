import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapaMarcar } from '@/components/mapa-marcar';
import type { Ponto } from '@/components/mapa-tipos';
import { Text } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar, Painel } from '@/components/ui';
import { Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import type { Lugar } from '@/data/lugares';
import { lugarNoPonto } from '@/data/moradas';

export type TipoPin = 'origem' | 'destino' | 'paragem';

const TEXTOS: Record<TipoPin, { titulo: string; botao: string }> = {
  origem: { titulo: 'Onde te vamos buscar?', botao: 'Confirmar recolha' },
  destino: { titulo: 'Para onde vamos?', botao: 'Confirmar destino' },
  paragem: { titulo: 'Onde paramos pelo caminho?', botao: 'Confirmar paragem' },
};

/** Marcar a recolha, o destino ou uma paragem arrastando o mapa por baixo do pin. */
export function MarcarNoMapa({ tipo, inicial, onConfirmar, onVoltar }: { tipo: TipoPin; inicial: Lugar; onConfirmar: (l: Lugar) => void; onVoltar: () => void }) {
  const cores = usePalette();
  const s = estilos(cores);
  const [lugar, setLugar] = useState<Lugar | null>(inicial);
  const [aMexer, setAMexer] = useState(false);
  // Só conta a resposta do último ponto: o mapa pode parar várias vezes seguidas.
  const pedidoAtual = useRef(0);

  function mexer() {
    setAMexer(true);
    setLugar(null);
    pedidoAtual.current++;
  }

  async function mover(p: Ponto) {
    setAMexer(false);
    // O mapa também avisa quando abre no ponto inicial; esse já tem nome.
    if (Math.abs(p.latitude - inicial.latitude) < 1e-5 && Math.abs(p.longitude - inicial.longitude) < 1e-5) {
      setLugar(inicial);
      return;
    }
    const n = ++pedidoAtual.current;
    setLugar(null);
    const l = await lugarNoPonto(p);
    if (n === pedidoAtual.current) setLugar(l);
  }

  // Ao sair do ecrã, respostas atrasadas deixam de contar.
  useEffect(
    () => () => {
      pedidoAtual.current++;
    },
    [],
  );

  const texto = TEXTOS[tipo];
  return (
    <View style={s.ecra}>
      <MapaMarcar inicial={inicial} onMexer={mexer} onMover={mover} />

      <View style={s.centro} pointerEvents="none">
        <View style={[s.pin, aMexer && { transform: [{ translateY: -8 }] }]}>
          {tipo === 'origem' ? <View style={s.cabecaRecolha} /> : <View style={[s.cabecaDestino, tipo === 'paragem' && s.cabecaParagem]} />}
          <View style={s.haste} />
        </View>
        <View style={s.sombra} />
      </View>

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <BotaoVoltar onPress={onVoltar} />
      </SafeAreaView>

      <Painel>
        <Text style={s.titulo}>{texto.titulo}</Text>
        <Text style={s.ajuda}>Arrasta o mapa até o pin ficar no sítio certo.</Text>
        <View style={s.morada}>
          <Text style={s.nome} numberOfLines={1}>
            {lugar ? lugar.nome : aMexer ? 'A mover o mapa…' : 'A procurar a morada…'}
          </Text>
          {lugar?.zona ? (
            <Text style={s.zona} numberOfLines={1}>
              {lugar.zona}
            </Text>
          ) : null}
        </View>
        <BotaoPrincipal texto={texto.botao} escuro desativado={!lugar} onPress={() => lugar && onConfirmar(lugar)} />
      </Painel>
    </View>
  );
}

const CABECA = 22;
const HASTE = 16;

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    // A ponta da haste fica exatamente no centro do mapa.
    centro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    pin: { alignItems: 'center', marginBottom: CABECA + HASTE },
    cabecaRecolha: { width: CABECA, height: CABECA, borderRadius: CABECA / 2, backgroundColor: '#22C55E', borderWidth: 4, borderColor: '#FFFFFF' },
    cabecaDestino: { width: CABECA, height: CABECA, backgroundColor: c.text, borderWidth: 4, borderColor: c.background },
    cabecaParagem: { backgroundColor: '#FFFFFF', borderColor: c.text },
    haste: { width: 3, height: HASTE, backgroundColor: c.text },
    sombra: { position: 'absolute', width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    ajuda: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
    morada: { paddingVertical: Spacing.three },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    zona: { color: c.textSecondary, fontSize: 14, marginTop: 2 },
  });
}
