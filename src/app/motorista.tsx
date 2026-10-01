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
import { duracaoTexto } from '@/data/datas';
import { ESPERA_MIN } from '@/data/cancelamento';
import { ELOGIOS_CLIENTE, ESPERA_AEROPORTO_MIN, ligacaoVoo, textoPreferencias } from '@/data/extras-viagem';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { nomeLugar } from '@/data/lugares';
import { distanciaKm, duracaoMin } from '@/data/viagem';
import { TEMPO_REAL_ATIVO, type PedidoMotorista } from '@/data/tempo-real';
import { formatarNota, useAvaliacoes } from '@/state/avaliacoes';
import { useAcompanharChat, useChat } from '@/state/chat';
import { estadoDocumentos, useInscricoes } from '@/state/inscricoes';
import { ganhoMotorista, HORAS_ATE_DESCANSO, minutosPausa, TEMPO_PARA_ACEITAR, useModoMotorista } from '@/state/modo-motorista';
import { usePedido } from '@/state/pedido';
import { NotaPagamento } from '@/components/nota-pagamento';
import { PercursoViagem } from '@/components/percurso-viagem';
import { useSessao } from '@/state/sessao';
import { t } from '@/i18n';

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
          <Pressable onPress={() => router.push('/ganhos')} accessibilityLabel={t('Ver ganhos')}>
            <Vidro style={s.ganhos}>
              <Text style={s.ganhosValor}>{formatarMzn(m.ganhosHoje)}</Text>
              <Text style={s.ganhosTexto}>
                {m.viagensHoje === 1 ? t('Hoje · {n} viagem', { n: m.viagensHoje }) : t('Hoje · {n} viagens', { n: m.viagensHoje })} ›
              </Text>
            </Vidro>
          </Pressable>
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

/** Na recolha: quanto tempo falta de espera; depois disso, o motorista pode marcar falta de comparência. */
function Espera({ chegouEm, minutos, s }: { chegouEm?: number; minutos: number; s: S }) {
  const m = useModoMotorista();
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!chegouEm) return null;
  const falta = chegouEm + minutos * 60000 - agora;
  if (falta > 0) {
    const min = Math.floor(falta / 60000);
    const seg = Math.floor((falta % 60000) / 1000);
    return (
      <Text style={s.secundarioPequeno}>
        {t('Espera {tempo}. Se o cliente não aparecer, podes marcar falta de comparência e ele paga a taxa.', { tempo: `${min}:${String(seg).padStart(2, '0')}` })}
      </Text>
    );
  }
  return (
    <View style={{ marginTop: Spacing.two }}>
      <BotaoSecundario texto={t('O cliente não apareceu')} onPress={() => m.cancelarViagem('falta')} />
    </View>
  );
}

function EscolherCarro({ s }: { s: S }) {
  const { viaturas } = usePedido();
  const m = useModoMotorista();
  const { perfil } = useSessao();
  const { inscricoes } = useInscricoes();
  // Cada motorista conduz só os carros pessoais que inscreveu e foram aprovados. A conta de demonstração usa a frota de exemplo.
  const minhas = inscricoes.filter((i) => i.telefone === perfil?.telefone);
  const aprovados = new Set(minhas.filter((i) => i.estado === 'aprovada').map((i) => i.id));
  const carros = viaturas.filter((v) => !v.soCasamento && (perfil?.motoristaDemo ? !v.id.startsWith('insc-') : aprovados.has(v.id)));
  const pendentes = minhas.filter((i) => i.estado === 'pendente').length;
  return (
    <>
      <Text style={s.titulo}>{t('Qual é o teu carro?')}</Text>
      <Text style={[s.secundario, { marginBottom: Spacing.two }]}>
        {carros.length > 0
          ? t('Recebes os pedidos dos clientes que escolherem este carro.')
          : pendentes > 0
            ? t('O teu carro está à espera de aprovação. Depois de aprovado, aparece aqui.')
            : t('Ainda não tens nenhum carro aprovado. Inscreve o teu carro para receberes pedidos.')}
      </Text>
      <ScrollView style={{ maxHeight: 320 }}>
        {carros.map((v) => (
          <Pressable key={v.id} onPress={() => m.escolherViatura(v.id)} style={s.linhaCarro}>
            <Text style={s.nome}>{nomeViatura(v)}</Text>
            <Text style={s.secundario}>{v.motorista?.matricula ?? t('Motorista de demonstração')}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {!perfil?.motoristaDemo && (
        <View style={{ marginTop: Spacing.two }}>
          <BotaoSecundario texto={t('Inscrever um carro')} onPress={() => router.push('/inscricao')} />
        </View>
      )}
    </>
  );
}

function Disponivel({ s }: { s: S }) {
  const cores = usePalette();
  const m = useModoMotorista();
  const { inscricoes } = useInscricoes();
  // Documentos do carro inscrito (os carros de exemplo da conta demo não têm).
  const inscricao = inscricoes.find((i) => i.id === m.viatura?.id);
  const documentos = inscricao ? estadoDocumentos(inscricao.validades) : [];
  const expirados = documentos.filter((d) => d.estado === 'expirado' || d.estado === 'em_falta');
  const aExpirar = documentos.filter((d) => d.estado === 'a_expirar');
  const bloqueado = expirados.length > 0;
  const nota = useAvaliacoes().mediaMotorista(m.eu.telefone);
  function terminarTurno() {
    const resumo = m.terminarTurno();
    if (resumo) router.push({ pathname: '/turno', params: { inicio: resumo.inicio } });
  }
  return (
    <>
      <View style={s.estado}>
        <View style={[s.pontoEstado, { backgroundColor: m.online ? (m.emPausa ? '#F59E0B' : cores.go) : cores.textSecondary }]} />
        <Text style={s.titulo}>{!m.online ? t('Estás offline') : m.emPausa ? t('Estás em pausa') : t('Estás online')}</Text>
      </View>
      <Text style={s.secundario}>
        {!m.online
          ? t('Fica online para receber pedidos.')
          : m.emPausa
            ? t('Não recebes pedidos para agora. As reservas continuam a chegar.')
            : t('À procura de pedidos para o teu carro…')}{' '}
        {nomeViatura(m.viatura!)} · {m.eu.nome}
      </Text>
      <ResumoTurnoAtual s={s} />
      {TEMPO_REAL_ATIVO && <EstadoServidor />}

      <Pressable onPress={() => router.push('/pedidos-motorista')} style={[s.caixa, s.linhaReserva]} accessibilityLabel={t('Pedidos e reservas')}>
        <View style={{ flex: 1 }}>
          <Text style={s.nomePequeno}>{t('Pedidos e reservas')}</Text>
          <Text style={s.secundarioPequeno}>
            {m.agendadas.length === 1 ? t('{n} reserva agendada', { n: m.agendadas.length }) : t('{n} reservas agendadas', { n: m.agendadas.length })}
            {m.agendadas[0]?.recolhaEm ? ` · ${t('próxima {dia}, {hora}', { dia: formatarDia(new Date(m.agendadas[0].recolhaEm), new Date()).toLowerCase(), hora: formatarHora(new Date(m.agendadas[0].recolhaEm)) })}` : ''}
          </Text>
        </View>
        {m.agendadas.length > 0 && (
          <View style={s.contador}>
            <Text style={s.contadorTexto}>{m.agendadas.length}</Text>
          </View>
        )}
        <Text style={s.seta}>›</Text>
      </Pressable>

      {inscricao && (
        <Pressable
          onPress={() => router.push({ pathname: '/documentos', params: { id: inscricao.id } })}
          style={[s.caixa, s.linhaReserva, (bloqueado || aExpirar.length > 0) && { borderWidth: 1.5, borderColor: bloqueado ? '#DC2626' : '#F59E0B' }]}
          accessibilityLabel={t('Documentos')}>
          <View style={{ flex: 1 }}>
            <Text style={s.nomePequeno}>{t('Documentos')}</Text>
            <Text style={s.secundarioPequeno}>
              {bloqueado
                ? expirados.some((d) => d.estado === 'em_falta')
                  ? t('{docs}: falta a validade. Atualiza para ficares online.', { docs: expirados.map((d) => t(d.nome)).join(', ') })
                  : t('{docs}: expirado. Atualiza para ficares online.', { docs: expirados.map((d) => t(d.nome)).join(', ') })
                : aExpirar.length > 0
                  ? aExpirar.map((d) => (d.dias === 1 ? t('{doc} expira em {n} dia', { doc: t(d.nome), n: d.dias }) : t('{doc} expira em {n} dias', { doc: t(d.nome), n: d.dias ?? 0 }))).join(' · ')
                  : t('Carta, seguro e inspeção em dia.')}
            </Text>
          </View>
          <Text style={s.seta}>›</Text>
        </Pressable>
      )}

      <Pressable onPress={() => router.push('/avaliacoes-motorista')} style={[s.caixa, s.linhaReserva]} accessibilityLabel={t('As tuas avaliações')}>
        <View style={{ flex: 1 }}>
          <Text style={s.nomePequeno}>{t('As tuas avaliações')}</Text>
          <Text style={s.secundarioPequeno}>
            {nota ? (nota.n === 1 ? t('★ {media} · {n} avaliação', { media: formatarNota(nota.media), n: nota.n }) : t('★ {media} · {n} avaliações', { media: formatarNota(nota.media), n: nota.n })) : t('Ainda sem avaliações')}
          </Text>
        </View>
        <Text style={s.seta}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/ganhos')} style={[s.caixa, s.linhaReserva]} accessibilityLabel={t('Ganhos')}>
        <View style={{ flex: 1 }}>
          <Text style={s.nomePequeno}>{t('Ganhos')}</Text>
          <Text style={s.secundarioPequeno}>{t('Por dia e por semana, e quando recebes.')}</Text>
        </View>
        <Text style={s.seta}>›</Text>
      </Pressable>

      <View style={s.linhaDefinicao}>
        <View style={{ flex: 1 }}>
          <Text style={s.nomePequeno}>{t('Simular a condução')}</Text>
          <Text style={s.secundarioPequeno}>{t('Para testes: o carro anda sozinho pela rota.')}</Text>
        </View>
        <Switch value={m.simular} onValueChange={m.setSimular} />
      </View>
      {!TEMPO_REAL_ATIVO && (
        <Text style={[s.secundarioPequeno, { marginBottom: Spacing.two }]}>
          {t('Modo de demonstração: sem servidor ligado, os pedidos são simulados.')}{m.online ? ' ' : ''}
          {m.online && (
            <Text style={s.ligacao} onPress={m.simularPedido}>
              {t('Simular um pedido')}
            </Text>
          )}
        </Text>
      )}

      <View style={{ gap: Spacing.two }}>
        {!m.online ? (
          <>
            <BotaoPrincipal
              texto={bloqueado ? t('Atualiza os documentos') : m.turno ? t('Continuar o turno') : t('Ficar online')}
              desativado={bloqueado}
              onPress={() => m.setOnline(true)}
            />
            {m.turno ? <BotaoSecundario texto={t('Terminar o turno')} onPress={terminarTurno} /> : <BotaoSecundario texto={t('Mudar de carro')} onPress={() => m.escolherViatura(null)} />}
          </>
        ) : m.emPausa ? (
          <>
            <BotaoPrincipal texto={t('Voltar ao trabalho')} onPress={m.retomar} />
            <BotaoSecundario texto={t('Terminar o turno')} onPress={terminarTurno} />
          </>
        ) : (
          <>
            <BotaoSecundario texto={t('Fazer uma pausa')} onPress={m.pausar} />
            <BotaoPrincipal texto={t('Terminar o turno')} escuro onPress={terminarTurno} />
          </>
        )}
      </View>
    </>
  );
}

/** Turno em curso: tempo a trabalhar, pausas e o que já fez. Depois de muitas horas, pede para descansar. */
function ResumoTurnoAtual({ s }: { s: S }) {
  const m = useModoMotorista();
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!m.turno) return null;
  const pausa = minutosPausa(m.turno, agora);
  const trabalho = Math.max(0, Math.round((agora - new Date(m.turno.inicio).getTime()) / 60000) - pausa);
  const cansado = trabalho >= HORAS_ATE_DESCANSO * 60;
  return (
    <View style={[s.caixa, cansado && { borderWidth: 1.5, borderColor: '#F59E0B' }]}>
      <Text style={s.secundarioPequeno}>
        {t('Turno: {tempo} a trabalhar', { tempo: duracaoTexto(trabalho) })}
        {pausa > 0 ? ` · ${t('{tempo} de pausa', { tempo: duracaoTexto(pausa) })}` : ''}
      </Text>
      {cansado && <Text style={[s.secundarioPequeno, { color: '#B45309', fontWeight: '700' }]}>{t('Já trabalhaste {n} horas. Faz uma pausa para descansar.', { n: HORAS_ATE_DESCANSO })}</Text>}
    </View>
  );
}

/** O que o cliente pediu além do percurso: outra pessoa no carro, o voo e as preferências. */
function ExtrasPedido({ pedido, ligar, s }: { pedido: PedidoMotorista; ligar?: boolean; s: S }) {
  const cores = usePalette();
  const prefs = textoPreferencias(pedido.preferencias);
  if (!pedido.passageiro && !pedido.voo && prefs.length === 0) return null;
  return (
    <View style={[s.caixa, { gap: Spacing.one }]}>
      {pedido.passageiro && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Text style={[s.secundarioPequeno, { flex: 1, color: cores.text }]}>
            {t('Vai {nome} · pedido por {cliente}', { nome: pedido.passageiro.nome, cliente: pedido.clienteNome ?? t('o cliente') })}
          </Text>
          {ligar && (
            <Text style={s.ligacao} onPress={() => Linking.openURL(`tel:${pedido.passageiro!.telefone}`)}>
              {t('Ligar')}
            </Text>
          )}
        </View>
      )}
      {pedido.voo && (
        <Text style={[s.secundarioPequeno, { color: cores.text }]}>
          {t('Voo {voo} · espera {min} min grátis depois de aterrar', { voo: pedido.voo, min: ESPERA_AEROPORTO_MIN })}{'  '}
          <Text style={s.ligacao} onPress={() => Linking.openURL(ligacaoVoo(pedido.voo!))}>
            {t('Ver voo')}
          </Text>
        </Text>
      )}
      {prefs.length > 0 && <Text style={s.secundarioPequeno}>{prefs.join(' · ')}</Text>}
    </View>
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
      <Text style={s.etiqueta}>{pedido.recolhaEm ? t('Reserva · {dia}, {hora}', { dia: formatarDia(new Date(pedido.recolhaEm), new Date()), hora: formatarHora(new Date(pedido.recolhaEm)) }) : t('Pedido para agora')}</Text>
      <Text style={s.valorGrande}>{formatarMzn(ganhoMotorista(pedido))}</Text>
      <Text style={s.secundario}>
        {t(pedido.pagaNoFim ? 'Recebes isto · {cliente} paga {preco} por {pagamento} no fim da viagem' : 'Recebes isto · {cliente} já pagou {preco} por {pagamento}', {
          cliente: pedido.clienteNome ?? t('o cliente'),
          preco: formatarMzn(pedido.precoMzn),
          pagamento: t(pedido.pagamento),
        })}
      </Text>
      <NotaPagamento paraMotorista />
      <ExtrasPedido pedido={pedido} s={s} />

      <View style={s.caixa}>
        <Linha ponto={<View style={s.pontoRecolha} />} titulo={nomeLugar(pedido.origem)} texto={t('{min} min · {km} de ti', { min: duracaoMin(kmRecolha), km: formatarKm(kmRecolha) })} s={s} />
        {pedido.paragens.map((p, i) => (
          <Linha key={i} ponto={<View style={s.pontoParagem} />} titulo={nomeLugar(p)} texto={t('Paragem {n}', { n: i + 1 })} s={s} />
        ))}
        <Linha ponto={<View style={s.pontoDestino} />} titulo={nomeLugar(pedido.destino)} texto={t('Viagem de {min} min · {km}', { min: pedido.minutos, km: formatarKm(pedido.km) })} s={s} />
      </View>

      <View style={{ gap: Spacing.two }}>
        <BotaoDeslizar texto={t('Desliza para aceitar · {s}s', { s: Math.ceil(resta / 1000) })} onConfirmar={m.aceitar} />
        <BotaoDeslizar texto={t('Desliza para recusar')} tipo="secundario" onConfirmar={m.recusar} />
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
  const [elogios, setElogios] = useState<string[]>([]);
  const avaliacoes = useAvaliacoes();
  const chat = useChat();
  useAcompanharChat(pedido.id, 'motorista');
  const naoLidas = chat.naoLidas(pedido.id, 'motorista');
  const abrirChat = () =>
    router.push({ pathname: '/chat', params: { id: pedido.id, como: 'motorista', nome: pedido.passageiro?.nome ?? pedido.clienteNome ?? t('Cliente'), detalhe: nomeLugar(pedido.origem) } });

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
          <Text style={s.titulo}>{t('Viagem concluída')}</Text>
        </View>
        <Text style={s.valorGrande}>{formatarMzn(ganhoMotorista(pedido))}</Text>
        <Text style={[s.secundario, { marginBottom: Spacing.three }]}>{t('Já está nos teus ganhos de hoje.')} {pedido.pagaNoFim ? t('O cliente paga agora pela app, por {pagamento}.', { pagamento: t(pedido.pagamento) }) : t('A viagem foi paga antes, por {pagamento}.', { pagamento: t(pedido.pagamento) })}</Text>
        <Text style={s.nomePequeno}>{t('Como correu com o cliente?')}</Text>
        <View style={s.estrelas}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setEstrelas(n)} accessibilityLabel={n === 1 ? t('{n} estrela', { n }) : t('{n} estrelas', { n })}>
              <Text style={[s.estrela, { color: n <= estrelas ? cores.accent : cores.backgroundSelected }]}>★</Text>
            </Pressable>
          ))}
        </View>
        {estrelas > 0 && (
          <View style={s.elogios}>
            {ELOGIOS_CLIENTE.map((e) => {
              const ativo = elogios.includes(e);
              return (
                <Pressable key={e} onPress={() => setElogios((l) => (ativo ? l.filter((x) => x !== e) : [...l, e]))} style={[s.elogio, ativo && { backgroundColor: cores.primary }]}>
                  <Text style={[s.secundarioPequeno, { color: ativo ? cores.onPrimary : cores.text, fontWeight: '700' }]}>{t(e)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <BotaoPrincipal
          texto={t('Continuar')}
          onPress={() => {
            // A nota fica no perfil do cliente, e a média aparece na conta dele.
            if (pedido.clienteTelefone) avaliacoes.avaliarCliente(pedido.clienteTelefone, { estrelas, elogios, em: new Date().toISOString(), motorista: m.eu.nome });
            m.fecharResumo();
          }}
          desativado={estrelas === 0}
        />
      </>
    );
  }

  return (
    <>
      <View style={s.estado}>
        <View style={[s.pontoEstado, { backgroundColor: cores.go }]} />
        <Text style={s.titulo}>{fase === 'a_recolha' ? t('A caminho da recolha') : fase === 'chegou' ? t('Pede o código ao cliente') : t('A caminho de {destino}', { destino: nomeLugar(pedido.destino) })}</Text>
      </View>

      {fase === 'chegou' && (
        <>
          <Text style={[s.secundario, { marginBottom: Spacing.two }]}>{t('O cliente tem um código de 4 números. A viagem só começa com o código certo.')}</Text>
          <TextInput
            value={codigo}
            onChangeText={(t) => tentarCodigo(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="0000"
            placeholderTextColor={cores.textSecondary}
            style={[s.codigo, erro && { borderColor: '#DC2626' }]}
            accessibilityLabel={t('Código de recolha')}
          />
          {erro && <Text style={s.erro}>{t('Código errado. Confirma com o cliente.')}</Text>}
          <Espera chegouEm={viagem.chegouEm} minutos={pedido.voo ? ESPERA_AEROPORTO_MIN : ESPERA_MIN} s={s} />
          {!TEMPO_REAL_ATIVO && <Text style={s.secundarioPequeno}>{t('Demonstração: o código do cliente é {codigo}.', { codigo: pedido.codigoRecolha })}</Text>}
        </>
      )}

      {/* Recolha e destino sempre à vista, com o ponto para onde vais agora em destaque. */}
      <PercursoViagem
        origem={pedido.origem}
        paragens={pedido.paragens}
        destino={pedido.destino}
        etapa={fase === 'em_viagem' ? 'destino' : 'recolha'}
        detalheRecolha={fase === 'a_recolha' ? `${duracaoMin(km)} min · ${formatarKm(km)}` : fase === 'chegou' ? t('Chegaste') : undefined}
        detalheDestino={fase === 'em_viagem' ? `${duracaoMin(km)} min · ${formatarKm(km)}` : formatarKm(pedido.km)}
      />
      {pedido.clienteNome && !pedido.passageiro ? <Text style={s.secundarioPequeno}>{t('Cliente: {nome}', { nome: pedido.clienteNome })}</Text> : null}
      <ExtrasPedido pedido={pedido} ligar={fase !== 'em_viagem'} s={s} />

      <Pressable onPress={abrirChat} style={[s.caixa, s.linhaReserva, { marginTop: Spacing.two }]} accessibilityLabel={t('Mensagem')}>
        <Text style={[s.nomePequeno, { flex: 1 }]}>{t('Mensagem ao cliente')}</Text>
        {naoLidas > 0 && (
          <View style={s.contador}>
            <Text style={s.contadorTexto}>{naoLidas}</Text>
          </View>
        )}
        <Text style={s.seta}>›</Text>
      </Pressable>

      <View style={[s.botoes, { marginTop: Spacing.three }]}>
        {fase !== 'chegou' && (
          <View style={{ flex: 1 }}>
            <BotaoSecundario texto={t('Navegar')} onPress={navegar} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          {fase === 'a_recolha' && <BotaoPrincipal texto={t('Cheguei')} onPress={m.cheguei} />}
          {fase === 'em_viagem' && <BotaoPrincipal texto={t('Terminar viagem')} onPress={m.terminar} />}
        </View>
      </View>
      {fase !== 'em_viagem' && (
        <Pressable onPress={() => m.cancelarViagem()} style={{ alignSelf: 'center', paddingTop: Spacing.three }} hitSlop={8}>
          <Text style={s.cancelar}>{t('Cancelar viagem')}</Text>
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
    elogios: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
    elogio: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: c.backgroundElement },
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
