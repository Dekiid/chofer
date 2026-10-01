import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { NotaPagamento } from '@/components/nota-pagamento';
import type { Ponto } from '@/components/mapa-tipos';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora, minutosOcupado, somarMin } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { descontoDe, procurarPromo } from '@/data/promocoes';
import { fimReserva, textoDias, totalReserva } from '@/data/reserva';
import { gerarCodigoRecolha } from '@/data/seguranca';
import { avisarMotoristaPorPush } from '@/data/push';
import { publicar, TEMPO_REAL_ATIVO, type PedidoMotorista } from '@/data/tempo-real';
import { calcularPreco, taxaImediato } from '@/data/viagem';
import { useConta } from '@/state/conta';
import { useAgenda, type ResultadoReserva } from '@/state/agenda';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { useSessao } from '@/state/sessao';
import { Text, TextInput } from '@/components/texto';

type Estado = 'preencher' | 'a_processar' | 'pago' | 'agendada' | 'falhou' | 'pago_no_fim';

const ponto = (p: Ponto): Ponto => ({ latitude: p.latitude, longitude: p.longitude });

// Tempo simulado até a operadora confirmar; o pagamento real virá do servidor.
const TEMPO_CONFIRMACAO = 2500;

export default function Pagamento() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const [telefone, setTelefone] = useState('');
  const agenda = useAgenda();
  const [estado, setEstado] = useState<Estado>('preencher');
  const conta = useConta();
  const sessao = useSessao();
  const [codigoAberto, setCodigoAberto] = useState(false);
  const [codigoTexto, setCodigoTexto] = useState('');
  const [erroCodigo, setErroCodigo] = useState('');
  const [falha, setFalha] = useState('');
  const montado = useRef(true);

  const { destino, viatura, quando, reserva } = pedido;
  // Aluguer e casamento pagam-se à diária; o resto do pagamento é igual ao das viagens.
  const casamento = reserva?.modo === 'casamento';
  // «na tua localização» ou «em Polana», para as frases lerem bem.
  const noLocal = pedido.origem.id === 'atual' ? 'na tua localização' : `em ${pedido.origem.nome}`;
  const nomeReserva = casamento ? `casamento${reserva?.decoracao === 'com' ? ' com decoração' : ''}` : 'aluguer';
  // O mesmo km do resumo, para o valor pago ser o que o cliente viu.
  const km = pedido.rota?.km ?? 0;
  const duracao = pedido.rota?.minutos ?? 0;
  const imediato = quando?.tipo === 'imediato';
  // Pedido para agora: chega aqui no fim da viagem, com a viagem já feita (e a gorjeta escolhida).
  const { viagem: idNoFim } = useLocalSearchParams<{ viagem?: string }>();
  const noFim = idNoFim ? conta.viagens.find((v) => v.id === idNoFim) : undefined;
  const preco = noFim ? noFim.precoMzn : reserva ? totalReserva(viatura, reserva) : calcularPreco(viatura, km, imediato);
  // Códigos de convite só valem na primeira viagem.
  const primeiraViagem = !conta.viagens.some((v) => v.estado === 'concluida');
  const desconto = descontoDe(conta.promo, preco);
  // A gorjeta vai toda para o motorista e não leva desconto.
  const aPagar = preco - desconto + (noFim?.gorjetaMzn ?? 0);

  function aplicarCodigo() {
    const promo = procurarPromo(codigoTexto);
    if (!promo) return setErroCodigo('Este código não existe.');
    if (promo.codigo === conta.codigoConvite) return setErroCodigo('Não podes usar o teu próprio código de convite.');
    if (promo.codigo.startsWith('AMIGO-') && !primeiraViagem) return setErroCodigo('Os códigos de convite só valem na primeira viagem.');
    conta.setPromo(promo);
    setErroCodigo('');
    setCodigoAberto(false);
    Keyboard.dismiss();
  }

  // Primeiro guarda o horário na agenda do carro: o servidor recusa se outro cliente o apanhou entretanto.
  // Só depois vem a cobrança, que no protótipo é simulada.
  async function processar() {
    setEstado('a_processar');
    const nomeMetodo = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome ?? '';
    if (noFim) {
      if (!(await continuar({ ok: true }))) return;
      conta.atualizarViagem(noFim.id, { porPagar: false, descontoMzn: desconto, promo: conta.promo?.codigo, pagamento: pedido.pagamento });
      conta.setPromo(null);
      conta.avisar('Pagamento confirmado', `${formatarMzn(aPagar)} por ${nomeMetodo}. Obrigado por viajares com a Chauffeur.`);
      setEstado('pago_no_fim');
      return;
    }
    const idViagem = `v-${Date.now()}`;
    const codigoRecolha = gerarCodigoRecolha();
    const nomePagamento = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome ?? '';

    if (reserva?.inicio) {
      const inicio = reserva.inicio;
      const resultado = await agenda.reservar({
        id: idViagem,
        viaturaId: viatura.id,
        inicio,
        fim: fimReserva(inicio, reserva.dias),
        tipo: 'agendada',
        destino: `${casamento ? 'Casamento' : 'Aluguer'} · ${textoDias(reserva.dias)}`,
        pontoInicio: ponto(pedido.origem),
        pontoFim: ponto(pedido.origem),
      });
      if (!(await continuar(resultado))) return;
      conta.registarViagem({
        id: idViagem,
        tipo: reserva.modo,
        dias: reserva.dias,
        decoracao: casamento ? reserva.decoracao : undefined,
        recolhaEm: inicio,
        origem: pedido.origem,
        paragens: [],
        destino: pedido.origem,
        viatura: nomeViatura(viatura),
        motorista: viatura.motorista ?? MOTORISTA_EXEMPLO,
        km: 0,
        minutos: 0,
        precoMzn: preco,
        taxaImediatoMzn: 0,
        descontoMzn: desconto,
        promo: conta.promo?.codigo,
        gorjetaMzn: 0,
        pagamento: pedido.pagamento,
        codigoRecolha,
        estado: 'agendada',
      });
      conta.setPromo(null);
      conta.avisar('Reserva confirmada', `${nomeViatura(viatura)}, ${nomeReserva}, ${textoDias(reserva.dias)} a partir de ${formatarDia(inicio, new Date()).toLowerCase()} às ${formatarHora(inicio)}.`);
      agenda.notificar(casamento ? 'Reserva de casamento' : 'Novo aluguer', `${nomeViatura(viatura)} · ${textoDias(reserva.dias)} a partir de ${formatarDia(inicio, new Date())}, ${formatarHora(inicio)} · ${pedido.origem.nome} · pago ${formatarMzn(aPagar)}.`);
      setEstado('agendada');
      return;
    }

    if (!destino || !quando) return;
    const agendada = quando.tipo === 'agendado';
    const inicio = agendada ? quando.inicio : new Date();
    // O pedido que o motorista recebe. Nas reservas também fica guardado na agenda, para o motorista o ver mesmo que a app dele estivesse fechada.
    const paraMotorista: PedidoMotorista = {
      id: idViagem,
      viaturaId: viatura.id,
      viaturaNome: nomeViatura(viatura),
      origem: pedido.origem,
      paragens: pedido.paragens,
      destino,
      km,
      minutos: duracao,
      precoMzn: aPagar,
      recolhaEm: inicio.toISOString(),
      codigoRecolha,
      pagamento: nomePagamento,
      criadoEm: new Date().toISOString(),
      clienteNome: sessao.perfil?.nome,
    };
    // O carro fica ocupado desde a recolha (ou desde agora, nos pedidos imediatos) até ao fim da viagem.
    const resultado = await agenda.reservar({
      id: idViagem,
      viaturaId: viatura.id,
      inicio,
      fim: somarMin(inicio, minutosOcupado(duracao, agendada ? 0 : viatura.chegadaMin)),
      tipo: agendada ? 'agendada' : 'imediata',
      destino: destino.nome,
      pontoInicio: ponto(pedido.origem),
      pontoFim: ponto(destino),
      pedido: agendada ? paraMotorista : undefined,
    });
    if (!(await continuar(resultado))) return;
    // Fica no histórico do cliente, com o recibo.
    conta.registarViagem({
      id: idViagem,
      recolhaEm: inicio,
      origem: pedido.origem,
      paragens: pedido.paragens,
      destino,
      viatura: nomeViatura(viatura),
      motorista: viatura.motorista ?? MOTORISTA_EXEMPLO,
      km,
      minutos: duracao,
      precoMzn: preco,
      taxaImediatoMzn: agendada ? 0 : taxaImediato(viatura, km),
      descontoMzn: desconto,
      promo: conta.promo?.codigo,
      gorjetaMzn: 0,
      pagamento: pedido.pagamento,
      codigoRecolha,
      estado: agendada ? 'agendada' : 'em_curso',
    });
    // Viagem marcada: vai já para a agenda do motorista do carro, com um aviso.
    // Os pedidos para agora saem do ecrã da viagem.
    if (TEMPO_REAL_ATIVO && agendada) {
      publicar({ tipo: 'pedido', pedido: paraMotorista });
      avisarMotoristaPorPush(paraMotorista.viaturaId, 'Nova reserva', `${paraMotorista.origem.nome} → ${paraMotorista.destino.nome}. Já está paga e na tua agenda.`, { id: paraMotorista.id });
    }
    conta.setPromo(null);
    conta.avisar(
      'Pagamento confirmado',
      agendada
        ? `Viagem para ${destino.nome} marcada para ${formatarDia(inicio, new Date()).toLowerCase()} às ${formatarHora(inicio)}.`
        : `${formatarMzn(aPagar)} por ${nomePagamento}. A chamar o teu ${nomeViatura(viatura)}.`,
    );
    if (!agendada) {
      agenda.notificar('Pedido imediato', `${nomeViatura(viatura)} para ${destino.nome}, pago ${formatarMzn(aPagar)} com taxa de pedido imediato.`);
    }
    setEstado(agendada ? 'agendada' : 'pago');
  }

  /** Depois de guardar na agenda: se falhou, mostra porquê; se correu bem, espera pela confirmação do pagamento. */
  async function continuar(resultado: ResultadoReserva): Promise<boolean> {
    if (!montado.current) return false;
    if (!resultado.ok) {
      setFalha(
        resultado.motivo === 'ocupado'
          ? 'Outro cliente acabou de reservar este carro para uma hora que choca com a tua. Escolhe outra hora. Não foi cobrado nada.'
          : `Não foi possível guardar a reserva (${resultado.detalhe ?? 'sem ligação'}). Não foi cobrado nada.`,
      );
      setEstado('falhou');
      return false;
    }
    await new Promise((r) => setTimeout(r, TEMPO_CONFIRMACAO));
    return montado.current;
  }

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (estado === 'pago') {
      const t = setTimeout(() => router.replace('/viagem'), 1200);
      return () => clearTimeout(t);
    }
  }, [estado]);

  if (estado === 'agendada' && reserva?.inicio) {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Text style={[s.visto, { color: cores.accent }]}>✓</Text>
        <Text style={s.titulo}>Reserva confirmada</Text>
        <Text style={s.secundarioCentro}>
          {casamento
            ? `O ${nomeViatura(viatura)} ${reserva.decoracao === 'com' ? 'decorado ' : ''}e o motorista vão buscar os noivos ${noLocal} ${formatarDia(reserva.inicio, new Date()).toLowerCase()} às ${formatarHora(reserva.inicio)}, por ${textoDias(reserva.dias)}.`
            : `Entregamos o ${nomeViatura(viatura)} ${noLocal} ${formatarDia(reserva.inicio, new Date()).toLowerCase()} às ${formatarHora(reserva.inicio)}. Devolução ${formatarDia(fimReserva(reserva.inicio, reserva.dias), new Date()).toLowerCase()} à mesma hora.`}{' '}
          Os dias ficam reservados na agenda do carro.
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.three }}>
          <BotaoPrincipal
            texto="Voltar ao início"
            onPress={() => {
              pedido.limpar();
              router.dismissTo('/');
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'agendada' && quando?.tipo === 'agendado') {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Text style={[s.visto, { color: cores.accent }]}>✓</Text>
        <Text style={s.titulo}>Viagem agendada</Text>
        <Text style={s.secundarioCentro}>
          O {nomeViatura(viatura)} vai buscar-te {formatarDia(quando.inicio, new Date()).toLowerCase()} às {formatarHora(quando.inicio)} e leva-te até {destino?.nome}. O horário fica reservado na agenda do carro.
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.three }}>
          <BotaoPrincipal
            texto="Voltar ao início"
            onPress={() => {
              pedido.limpar();
              router.dismissTo('/');
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'falhou') {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Text style={s.titulo}>Esse horário já não está livre</Text>
        <Text style={s.secundarioCentro}>{falha}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.three }}>
          <BotaoPrincipal
            texto="Escolher outra hora"
            onPress={() => {
              if (reserva) pedido.setReserva({ ...reserva, inicio: null });
              else pedido.setQuando(null);
              router.back();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (estado === 'pago_no_fim' && noFim) {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Text style={[s.visto, { color: cores.accent }]}>✓</Text>
        <Text style={s.titulo}>Viagem paga</Text>
        <Text style={s.secundarioCentro}>Obrigado por viajares com a Chauffeur. O recibo fica nas tuas viagens.</Text>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.three, gap: Spacing.two }}>
          <BotaoPrincipal
            texto="Voltar ao início"
            onPress={() => {
              pedido.limpar();
              router.dismissTo('/');
            }}
          />
          <Text style={s.temCodigo} onPress={() => router.push({ pathname: '/recibo', params: { id: noFim.id } })}>
            Ver recibo
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!noFim && (reserva ? !reserva.inicio : !destino || !quando)) return <Redirect href="/" />;

  const metodo = PAGAMENTOS.find((p) => p.id === pedido.pagamento) ?? PAGAMENTOS[0];
  const digitos = telefone.replace(/\D/g, '');
  const telefoneValido = /^8[4-7]\d{7}$/.test(digitos);

  if (estado !== 'preencher') {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        {estado === 'a_processar' ? (
          <>
            <ActivityIndicator size="large" color={cores.text} />
            <Text style={s.titulo}>Confirma no teu telemóvel</Text>
            <Text style={s.secundarioCentro}>
              Enviámos um pedido de {formatarMzn(aPagar)} por {metodo.nome} para o número {digitos}. Introduz o teu PIN para autorizar.
            </Text>
          </>
        ) : (
          <>
            <Text style={[s.visto, { color: cores.accent }]}>✓</Text>
            <Text style={s.titulo}>Pagamento confirmado</Text>
            <Text style={s.secundarioCentro}>A chamar o teu {nomeViatura(viatura)}.</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecra}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.cabecalho}>
          <BotaoVoltar onPress={() => router.back()} />
          <Text style={s.tituloCabecalho}>Pagamento</Text>
        </View>

        {/* Tocar fora do campo esconde o teclado (o teclado numérico do iPhone não tem tecla para fechar). */}
        <FecharTeclado style={s.corpo}>
          <Text style={s.secundario}>Total a pagar</Text>
          <Text style={s.total}>{formatarMzn(aPagar)}</Text>
          {desconto > 0 && (
            <Text style={s.desconto}>
              <Text style={s.riscado}>{formatarMzn(preco)}</Text> · {formatarMzn(desconto)} de desconto ({conta.promo?.codigo}){'  '}
              <Text style={s.tirarCodigo} onPress={() => conta.setPromo(null)}>
                Tirar
              </Text>
            </Text>
          )}
          <Text style={s.secundario}>
            {noFim ? `${noFim.viatura} até ${noFim.destino.nome}` : reserva ? `${nomeViatura(viatura)} · ${nomeReserva}` : `${nomeViatura(viatura)} até ${destino?.nome}`}
          </Text>
          <Text style={s.secundario}>
            {noFim
              ? `Viagem concluída${noFim.gorjetaMzn > 0 ? `, com ${formatarMzn(noFim.gorjetaMzn)} de gorjeta para o motorista` : ''}`
              : reserva?.inicio
              ? `${textoDias(reserva.dias)} a partir de ${formatarDia(reserva.inicio, new Date()).toLowerCase()} às ${formatarHora(reserva.inicio)}`
              : quando?.tipo === 'agendado'
              ? `Recolha ${formatarDia(quando.inicio, new Date()).toLowerCase()} às ${formatarHora(quando.inicio)}`
              : 'Pedido imediato, com taxa extra'}
          </Text>

          {!conta.promo &&
            (codigoAberto ? (
              <View style={s.linhaCodigo}>
                <TextInput
                  value={codigoTexto}
                  onChangeText={(t) => {
                    setCodigoTexto(t.toUpperCase());
                    setErroCodigo('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  placeholder="Código promocional ou de convite"
                  placeholderTextColor={cores.textSecondary}
                  onSubmitEditing={aplicarCodigo}
                  style={[s.input, { flex: 1, fontSize: 15 }]}
                />
                <Pressable onPress={aplicarCodigo} style={s.aplicar}>
                  <Text style={s.aplicarTexto}>Aplicar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setCodigoAberto(true)} hitSlop={6} style={{ alignSelf: 'flex-start', marginTop: Spacing.three }}>
                <Text style={s.temCodigo}>Tens um código promocional?</Text>
              </Pressable>
            ))}
          {erroCodigo ? <Text style={s.erro}>{erroCodigo}</Text> : null}

          <Text style={s.rotulo}>Método de pagamento</Text>
          <View style={s.metodos}>
            {PAGAMENTOS.map((p) => {
              const ativo = p.id === pedido.pagamento;
              return (
                <Pressable key={p.id} onPress={() => pedido.setPagamento(p.id)} style={[s.metodo, ativo && s.metodoAtivo]}>
                  <Text style={[s.metodoTexto, ativo && s.metodoTextoAtivo]}>{p.nome}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.rotulo}>Número {metodo.nome}</Text>
        <TextInput
          value={telefone}
          onChangeText={(t) => {
            setTelefone(t);
            // Número completo: o teclado baixa sozinho para se ver o botão de pagar.
            if (/^8[4-7]\d{7}$/.test(t.replace(/\D/g, ''))) Keyboard.dismiss();
          }}
          keyboardType="phone-pad"
          placeholder={`Começa por ${metodo.prefixos}`}
          placeholderTextColor={cores.textSecondary}
          maxLength={12}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={s.input}
        />
        </FecharTeclado>

        <View style={s.rodape}>
          <NotaPagamento />
          <BotaoPrincipal
            texto={`Pagar ${formatarMzn(aPagar)}`}
            onPress={() => {
              Keyboard.dismiss();
              processar();
            }}
            desativado={!telefoneValido}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    centro: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    tituloCabecalho: { color: c.text, fontSize: 20, fontWeight: '700' },
    corpo: { flex: 1, padding: Spacing.three },
    total: { color: c.text, fontSize: 40, fontWeight: '800', marginVertical: Spacing.one },
    secundario: { color: c.textSecondary, fontSize: 15 },
    rotulo: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
    metodos: { flexDirection: 'row', gap: Spacing.two },
    metodo: { flex: 1, paddingVertical: Spacing.three, borderRadius: Radius.card, alignItems: 'center', backgroundColor: c.backgroundElement, borderWidth: 2, borderColor: 'transparent' },
    metodoAtivo: { borderColor: c.primary },
    metodoTexto: { color: c.text, fontSize: 16, fontWeight: '600' },
    metodoTextoAtivo: { fontWeight: '800' },
    input: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 18, fontWeight: '600' },
    rodape: { padding: Spacing.three },
    desconto: { color: c.textSecondary, fontSize: 14, marginBottom: Spacing.one },
    riscado: { textDecorationLine: 'line-through' },
    tirarCodigo: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
    temCodigo: { color: c.text, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
    linhaCodigo: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three, alignItems: 'center' },
    aplicar: { backgroundColor: c.primary, borderRadius: Radius.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
    aplicarTexto: { color: c.onPrimary, fontWeight: '700' },
    erro: { color: '#DC2626', fontSize: 13, marginTop: Spacing.one },
    titulo: { color: c.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    secundarioCentro: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
    visto: { fontSize: 56, fontWeight: '800' },
  });
}
