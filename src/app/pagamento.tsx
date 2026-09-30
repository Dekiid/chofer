import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora, minutosOcupado, somarMin } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { criarPagamento, estadoPagamento, pagamentosReais } from '@/data/pagamentos';
import { calcularPreco } from '@/data/viagem';
import { useAgenda } from '@/state/agenda';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { Text, TextInput } from '@/components/texto';

type Estado = 'preencher' | 'a_processar' | 'pago' | 'agendada';

// Sem Supabase configurado, simula-se a confirmação da operadora.
const TEMPO_CONFIRMACAO = 2500;
// Pagamento real: pergunta o estado a cada 3 s, durante até 5 minutos.
const INTERVALO_ESTADO = 3000;
const TEMPO_MAXIMO_PIN = 5 * 60_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Pagamento() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const [telefone, setTelefone] = useState('');
  const agenda = useAgenda();
  const [estado, setEstado] = useState<Estado>('preencher');
  const [erro, setErro] = useState<string | null>(null);

  const { destino, viatura, quando } = pedido;
  // O mesmo km do resumo, para o valor pago ser o que o cliente viu.
  const km = pedido.rota?.km ?? 0;
  const duracao = pedido.rota?.minutos ?? 0;
  const imediato = quando?.tipo === 'imediato';
  const preco = calcularPreco(viatura, km, imediato);

  // Sai do ecrã a meio do pagamento: deixa de perguntar pelo estado.
  const saiu = useRef(false);
  useEffect(() => {
    saiu.current = false;
    return () => {
      saiu.current = true;
    };
  }, []);

  // Pago: o carro fica ocupado na agenda para não haver sobreposições, e só então se chama o motorista.
  function confirmarViagem() {
    if (!destino || !quando) return;
    const inicio = quando.tipo === 'agendado' ? quando.inicio : new Date();
    const ocupado = minutosOcupado(duracao, quando.tipo === 'imediato' ? viatura.chegadaMin : 0);
    agenda.reservar({ viaturaId: viatura.id, inicio, fim: somarMin(inicio, ocupado), tipo: quando.tipo === 'imediato' ? 'imediata' : 'agendada', destino: destino.nome });
    if (quando.tipo === 'imediato') {
      agenda.notificar('Pedido imediato', `${nomeViatura(viatura)} para ${destino.nome}, pago ${formatarMzn(preco)} com taxa de pedido imediato.`);
    }
    setEstado(quando.tipo === 'imediato' ? 'pago' : 'agendada');
  }

  async function pagar() {
    setErro(null);
    setEstado('a_processar');
    if (!pagamentosReais) {
      await esperar(TEMPO_CONFIRMACAO);
      if (!saiu.current) confirmarViagem();
      return;
    }
    try {
      const id = await criarPagamento({
        metodo: pedido.pagamento,
        telefone: telefone.replace(/\D/g, ''),
        valorMzn: preco,
        viaturaId: viatura.id,
        viagem: {
          recolha: pedido.origem.nome,
          destino: destino?.nome,
          km,
          quando: quando?.tipo === 'agendado' ? quando.inicio.toISOString() : 'imediato',
        },
      });
      // O cliente tem uns minutos para pôr o PIN; vamos perguntando ao servidor.
      const limite = Date.now() + TEMPO_MAXIMO_PIN;
      while (!saiu.current && Date.now() < limite) {
        await esperar(INTERVALO_ESTADO);
        const r = await estadoPagamento(id).catch(() => null);
        if (!r || r.estado === 'pendente') continue;
        if (r.estado === 'pago') return confirmarViagem();
        throw new Error(r.estado === 'expirado' ? 'O pedido expirou sem confirmação. Tenta outra vez.' : (r.erro ?? 'O pagamento não foi aceite.'));
      }
      throw new Error('Não recebemos a confirmação do pagamento. Tenta outra vez.');
    } catch (e) {
      if (saiu.current) return;
      setErro(e instanceof Error ? e.message : 'O pagamento não foi concluído.');
      setEstado('preencher');
    }
  }

  useEffect(() => {
    if (estado === 'pago') {
      const t = setTimeout(() => router.replace('/viagem'), 1200);
      return () => clearTimeout(t);
    }
  }, [estado]);

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
              Enviámos um pedido de {formatarMzn(preco)} por {metodo.nome} para o número {digitos}. Introduz o teu PIN para autorizar.
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
          <Text style={s.total}>{formatarMzn(preco)}</Text>
          <Text style={s.secundario}>
            {nomeViatura(viatura)} até {destino.nome}
          </Text>
          <Text style={s.secundario}>
            {quando.tipo === 'agendado'
              ? `Recolha ${formatarDia(quando.inicio, new Date()).toLowerCase()} às ${formatarHora(quando.inicio)}`
              : 'Pedido imediato, com taxa extra'}
          </Text>

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
          {erro && <Text style={s.erro}>{erro}</Text>}
          <BotaoPrincipal
            texto={`Pagar ${formatarMzn(preco)}`}
            onPress={() => {
              Keyboard.dismiss();
              pagar();
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
    titulo: { color: c.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    secundarioCentro: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
    visto: { fontSize: 56, fontWeight: '800' },
    erro: { color: '#D93025', fontSize: 15, textAlign: 'center', marginBottom: Spacing.two },
  });
}
