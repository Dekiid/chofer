import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mapa } from '@/components/mapa';
import type { Ponto } from '@/components/mapa-tipos';
import { BotaoPrincipal, BotaoSecundario, Painel } from '@/components/ui';
import { Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { calcularPreco, distanciaKm, interpolar } from '@/data/viagem';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';

type Fase = 'procurar' | 'a_caminho' | 'chegou' | 'em_viagem' | 'concluida';

// Durações da simulação, em milissegundos.
const TEMPO_PROCURA = 3000;
const TEMPO_DESLOCACAO = 10000;
const PASSO = 250;

export default function Viagem() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { origem, destino } = pedido;

  const [fase, setFase] = useState<Fase>('procurar');
  const [carro, setCarro] = useState<Ponto | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [estrelas, setEstrelas] = useState(0);
  const inicioCarro = useRef<Ponto | null>(null);

  // Procurar motorista e, quando encontrado, colocá-lo a cerca de 2 km da recolha.
  useEffect(() => {
    if (fase !== 'procurar') return;
    const t = setTimeout(() => {
      inicioCarro.current = { latitude: origem.latitude + 0.012, longitude: origem.longitude - 0.012 };
      setCarro(inicioCarro.current);
      setProgresso(0);
      setFase('a_caminho');
    }, TEMPO_PROCURA);
    return () => clearTimeout(t);
  }, [fase, origem]);

  // Mover o carro até à recolha (a_caminho) ou até ao destino (em_viagem).
  useEffect(() => {
    if ((fase !== 'a_caminho' && fase !== 'em_viagem') || !destino) return;
    const de = fase === 'a_caminho' ? inicioCarro.current : origem;
    const para = fase === 'a_caminho' ? origem : destino;
    if (!de) return;
    let t = 0;
    const id = setInterval(() => {
      t = Math.min(1, t + PASSO / TEMPO_DESLOCACAO);
      setCarro(interpolar(de, para, t));
      setProgresso(t);
      if (t >= 1) {
        clearInterval(id);
        setFase(fase === 'a_caminho' ? 'chegou' : 'concluida');
      }
    }, PASSO);
    return () => clearInterval(id);
  }, [fase, origem, destino]);

  if (!destino) return <Redirect href="/" />;

  const viatura = pedido.viatura;
  const motorista = viatura.motorista ?? MOTORISTA_EXEMPLO;
  const preco = calcularPreco(viatura, distanciaKm(origem, destino), pedido.quando?.tipo === 'imediato');
  const pagamento = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome;
  const minutosRestantes = Math.max(1, Math.round(viatura.chegadaMin * (1 - progresso)));

  function sair() {
    pedido.limpar();
    router.dismissTo('/');
  }

  // Estados curtos, como no manual: «Chega em 4 min».
  const titulo: Record<Fase, string> = {
    procurar: 'A procurar motorista',
    a_caminho: `Chega em ${minutosRestantes} min`,
    chegou: 'O teu chauffeur chegou',
    em_viagem: `A caminho de ${destino.nome}`,
    concluida: 'Chegaste ao destino',
  };
  const contactar = () => Linking.openURL(`tel:${motorista.telefone}`);

  return (
    <View style={s.ecra}>
      <Mapa
        origem={fase === 'em_viagem' || fase === 'concluida' ? undefined : origem}
        // Como no manual: com o motorista a caminho, só o carro e a recolha.
        destino={fase === 'a_caminho' || fase === 'chegou' ? undefined : destino}
        carro={carro}
        // Com o motorista a caminho, a rota é do carro até à recolha.
        rota={fase === 'a_caminho' && carro ? [carro, origem] : fase === 'em_viagem' && carro ? [carro, destino] : undefined}
        margemInferior={360}
      />

      {fase === 'chegou' && (
        <SafeAreaView edges={['top']} style={s.topoAviso} pointerEvents="none">
          <View style={s.aviso}>
            <View style={s.avisoIcone}>
              <Text style={s.avisoC}>c</Text>
              <View style={s.avisoPonto} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.avisoTitulo}>O teu chauffeur chegou</Text>
              <Text style={s.avisoTexto}>
                {motorista.nome.split(' ')[0]} está à porta num {nomeViatura(viatura)}.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      )}

      <Painel>
        <View style={s.estado}>
          {fase !== 'procurar' && <View style={s.pontoEstado} />}
          <Text style={s.titulo}>{titulo[fase]}</Text>
        </View>

        {fase === 'procurar' ? (
          <View style={s.procura}>
            <ActivityIndicator color={cores.text} />
            <Text style={s.secundario}>
              {nomeViatura(viatura)} · {formatarMzn(preco)} pago por {pagamento}
            </Text>
          </View>
        ) : (
          <View style={s.motorista}>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{motorista.nome[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>
                {motorista.nome}{' '}
                {motorista.avaliacao !== undefined && <Text style={s.secundario}>★ {motorista.avaliacao.toString().replace('.', ',')}</Text>}
              </Text>
              <Text style={s.secundario}>{nomeViatura(viatura)}</Text>
            </View>
            <Text style={s.matricula}>{motorista.matricula}</Text>
          </View>
        )}

        {fase === 'concluida' ? (
          <>
            <Text style={s.total}>
              {formatarMzn(preco)} <Text style={s.secundario}>· pago por {pagamento}</Text>
            </Text>
            <Text style={[s.secundario, { marginBottom: Spacing.two }]}>Como foi a viagem?</Text>
            <View style={s.estrelas}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setEstrelas(n)} accessibilityLabel={`${n} estrelas`}>
                  <Text style={[s.estrela, { color: n <= estrelas ? cores.accent : cores.backgroundSelected }]}>★</Text>
                </Pressable>
              ))}
            </View>
            <BotaoPrincipal texto="Concluir" onPress={sair} desativado={estrelas === 0} />
          </>
        ) : (
          <View style={{ gap: Spacing.two }}>
            {(fase === 'a_caminho' || fase === 'em_viagem') && <BotaoPrincipal texto="Contactar motorista" onPress={contactar} />}
            {fase === 'chegou' && (
              <>
                <BotaoPrincipal texto="Já estou no carro" onPress={() => setFase('em_viagem')} />
                <BotaoSecundario texto="Contactar motorista" onPress={contactar} />
              </>
            )}
            {(fase === 'procurar' || fase === 'a_caminho' || fase === 'chegou') && <BotaoSecundario texto="Cancelar pedido" onPress={sair} />}
          </View>
        )}
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    estado: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
    pontoEstado: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.go },
    titulo: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
    procura: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.four },
    motorista: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.backgroundSelected, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { color: c.text, fontSize: 20, fontWeight: '800' },
    matricula: { color: c.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, backgroundColor: c.backgroundElement, borderRadius: 6, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, overflow: 'hidden' },
    topoAviso: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    aviso: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: Spacing.three, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
    avisoIcone: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    avisoC: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: -4 },
    avisoPonto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E', marginLeft: 1, marginTop: 8 },
    avisoTitulo: { color: '#000000', fontSize: 14, fontWeight: '800' },
    avisoTexto: { color: '#000000', fontSize: 13 },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    total: { color: c.text, fontSize: 28, fontWeight: '800', marginBottom: Spacing.two },
    estrelas: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
    estrela: { fontSize: 36 },
  });
}
