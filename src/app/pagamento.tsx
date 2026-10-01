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
import { idiomaAtual, t } from '@/i18n';
import { nomeLugar } from '@/data/lugares';

type Estado = 'preencher' | 'a_processar' | 'pago' | 'agendada' | 'falhou' | 'pago_no_fim';

const ponto = (p: Ponto): Ponto => ({ latitude: p.latitude, longitude: p.longitude });

// Tempo simulado até a operadora confirmar; o pagamento real virá do servidor.
const TEMPO_CONFIRMACAO = 2500;

/** O dia para o meio de uma frase: «hoje», «amanhã». Em inglês, só «today» e «tomorrow» ficam em minúsculas. */
function diaNaFrase(d: Date): string {
  const dia = formatarDia(d, new Date());
  return idiomaAtual() === 'en' && !/^(Today|Tomorrow)$/.test(dia) ? dia : dia.toLowerCase();
}

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
  const noLocal = pedido.origem.id === 'atual' ? t('na tua localização') : t('em {lugar}', { lugar: pedido.origem.nome });
  const nomeReserva = casamento ? (reserva?.decoracao === 'com' ? t('casamento com decoração') : t('casamento')) : t('aluguer');
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
    if (!promo) return setErroCodigo(t('Este código não existe.'));
    if (promo.codigo === conta.codigoConvite) return setErroCodigo(t('Não podes usar o teu próprio código de convite.'));
    if (promo.codigo.startsWith('AMIGO-') && !primeiraViagem) return setErroCodigo(t('Os códigos de convite só valem na primeira viagem.'));
    conta.setPromo(promo);
    setErroCodigo('');
    setCodigoAberto(false);
    Keyboard.dismiss();
  }

  // Primeiro guarda o horário na agenda do carro: o servidor recusa se outro cliente o apanhou entretanto.
  // Só depois vem a cobrança, que no protótipo é simulada.
  async function processar() {
    setEstado('a_processar');
    const nomeMetodo = t(PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome ?? '');
    if (noFim) {
      if (!(await continuar({ ok: true }))) return;
      conta.atualizarViagem(noFim.id, { porPagar: false, descontoMzn: desconto, promo: conta.promo?.codigo, pagamento: pedido.pagamento });
      conta.setPromo(null);
      conta.avisar(t('Pagamento confirmado'), t('{valor} por {pagamento}. Obrigado por viajares com a Chauffeur.', { valor: formatarMzn(aPagar), pagamento: nomeMetodo }));
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
        passageiro: pedido.passageiro ?? undefined,
        tipo: reserva.modo,
        dias: reserva.dias,
        decoracao: casamento ? reserva.decoracao : undefined,
        recolhaEm: inicio,
        origem: pedido.origem,
        paragens: [],
        destino: pedido.origem,
        viatura: nomeViatura(viatura),
        viaturaId: viatura.id,
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
      conta.avisar(
        t('Reserva confirmada'),
        t('{viatura}, {reserva}, {dias} a partir de {dia} às {hora}.', { viatura: nomeViatura(viatura), reserva: nomeReserva, dias: textoDias(reserva.dias), dia: diaNaFrase(inicio), hora: formatarHora(inicio) }),
      );
      agenda.notificar(
        casamento ? t('Reserva de casamento') : t('Novo aluguer'),
        t('{viatura} · {dias} a partir de {dia}, {hora} · {lugar} · pago {valor}.', { viatura: nomeViatura(viatura), dias: textoDias(reserva.dias), dia: formatarDia(inicio, new Date()), hora: formatarHora(inicio), lugar: nomeLugar(pedido.origem), valor: formatarMzn(aPagar) }),
      );
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
      clienteTelefone: sessao.perfil?.telefone,
      passageiro: pedido.passageiro ?? undefined,
      preferencias: conta.preferencias,
      voo: pedido.voo ?? undefined,
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
      passageiro: pedido.passageiro ?? undefined,
      preferencias: conta.preferencias,
      voo: pedido.voo ?? undefined,
      recolhaEm: inicio,
      origem: pedido.origem,
      paragens: pedido.paragens,
      destino,
      viatura: nomeViatura(viatura),
      viaturaId: viatura.id,
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
      t('Pagamento confirmado'),
      agendada
        ? t('Viagem para {destino} marcada para {dia} às {hora}.', { destino: destino.nome, dia: diaNaFrase(inicio), hora: formatarHora(inicio) })
        : t('{valor} por {pagamento}. A chamar o teu {viatura}.', { valor: formatarMzn(aPagar), pagamento: t(nomePagamento), viatura: nomeViatura(viatura) }),
    );
    if (!agendada) {
      agenda.notificar(t('Pedido imediato'), t('{viatura} para {destino}, pago {valor} com taxa de pedido imediato.', { viatura: nomeViatura(viatura), destino: destino.nome, valor: formatarMzn(aPagar) }));
    }
    setEstado(agendada ? 'agendada' : 'pago');
  }

  /** Depois de guardar na agenda: se falhou, mostra porquê; se correu bem, espera pela confirmação do pagamento. */
  async function continuar(resultado: ResultadoReserva): Promise<boolean> {
    if (!montado.current) return false;
    if (!resultado.ok) {
      setFalha(
        resultado.motivo === 'ocupado'
          ? t('Outro cliente acabou de reservar este carro para uma hora que choca com a tua. Escolhe outra hora. Não foi cobrado nada.')
          : t('Não foi possível guardar a reserva ({detalhe}). Não foi cobrado nada.', { detalhe: resultado.detalhe ?? t('sem ligação') }),
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
        <Text style={s.titulo}>{t('Reserva confirmada')}</Text>
        <Text style={s.secundarioCentro}>
          {casamento
            ? reserva.decoracao === 'com'
              ? t('O {viatura} decorado e o motorista vão buscar os noivos {local} {dia} às {hora}, por {dias}.', { viatura: nomeViatura(viatura), local: noLocal, dia: diaNaFrase(reserva.inicio), hora: formatarHora(reserva.inicio), dias: textoDias(reserva.dias) })
              : t('O {viatura} e o motorista vão buscar os noivos {local} {dia} às {hora}, por {dias}.', { viatura: nomeViatura(viatura), local: noLocal, dia: diaNaFrase(reserva.inicio), hora: formatarHora(reserva.inicio), dias: textoDias(reserva.dias) })
            : t('Entregamos o {viatura} {local} {dia} às {hora}. Devolução {devolucao} à mesma hora.', {
                viatura: nomeViatura(viatura),
                local: noLocal,
                dia: diaNaFrase(reserva.inicio),
                hora: formatarHora(reserva.inicio),
                devolucao: diaNaFrase(fimReserva(reserva.inicio, reserva.dias)),
              })}{' '}
          {t('Os dias ficam reservados na agenda do carro.')}
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
        <Text style={s.titulo}>{t('Viagem agendada')}</Text>
        <Text style={s.secundarioCentro}>
          {t('O {viatura} vai buscar-te {dia} às {hora} e leva-te até {destino}. O horário fica reservado na agenda do carro.', {
            viatura: nomeViatura(viatura),
            dia: diaNaFrase(quando.inicio),
            hora: formatarHora(quando.inicio),
            destino: destino?.nome ?? '',
          })}
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
        <Text style={s.titulo}>{t('Esse horário já não está livre')}</Text>
        <Text style={s.secundarioCentro}>{falha}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.three }}>
          <BotaoPrincipal
            texto={t('Escolher outra hora')}
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
        <Text style={s.titulo}>{t('Viagem paga')}</Text>
        <Text style={s.secundarioCentro}>{t('Obrigado por viajares com a Chauffeur. O recibo fica nas tuas viagens.')}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: Spacing.three, gap: Spacing.two }}>
          <BotaoPrincipal
            texto="Voltar ao início"
            onPress={() => {
              pedido.limpar();
              router.dismissTo('/');
            }}
          />
          <Text style={s.temCodigo} onPress={() => router.push({ pathname: '/recibo', params: { id: noFim.id } })}>
            {t('Ver recibo')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!noFim && (reserva ? !reserva.inicio : !destino || !quando)) return <Redirect href="/" />;

  const metodo = PAGAMENTOS.find((p) => p.id === pedido.pagamento) ?? PAGAMENTOS[0];
  const digitos = telefone.replace(/\D/g, '');
  // Com a fatura da empresa não há número de telefone para cobrar.
  const naFatura = metodo.id === 'empresa' && conta.empresa != null;
  const telefoneValido = naFatura || /^8[4-7]\d{7}$/.test(digitos);

  if (estado !== 'preencher') {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        {estado === 'a_processar' ? (
          <>
            <ActivityIndicator size="large" color={cores.text} />
            <Text style={s.titulo}>{naFatura ? t('A juntar à fatura') : t('Confirma no teu telemóvel')}</Text>
            <Text style={s.secundarioCentro}>
              {naFatura
                ? t('{valor} vão para a fatura de {empresa} deste mês.', { valor: formatarMzn(aPagar), empresa: conta.empresa?.nome ?? '' })
                : t('Enviámos um pedido de {valor} por {pagamento} para o número {numero}. Introduz o teu PIN para autorizar.', { valor: formatarMzn(aPagar), pagamento: t(metodo.nome), numero: digitos })}
            </Text>
          </>
        ) : (
          <>
            <Text style={[s.visto, { color: cores.accent }]}>✓</Text>
            <Text style={s.titulo}>{t('Pagamento confirmado')}</Text>
            <Text style={s.secundarioCentro}>{t('A chamar o teu {viatura}.', { viatura: nomeViatura(viatura) })}</Text>
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
          <Text style={s.tituloCabecalho}>{t('Pagamento')}</Text>
        </View>

        {/* Tocar fora do campo esconde o teclado (o teclado numérico do iPhone não tem tecla para fechar). */}
        <FecharTeclado style={s.corpo}>
          <Text style={s.secundario}>{t('Total a pagar')}</Text>
          <Text style={s.total}>{formatarMzn(aPagar)}</Text>
          {desconto > 0 && (
            <Text style={s.desconto}>
              <Text style={s.riscado}>{formatarMzn(preco)}</Text> · {t('{valor} de desconto ({codigo})', { valor: formatarMzn(desconto), codigo: conta.promo?.codigo ?? '' })}{'  '}
              <Text style={s.tirarCodigo} onPress={() => conta.setPromo(null)}>
                {t('Tirar')}
              </Text>
            </Text>
          )}
          <Text style={s.secundario}>
            {noFim
              ? t('{viatura} até {destino}', { viatura: noFim.viatura, destino: noFim.destino.nome })
              : reserva
              ? `${nomeViatura(viatura)} · ${nomeReserva}`
              : t('{viatura} até {destino}', { viatura: nomeViatura(viatura), destino: destino?.nome ?? '' })}
          </Text>
          <Text style={s.secundario}>
            {noFim
              ? noFim.gorjetaMzn > 0
                ? t('Viagem concluída, com {valor} de gorjeta para o motorista', { valor: formatarMzn(noFim.gorjetaMzn) })
                : t('Viagem concluída')
              : reserva?.inicio
              ? t('{dias} a partir de {dia} às {hora}', { dias: textoDias(reserva.dias), dia: diaNaFrase(reserva.inicio), hora: formatarHora(reserva.inicio) })
              : quando?.tipo === 'agendado'
              ? t('Recolha {dia} às {hora}', { dia: diaNaFrase(quando.inicio), hora: formatarHora(quando.inicio) })
              : t('Pedido imediato, com taxa extra')}
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
                  placeholder={t('Código promocional ou de convite')}
                  placeholderTextColor={cores.textSecondary}
                  onSubmitEditing={aplicarCodigo}
                  style={[s.input, { flex: 1, fontSize: 15 }]}
                />
                <Pressable onPress={aplicarCodigo} style={s.aplicar}>
                  <Text style={s.aplicarTexto}>{t('Aplicar')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setCodigoAberto(true)} hitSlop={6} style={{ alignSelf: 'flex-start', marginTop: Spacing.three }}>
                <Text style={s.temCodigo}>{t('Tens um código promocional?')}</Text>
              </Pressable>
            ))}
          {erroCodigo ? <Text style={s.erro}>{erroCodigo}</Text> : null}

          <Text style={s.rotulo}>{t('Método de pagamento')}</Text>
          <View style={s.metodos}>
            {PAGAMENTOS.filter((p) => p.id !== 'empresa' || conta.empresa).map((p) => {
              const ativo = p.id === pedido.pagamento;
              return (
                <Pressable key={p.id} onPress={() => pedido.setPagamento(p.id)} style={[s.metodo, ativo && s.metodoAtivo]}>
                  <Text style={[s.metodoTexto, ativo && s.metodoTextoAtivo]}>{t(p.nome)}</Text>
              </Pressable>
            );
          })}
        </View>

        {naFatura ? (
          <Text style={[s.secundario, { marginTop: Spacing.three }]}>
            {t('Vai para a fatura mensal de {empresa} (NUIT {nuit}).', { empresa: conta.empresa?.nome ?? '', nuit: conta.empresa?.nuit ?? '' })}
          </Text>
        ) : (
        <>
        <Text style={s.rotulo}>{t('Número {pagamento}', { pagamento: t(metodo.nome) })}</Text>
        <TextInput
          value={telefone}
          onChangeText={(t) => {
            setTelefone(t);
            // Número completo: o teclado baixa sozinho para se ver o botão de pagar.
            if (/^8[4-7]\d{7}$/.test(t.replace(/\D/g, ''))) Keyboard.dismiss();
          }}
          keyboardType="phone-pad"
          placeholder={t('Começa por {prefixos}', { prefixos: metodo.prefixos.replace(' ou ', ` ${t('ou')} `) })}
          placeholderTextColor={cores.textSecondary}
          maxLength={12}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={s.input}
        />
        </>
        )}
        </FecharTeclado>

        <View style={s.rodape}>
          <NotaPagamento />
          <BotaoPrincipal
            texto={naFatura ? t('Pôr na fatura · {valor}', { valor: formatarMzn(aPagar) }) : t('Pagar {valor}', { valor: formatarMzn(aPagar) })}
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
