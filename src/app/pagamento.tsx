import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { calcularPreco, distanciaKm } from '@/data/viagem';
import { PAGAMENTOS, usePedido } from '@/state/pedido';

type Estado = 'preencher' | 'a_processar' | 'pago';

// Tempo simulado até a operadora confirmar; o pagamento real virá do servidor.
const TEMPO_CONFIRMACAO = 2500;

export default function Pagamento() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const [telefone, setTelefone] = useState('');
  const [estado, setEstado] = useState<Estado>('preencher');

  useEffect(() => {
    if (estado === 'a_processar') {
      const t = setTimeout(() => setEstado('pago'), TEMPO_CONFIRMACAO);
      return () => clearTimeout(t);
    }
    if (estado === 'pago') {
      const t = setTimeout(() => router.replace('/viagem'), 1200);
      return () => clearTimeout(t);
    }
  }, [estado]);

  if (!pedido.destino) return <Redirect href="/" />;

  const preco = calcularPreco(pedido.viatura, distanciaKm(pedido.origem, pedido.destino));
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
            <Text style={s.secundarioCentro}>A chamar o teu {nomeViatura(pedido.viatura)}.</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.ecra}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.tituloCabecalho}>Pagamento</Text>
      </View>

      <View style={s.corpo}>
        <Text style={s.secundario}>Total a pagar</Text>
        <Text style={s.total}>{formatarMzn(preco)}</Text>
        <Text style={s.secundario}>
          {nomeViatura(pedido.viatura)} até {pedido.destino.nome}
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
          onChangeText={setTelefone}
          keyboardType="phone-pad"
          placeholder={`Começa por ${metodo.prefixos}`}
          placeholderTextColor={cores.textSecondary}
          maxLength={12}
          style={s.input}
        />
      </View>

      <View style={s.rodape}>
        <BotaoPrincipal texto={`Pagar ${formatarMzn(preco)}`} onPress={() => setEstado('a_processar')} desativado={!telefoneValido} />
      </View>
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
  });
}
