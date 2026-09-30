import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora, minutosOcupado, somarMin } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { descontoDe, procurarPromo } from '@/data/promocoes';
import { gerarCodigoRecolha } from '@/data/seguranca';
import { calcularPreco, taxaImediato } from '@/data/viagem';
import { useConta } from '@/state/conta';
import { useAgenda } from '@/state/agenda';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';

type Estado = 'preencher' | 'a_processar' | 'pago' | 'agendada';

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
  const [codigoAberto, setCodigoAberto] = useState(false);
  const [codigoTexto, setCodigoTexto] = useState('');
  const [erroCodigo, setErroCodigo] = useState('');

  const { destino, viatura, quando } = pedido;
  // O mesmo km do resumo, para o valor pago ser o que o cliente viu.
  const km = pedido.rota?.km ?? 0;
  const duracao = pedido.rota?.minutos ?? 0;
  const imediato = quando?.tipo === 'imediato';
  const preco = calcularPreco(viatura, km, imediato);
  // Códigos de convite só valem na primeira viagem.
  const primeiraViagem = !conta.viagens.some((v) => v.estado === 'concluida');
  const desconto = descontoDe(conta.promo, preco);
  const aPagar = preco - desconto;

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

  useEffect(() => {
    if (estado === 'a_processar') {
      const t = setTimeout(() => {
        if (!destino || !quando) return;
        // Pago: o carro fica ocupado na agenda para não haver sobreposições.
        const inicio = quando.tipo === 'agendado' ? quando.inicio : new Date();
        const ocupado = minutosOcupado(duracao, quando.tipo === 'imediato' ? viatura.chegadaMin : 0);
        agenda.reservar({ viaturaId: viatura.id, inicio, fim: somarMin(inicio, ocupado), tipo: quando.tipo === 'imediato' ? 'imediata' : 'agendada', destino: destino.nome });
        // Fica no histórico do cliente, com o recibo.
        conta.registarViagem({
          recolhaEm: inicio,
          origem: pedido.origem,
          paragens: pedido.paragens,
          destino,
          viatura: nomeViatura(viatura),
          motorista: viatura.motorista ?? MOTORISTA_EXEMPLO,
          km,
          minutos: duracao,
          precoMzn: preco,
          taxaImediatoMzn: quando.tipo === 'imediato' ? taxaImediato(viatura, km) : 0,
          descontoMzn: desconto,
          promo: conta.promo?.codigo,
          gorjetaMzn: 0,
          pagamento: pedido.pagamento,
          codigoRecolha: gerarCodigoRecolha(),
          estado: quando.tipo === 'imediato' ? 'em_curso' : 'agendada',
        });
        conta.setPromo(null);
        conta.avisar(
          'Pagamento confirmado',
          quando.tipo === 'imediato'
            ? `${formatarMzn(aPagar)} por ${PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome}. A chamar o teu ${nomeViatura(viatura)}.`
            : `Viagem para ${destino.nome} marcada para ${formatarDia(inicio, new Date()).toLowerCase()} às ${formatarHora(inicio)}.`,
        );
        if (quando.tipo === 'imediato') {
          agenda.notificar('Pedido imediato', `${nomeViatura(viatura)} para ${destino.nome}, pago ${formatarMzn(aPagar)} com taxa de pedido imediato.`);
        }
        setEstado(quando.tipo === 'imediato' ? 'pago' : 'agendada');
      }, TEMPO_CONFIRMACAO);
      return () => clearTimeout(t);
    }
    if (estado === 'pago') {
      const t = setTimeout(() => router.replace('/viagem'), 1200);
      return () => clearTimeout(t);
    }
  }, [estado, agenda, destino, quando, viatura, duracao, preco, aPagar, desconto, km, conta, pedido.origem, pedido.paragens, pedido.pagamento]);

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

  if (!destino || !quando) return <Redirect href="/" />;

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
        <Pressable style={s.corpo} onPress={Keyboard.dismiss} accessible={false}>
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
            {nomeViatura(viatura)} até {destino.nome}
          </Text>
          <Text style={s.secundario}>
            {quando.tipo === 'agendado'
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
        </Pressable>

        <View style={s.rodape}>
          <BotaoPrincipal
            texto={`Pagar ${formatarMzn(aPagar)}`}
            onPress={() => {
              Keyboard.dismiss();
              setEstado('a_processar');
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
