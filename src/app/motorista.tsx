import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoDeslizar } from '@/components/botao-deslizar';
import { EstadoServidor } from '@/components/estado-servidor';
import { Mapa } from '@/components/mapa';
import type { Ponto } from '@/components/mapa-tipos';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoSecundario, BotaoVoltar, Painel } from '@/components/ui';
import { Vidro } from '@/components/vidro';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { distanciaKm, duracaoMin } from '@/data/viagem';
import { TEMPO_REAL_ATIVO, type PedidoMotorista } from '@/data/tempo-real';
import { ganhoMotorista, TEMPO_PARA_ACEITAR, useModoMotorista } from '@/state/modo-motorista';
import { usePedido } from '@/state/pedido';
import { NotaPagamento } from '@/components/nota-pagamento';
import { PercursoViagem } from '@/components/percurso-viagem';
import { useInscricoes } from '@/state/inscricoes';
import { useSessao } from '@/state/sessao';

/** App do motorista, como a da Uber: ficar online, receber e aceitar pedidos, ir buscar, confirmar o código, levar e terminar. */
export default function MotoristaEcra() {
  const cores = usePalette();
  const s = estilos(cores);
  const m = useModoMotorista();
  const { viagem, pedidoNovo, posicao } = m;
  const fase = viagem?.fase;

  // O que aparece no mapa depende do momento: o pedido novo, o caminho até à recolha ou até ao destino.
  const p = viagem?.pedido ?? pedidoNovo;
  const origem = p && (!viagem || fase === 'a_recolha' || fase === 'chegou') ? p.origem : undefined;
  const destino = p && (!viagem || fase === 'em_viagem' || fase === 'concluida') ? p.destino : undefined;

  return (
    <View style={s.ecra}>
      <Mapa
        carro={posicao}
        origem={origem}
        destino={destino}
        paragens={fase === 'em_viagem' ? viagem?.pedido.paragens : undefined}
        rota={viagem?.rota?.pontos ?? (pedidoNovo ? [posicao, pedidoNovo.origem, pedidoNovo.destino] : [])}
        seguirCarro={!pedidoNovo && fase !== 'concluida'}
        margemInferior={380}
      />

      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="box-none">
        <BotaoVoltar onPress={() => router.back()} />
        {m.viatura && (
          <Vidro style={s.ganhos}>
            <Text style={s.ganhosValor}>{formatarMzn(m.ganhosHoje)}</Text>
            <Text style={s.ganhosTexto}>
              Hoje · {m.viagensHoje} {m.viagensHoje === 1 ? 'viagem' : 'viagens'}
            </Text>
          </Vidro>
        )}
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <Painel>
        {!m.viatura ? (
          <EscolherCarro s={s} />
        ) : viagem ? (
          <ViagemEmCurso s={s} />
        ) : pedidoNovo ? (
          <PedidoNovo pedido={pedidoNovo} s={s} />
        ) : (
          <Disponivel s={s} />
        )}
      </Painel>
    </View>
  );
}

type S = ReturnType<typeof estilos>;

function EscolherCarro({ s }: { s: S }) {
  const { viaturas } = usePedido();
  const m = useModoMotorista();
  const { perfil } = useSessao();
  const { inscricoes } = useInscricoes();
  // A conta de demonstração pode conduzir qualquer carro; um motorista aprovado só os que inscreveu.
  const meus = new Set(inscricoes.filter((i) => i.estado === 'aprovada' && i.telefone === perfil?.telefone).map((i) => i.id));
  return (
    <>
      <Text style={s.titulo}>Qual é o teu carro?</Text>
      <Text style={[s.secundario, { marginBottom: Spacing.two }]}>Recebes os pedidos dos clientes que escolherem este carro.</Text>
      <ScrollView style={{ maxHeight: 320 }}>
        {viaturas
          .filter((v) => !v.soCasamento && (perfil?.motoristaDemo || meus.has(v.id)))
          .map((v) => (
            <Pressable key={v.id} onPress={() => m.escolherViatura(v.id)} style={s.linhaCarro}>
              <Text style={s.nome}>{nomeViatura(v)}</Text>
              <Text style={s.secundario}>{v.motorista?.matricula ?? 'Motorista de demonstração'}</Text>
            </Pressable>
          ))}
      </ScrollView>
    </>
  );
}

function Disponivel({ s }: { s: S }) {
  const cores = usePalette();
  const m = useModoMotorista();
  return (
    <>
      <View style={s.estado}>
        <View style={[s.pontoEstado, { backgroundColor: m.online ? cores.go : cores.textSecondary }]} />
        <Text style={s.titulo}>{m.online ? 'Estás online' : 'Estás offline'}</Text>
      </View>
      <Text style={s.secundario}>
        {m.online ? 'À procura de pedidos para o teu carro…' : 'Fica online para receber pedidos.'} {nomeViatura(m.viatura!)} · {m.eu.nome}
      </Text>
      {TEMPO_REAL_ATIVO && <EstadoServidor />}

      <Pressable onPress={() => router.push('/pedidos-motorista')} style={[s.caixa, s.linhaReserva]} accessibilityLabel="Pedidos e reservas">
        <View style={{ flex: 1 }}>
          <Text style={s.nomePequeno}>Pedidos e reservas</Text>
          <Text style={s.secundarioPequeno}>
            {m.agendadas.length} {m.agendadas.length === 1 ? 'reserva agendada' : 'reservas agendadas'}
            {m.agendadas[0]?.recolhaEm ? ` · próxima ${formatarDia(new Date(m.agendadas[0].recolhaEm), new Date()).toLowerCase()}, ${formatarHora(new Date(m.agendadas[0].recolhaEm))}` : ''}
          </Text>
        </View>
        {m.agendadas.length > 0 && (
          <View style={s.contador}>
            <Text style={s.contadorTexto}>{m.agendadas.length}</Text>
          </View>
        )}
        <Text style={s.seta}>›</Text>
      </Pressable>

      <View style={s.linhaDefinicao}>
        <View style={{ flex: 1 }}>
          <Text style={s.nomePequeno}>Simular a condução</Text>
          <Text style={s.secundarioPequeno}>Para testes: o carro anda sozinho pela rota.</Text>
        </View>
        <Switch value={m.simular} onValueChange={m.setSimular} />
      </View>
      {!TEMPO_REAL_ATIVO && (
        <Text style={[s.secundarioPequeno, { marginBottom: Spacing.two }]}>
          Modo de demonstração: sem servidor ligado, os pedidos são simulados.{m.online ? ' ' : ''}
          {m.online && (
            <Text style={s.ligacao} onPress={m.simularPedido}>
              Simular um pedido
            </Text>
          )}
        </Text>
      )}

      <View style={{ gap: Spacing.two }}>
        <BotaoPrincipal texto={m.online ? 'Ficar offline' : 'Ficar online'} escuro={m.online} onPress={() => m.setOnline(!m.online)} />
        {!m.online && <BotaoSecundario texto="Mudar de carro" onPress={() => m.escolherViatura(null)} />}
      </View>
    </>
  );
}

function PedidoNovo({ pedido, s }: { pedido: PedidoMotorista; s: S }) {
  const cores = usePalette();
  const m = useModoMotorista();
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const resta = Math.max(0, (m.expiraEm ?? agora) - agora);
  const kmRecolha = distanciaKm(m.posicao, pedido.origem) * 1.3;

  return (
    <>
      <View style={s.barra}>
        <View style={[s.barraCheia, { width: `${(resta / TEMPO_PARA_ACEITAR) * 100}%`, backgroundColor: cores.go }]} />
      </View>
      <Text style={s.etiqueta}>{pedido.recolhaEm ? `Reserva · ${formatarDia(new Date(pedido.recolhaEm), new Date())}, ${formatarHora(new Date(pedido.recolhaEm))}` : 'Pedido para agora'}</Text>
      <Text style={s.valorGrande}>{formatarMzn(ganhoMotorista(pedido))}</Text>
      <Text style={s.secundario}>
        Recebes isto · {pedido.clienteNome ?? 'o cliente'} {pedido.pagaNoFim ? 'paga' : 'já pagou'} {formatarMzn(pedido.precoMzn)} por {pedido.pagamento}
        {pedido.pagaNoFim ? ' no fim da viagem' : ''}
      </Text>
      <NotaPagamento paraMotorista />

      <View style={s.caixa}>
        <Linha ponto={<View style={s.pontoRecolha} />} titulo={pedido.origem.nome} texto={`${duracaoMin(kmRecolha)} min · ${formatarKm(kmRecolha)} de ti`} s={s} />
        {pedido.paragens.map((p, i) => (
          <Linha key={i} ponto={<View style={s.pontoParagem} />} titulo={p.nome} texto={`Paragem ${i + 1}`} s={s} />
        ))}
        <Linha ponto={<View style={s.pontoDestino} />} titulo={pedido.destino.nome} texto={`Viagem de ${pedido.minutos} min · ${formatarKm(pedido.km)}`} s={s} />
      </View>

      <View style={{ gap: Spacing.two }}>
        <BotaoDeslizar texto={`Desliza para aceitar · ${Math.ceil(resta / 1000)}s`} onConfirmar={m.aceitar} />
        <BotaoDeslizar texto="Desliza para recusar" tipo="secundario" onConfirmar={m.recusar} />
      </View>
    </>
  );
}

function ViagemEmCurso({ s }: { s: S }) {
  const cores = usePalette();
  const m = useModoMotorista();
  const viagem = m.viagem!;
  const { pedido, fase } = viagem;
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(false);
  const [estrelas, setEstrelas] = useState(0);

  const alvo: Ponto = fase === 'a_recolha' || fase === 'chegou' ? pedido.origem : pedido.destino;
  const km = viagem.rota ? viagem.rota.km : distanciaKm(m.posicao, alvo) * 1.3;
  const navegar = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${alvo.latitude},${alvo.longitude}&travelmode=driving`);

  function tentarCodigo(c: string) {
    setCodigo(c);
    setErro(false);
    if (c.length === 4 && !m.comecar(c)) setErro(true);
  }

  if (fase === 'concluida') {
    return (
      <>
        <View style={s.estado}>
          <View style={[s.pontoEstado, { backgroundColor: cores.go }]} />
          <Text style={s.titulo}>Viagem concluída</Text>
        </View>
        <Text style={s.valorGrande}>{formatarMzn(ganhoMotorista(pedido))}</Text>
        <Text style={[s.secundario, { marginBottom: Spacing.three }]}>Já está nos teus ganhos de hoje. {pedido.pagaNoFim ? `O cliente paga agora pela app, por ${pedido.pagamento}.` : `A viagem foi paga antes, por ${pedido.pagamento}.`}</Text>
        <Text style={s.nomePequeno}>Como correu com o cliente?</Text>
        <View style={s.estrelas}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setEstrelas(n)} accessibilityLabel={`${n} estrelas`}>
              <Text style={[s.estrela, { color: n <= estrelas ? cores.accent : cores.backgroundSelected }]}>★</Text>
            </Pressable>
          ))}
        </View>
        <BotaoPrincipal texto="Continuar" onPress={m.fecharResumo} desativado={estrelas === 0} />
      </>
    );
  }

  return (
    <>
      <View style={s.estado}>
        <View style={[s.pontoEstado, { backgroundColor: cores.go }]} />
        <Text style={s.titulo}>{fase === 'a_recolha' ? 'A caminho da recolha' : fase === 'chegou' ? 'Pede o código ao cliente' : `A caminho de ${pedido.destino.nome}`}</Text>
      </View>

      {fase === 'chegou' && (
        <>
          <Text style={[s.secundario, { marginBottom: Spacing.two }]}>O cliente tem um código de 4 números. A viagem só começa com o código certo.</Text>
          <TextInput
            value={codigo}
            onChangeText={(t) => tentarCodigo(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="0000"
            placeholderTextColor={cores.textSecondary}
            style={[s.codigo, erro && { borderColor: '#DC2626' }]}
            accessibilityLabel="Código de recolha"
          />
          {erro && <Text style={s.erro}>Código errado. Confirma com o cliente.</Text>}
          {!TEMPO_REAL_ATIVO && <Text style={s.secundarioPequeno}>Demonstração: o código do cliente é {pedido.codigoRecolha}.</Text>}
        </>
      )}

      {/* Recolha e destino sempre à vista, com o ponto para onde vais agora em destaque. */}
      <PercursoViagem
        origem={pedido.origem}
        paragens={pedido.paragens}
        destino={pedido.destino}
        etapa={fase === 'em_viagem' ? 'destino' : 'recolha'}
        detalheRecolha={fase === 'a_recolha' ? `${duracaoMin(km)} min · ${formatarKm(km)}` : fase === 'chegou' ? 'Chegaste' : undefined}
        detalheDestino={fase === 'em_viagem' ? `${duracaoMin(km)} min · ${formatarKm(km)}` : formatarKm(pedido.km)}
      />
      {pedido.clienteNome ? <Text style={s.secundarioPequeno}>Cliente: {pedido.clienteNome}</Text> : null}

      <View style={[s.botoes, { marginTop: Spacing.three }]}>
        {fase !== 'chegou' && (
          <View style={{ flex: 1 }}>
            <BotaoSecundario texto="Navegar" onPress={navegar} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          {fase === 'a_recolha' && <BotaoPrincipal texto="Cheguei" onPress={m.cheguei} />}
          {fase === 'em_viagem' && <BotaoPrincipal texto="Terminar viagem" onPress={m.terminar} />}
        </View>
      </View>
      {fase !== 'em_viagem' && (
        <Pressable onPress={m.cancelarViagem} style={{ alignSelf: 'center', paddingTop: Spacing.three }} hitSlop={8}>
          <Text style={s.cancelar}>Cancelar viagem</Text>
        </Pressable>
      )}
    </>
  );
}

function Linha({ ponto, titulo, texto, s }: { ponto: ReactNode; titulo: string; texto: string; s: S }) {
  return (
    <View style={s.linha}>
      {ponto}
      <View style={{ flex: 1 }}>
        <Text style={s.nomePequeno} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={s.secundarioPequeno}>{texto}</Text>
      </View>
    </View>
  );
}

const formatarKm = (km: number) => `${km.toFixed(1).replace('.', ',')} km`;

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    ganhos: { borderRadius: Radius.pill, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, alignItems: 'center', backgroundColor: c.background },
    ganhosValor: { color: c.text, fontSize: 18, fontWeight: '800' },
    ganhosTexto: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
    estado: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
    pontoEstado: { width: 10, height: 10, borderRadius: 5 },
    titulo: { color: c.text, fontSize: 20, fontWeight: '800', flexShrink: 1 },
    subtitulo: { color: c.text, fontSize: 15, fontWeight: '800', marginBottom: Spacing.one },
    nome: { color: c.text, fontSize: 16, fontWeight: '700' },
    nomePequeno: { color: c.text, fontSize: 15, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14 },
    secundarioPequeno: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
    ligacao: { color: c.text, fontWeight: '800', textDecorationLine: 'underline' },
    etiqueta: { color: c.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.two },
    valorGrande: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    caixa: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two, marginVertical: Spacing.three },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    linhaCarro: { paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    linhaReserva: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    linhaDefinicao: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginVertical: Spacing.three },
    botaoPequeno: { backgroundColor: c.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    botaoPequenoTexto: { color: c.onPrimary, fontSize: 13, fontWeight: '800' },
    pontoRecolha: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.go },
    pontoDestino: { width: 10, height: 10, backgroundColor: c.text },
    pontoParagem: { width: 10, height: 10, borderWidth: 2, borderColor: c.text },
    barra: { height: 4, borderRadius: 2, backgroundColor: c.backgroundSelected, overflow: 'hidden' },
    barraCheia: { height: 4, borderRadius: 2 },
    botoes: { flexDirection: 'row', gap: Spacing.two },
    codigo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, borderWidth: 2, borderColor: 'transparent', color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: 12, textAlign: 'center', paddingVertical: Spacing.three },
    erro: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginTop: Spacing.one },
    estrelas: { flexDirection: 'row', gap: Spacing.two, marginVertical: Spacing.two },
    estrela: { fontSize: 36 },
    contador: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.go, alignItems: 'center', justifyContent: 'center' },
    contadorTexto: { color: '#000000', fontSize: 12, fontWeight: '800' },
    seta: { color: c.textSecondary, fontSize: 22, fontWeight: '600' },
    cancelar: { color: c.textSecondary, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  });
}
