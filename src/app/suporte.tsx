import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { formatarTelefone } from '@/data/motorista';
import { useConta } from '@/state/conta';
import { useSessao } from '@/state/sessao';
import { TIPOS_AJUDA, useSuporte, type PedidoAjuda } from '@/state/suporte';

/** Pedidos de ajuda, queixas e objetos perdidos, para a equipa responder e reembolsar. */
export default function Suporte() {
  const cores = usePalette();
  const s = estilos(cores);
  const { pedidos } = useSuporte();
  const abertos = pedidos.filter((p) => p.estado === 'aberto');
  const resolvidos = pedidos.filter((p) => p.estado === 'resolvido');

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>Ajuda e queixas</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={s.secao}>Por responder ({abertos.length})</Text>
          {abertos.length === 0 && <Text style={s.secundario}>Nada por responder. Os pedidos chegam de Conta → Ajuda.</Text>}
          {abertos.map((p) => (
            <Aberto key={p.id} pedido={p} />
          ))}
          {resolvidos.length > 0 && <Text style={s.secao}>Respondidos</Text>}
          {resolvidos.map((p) => (
            <View key={p.id} style={s.cartao}>
              <Cabeca pedido={p} />
              <Text style={[s.texto, s.resposta]}>{p.resposta}</Text>
              {(p.reembolsoMzn ?? 0) > 0 && <Text style={[s.texto, { fontWeight: '700' }]}>Reembolso: {formatarMzn(p.reembolsoMzn!)}</Text>}
            </View>
          ))}
        </ScrollView>
      </FecharTeclado>
    </SafeAreaView>
  );
}

function Cabeca({ pedido: p }: { pedido: PedidoAjuda }) {
  const s = estilos(usePalette());
  return (
    <>
      <View style={s.linha}>
        <Text style={s.nome}>{TIPOS_AJUDA.find((t) => t.id === p.tipo)?.nome}</Text>
        <Text style={s.secundario}>
          {formatarDia(p.criadoEm, new Date())}, {formatarHora(p.criadoEm)}
        </Text>
      </View>
      <Text style={s.secundario}>
        {p.clienteNome} ·{' '}
        <Text style={s.ligacao} onPress={() => Linking.openURL(`tel:${p.clienteTelefone}`)}>
          {formatarTelefone(p.clienteTelefone)}
        </Text>
      </Text>
      {p.viagemResumo && <Text style={s.secundario}>{p.viagemResumo}</Text>}
      <Text style={s.texto}>{p.texto}</Text>
    </>
  );
}

function Aberto({ pedido: p }: { pedido: PedidoAjuda }) {
  const s = estilos(usePalette());
  const cores = usePalette();
  const { responder } = useSuporte();
  const { perfil } = useSessao();
  const conta = useConta();
  const [resposta, setResposta] = useState('');
  const [reembolso, setReembolso] = useState('');
  const valor = Number(reembolso.replace(',', '.')) || 0;

  function enviar() {
    responder(p.id, resposta.trim(), valor > 0 ? valor : undefined);
    // Em testes, o cliente costuma ser este mesmo telemóvel: o aviso aparece logo.
    if (perfil?.telefone === p.clienteTelefone) conta.avisar('Resposta da Chauffeur', valor > 0 ? `${resposta.trim()} Devolvemos ${formatarMzn(valor)}.` : resposta.trim());
  }

  return (
    <View style={s.cartao}>
      <Cabeca pedido={p} />
      <TextInput value={resposta} onChangeText={setResposta} multiline placeholder="Resposta ao cliente" placeholderTextColor={cores.textSecondary} style={s.campo} />
      <TextInput
        value={reembolso}
        onChangeText={(t) => setReembolso(t.replace(/[^\d,.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="Reembolso em MT (opcional)"
        placeholderTextColor={cores.textSecondary}
        style={[s.campo, { minHeight: 0 }]}
      />
      <BotaoPrincipal texto={valor > 0 ? `Responder e devolver ${formatarMzn(valor)}` : 'Responder'} desativado={resposta.trim().length < 3} onPress={enviar} />
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
    secao: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: Spacing.two },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one + 2 },
    linha: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
    nome: { color: c.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    texto: { color: c.text, fontSize: 14 },
    resposta: { borderLeftWidth: 3, borderLeftColor: c.go, paddingLeft: Spacing.two },
    secundario: { color: c.textSecondary, fontSize: 13 },
    ligacao: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
    campo: { backgroundColor: c.background, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  });
}
