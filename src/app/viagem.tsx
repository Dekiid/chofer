import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Mapa } from '@/components/mapa';
import type { Ponto } from '@/components/mapa-tipos';
import { BotaoPrincipal, BotaoSecundario, Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { CATEGORIAS_MOTORISTA, formatarMzn } from '@/data/categorias';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { distanciaKm, estimarPreco, interpolar } from '@/data/viagem';
import { PAGAMENTOS, usePedido } from '@/state/pedido';

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

  const categoria = CATEGORIAS_MOTORISTA.find((c) => c.id === pedido.categoriaId) ?? CATEGORIAS_MOTORISTA[0];
  const preco = estimarPreco(categoria, distanciaKm(origem, destino));
  const pagamento = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome;
  const minutosRestantes = Math.max(1, Math.round(categoria.chegadaMin * (1 - progresso)));

  function sair() {
    pedido.limpar();
    router.replace('/');
  }

  const titulo: Record<Fase, string> = {
    procurar: 'A procurar motorista',
    a_caminho: `O motorista chega em ${minutosRestantes} min`,
    chegou: 'O motorista chegou',
    em_viagem: `A caminho de ${destino.nome}`,
    concluida: 'Chegaste ao destino',
  };

  return (
    <View style={s.ecra}>
      <Mapa origem={fase === 'em_viagem' || fase === 'concluida' ? undefined : origem} destino={destino} carro={carro} margemInferior={360} />

      <Painel>
        <Text style={s.titulo}>{titulo[fase]}</Text>

        {fase === 'procurar' ? (
          <View style={s.procura}>
            <ActivityIndicator color={cores.text} />
            <Text style={s.secundario}>
              {categoria.nome} · {formatarMzn(preco)} · {pagamento}
            </Text>
          </View>
        ) : (
          <View style={s.motorista}>
            <View style={s.avatar}>
              <Text style={s.avatarTexto}>{MOTORISTA_EXEMPLO.nome[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>
                {MOTORISTA_EXEMPLO.nome} <Text style={s.secundario}>★ {MOTORISTA_EXEMPLO.avaliacao.toString().replace('.', ',')}</Text>
              </Text>
              <Text style={s.secundario}>{MOTORISTA_EXEMPLO.viatura}</Text>
            </View>
            <Text style={s.matricula}>{MOTORISTA_EXEMPLO.matricula}</Text>
          </View>
        )}

        {fase === 'concluida' ? (
          <>
            <Text style={s.total}>
              {formatarMzn(preco)} <Text style={s.secundario}>· {pagamento}</Text>
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
            {fase === 'chegou' && <BotaoPrincipal texto="Iniciar viagem" onPress={() => setFase('em_viagem')} />}
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
    titulo: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: Spacing.three },
    procura: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.four },
    motorista: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.card, backgroundColor: c.backgroundElement, marginBottom: Spacing.three },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { color: c.onPrimary, fontSize: 20, fontWeight: '700' },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    matricula: { color: c.text, fontWeight: '700', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 6, borderWidth: 1, borderColor: c.text },
    total: { color: c.text, fontSize: 28, fontWeight: '800', marginBottom: Spacing.two },
    estrelas: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
    estrela: { fontSize: 36 },
  });
}
