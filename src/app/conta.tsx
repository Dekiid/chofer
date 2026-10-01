import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { pedirAutorizacao } from '@/data/avisos-telemovel';
import { formatarMzn } from '@/data/categorias';
import { CREDITO_CONVITE_MZN, DESCONTO_CONVIDADO, PROMOS } from '@/data/promocoes';
import { formatarNumero } from '@/data/telefone';
import { LOCAIS, useConta } from '@/state/conta';
import { useMotoristaAprovado } from '@/state/permissoes';
import { MOTORISTA_ABERTO_EM_TESTES, useSessao } from '@/state/sessao';
import { Text } from '@/components/texto';

/** A conta do cliente: viagens, locais guardados, convites, promoções e avisos. */
export default function Conta() {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const sessao = useSessao();
  const motorista = useMotoristaAprovado();
  const { marcarAvisosLidos } = conta;
  const agora = new Date();
  const [apagar, setApagar] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);
  const feitas = conta.viagens.filter((v) => v.estado === 'concluida').length;

  // Ao sair, os avisos vistos deixam de contar como novos.
  useEffect(() => marcarAvisosLidos, [marcarAvisosLidos]);

  async function convidar() {
    try {
      await Share.share({
        message: `Experimenta a Chauffeur, carros premium com motorista em Maputo e Matola. Usa o meu código ${conta.codigoConvite} e ganhas ${formatarMzn(DESCONTO_CONVIDADO.valorMzn ?? 0)} na primeira viagem.`,
      });
    } catch {}
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>A tua conta</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.perfil}>
          <View style={s.avatar}>
            <Text style={s.avatarTexto}>{(sessao.perfil?.nome ?? 'C').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.nome}>{sessao.perfil?.nome ? `${sessao.perfil.nome} ${sessao.perfil.apelido ?? ''}`.trim() : 'Cliente Chauffeur'}</Text>
            {sessao.perfil?.telefone ? <Text style={s.secundario}>+258 {formatarNumero(sessao.perfil.telefone)}</Text> : null}
            <Text style={s.secundario}>
              ★ {conta.avaliacaoCliente.toFixed(1).replace('.', ',')} dada pelos motoristas · {feitas} {feitas === 1 ? 'viagem' : 'viagens'}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/viagens')} style={s.entrada}>
          <Text style={s.nome}>As tuas viagens</Text>
          <Text style={s.secundario}>Histórico, viagens marcadas e recibos</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/ajuda')} style={s.entrada}>
          <Text style={s.nome}>Ajuda</Text>
          <Text style={s.secundario}>Objetos perdidos, cobranças, queixas e perguntas frequentes</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/empresa')} style={s.entrada}>
          <Text style={s.nome}>Conta de empresa</Text>
          <Text style={s.secundario}>{conta.empresa ? `${conta.empresa.nome} · fatura mensal` : 'Viagens de trabalho numa fatura por mês'}</Text>
        </Pressable>

        {/* O modo motorista é só para motoristas aprovados; os outros veem como se inscrever. */}
        {motorista.pode ? (
          <Pressable onPress={() => router.push('/motorista')} style={s.entrada}>
            <Text style={s.nome}>Modo motorista</Text>
            <Text style={s.secundario}>
              {sessao.perfil?.motoristaDemo ? 'Conta de demonstração · ' : MOTORISTA_ABERTO_EM_TESTES ? 'Aberto a todos em testes · ' : ''}Fica online, recebe pedidos e conduz com a Chauffeur
            </Text>
          </Pressable>
        ) : motorista.inscricao === 'pendente' ? (
          <View style={s.entrada}>
            <Text style={s.nome}>Inscrição de motorista em análise</Text>
            <Text style={s.secundario}>O modo motorista abre quando a tua inscrição for aprovada.</Text>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/inscricao')} style={s.entrada}>
            <Text style={s.nome}>Conduzir com a Chauffeur</Text>
            <Text style={s.secundario}>
              {motorista.inscricao === 'rejeitada' ? 'A tua inscrição não foi aprovada. Podes enviar outra.' : 'Inscreve o teu carro. Depois de aprovado, abres aqui o modo motorista.'}
            </Text>
          </Pressable>
        )}

        <Text style={s.secao}>Locais guardados</Text>
        <View style={s.caixa}>
          {LOCAIS.map(({ tipo, nome }, i) => {
            const l = conta.locais[tipo];
            return (
              <Pressable key={tipo} onPress={() => router.push({ pathname: '/destino', params: { guardar: tipo } })} style={[s.linha, i > 0 && s.separador]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nomePequeno}>{nome}</Text>
                  <Text style={s.secundario} numberOfLines={1}>
                    {l ? l.zona : 'Por guardar'}
                  </Text>
                </View>
                <Text style={s.ligacao}>{l ? 'Mudar' : 'Guardar'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.secao}>Convida amigos</Text>
        <View style={s.caixa}>
          <Text style={s.texto}>
            O teu amigo ganha {formatarMzn(DESCONTO_CONVIDADO.valorMzn ?? 0)} na primeira viagem. Tu ganhas {formatarMzn(CREDITO_CONVITE_MZN)} de crédito quando ele viajar.
          </Text>
          <View style={[s.linha, { marginTop: Spacing.two }]}>
            <Text style={s.codigo}>{conta.codigoConvite}</Text>
            <Pressable onPress={convidar} style={s.botaoPequeno}>
              <Text style={s.botaoPequenoTexto}>Partilhar</Text>
            </Pressable>
          </View>
          <Text style={s.secundario}>
            {conta.amigosConvidados} amigos convidados · crédito {formatarMzn(conta.creditoMzn)}
          </Text>
        </View>

        <Text style={s.secao}>Promoções</Text>
        <View style={s.caixa}>
          {PROMOS.map((p, i) => (
            <View key={p.codigo} style={[s.linha, i > 0 && s.separador]}>
              <View style={{ flex: 1 }}>
                <Text style={s.nomePequeno}>{p.codigo}</Text>
                <Text style={s.secundario}>{p.descricao}</Text>
              </View>
            </View>
          ))}
          <Text style={[s.secundario, { marginTop: Spacing.two }]}>Escreve o código no pagamento, em «Tens um código promocional?».</Text>
        </View>

        <Text style={s.secao}>Notificações</Text>
        <View style={s.caixa}>
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={s.nomePequeno}>Avisos no telemóvel</Text>
              <Text style={s.secundario}>Motorista a caminho, chegada, pagamento</Text>
            </View>
            <Switch
              value={conta.avisosNoTelemovel}
              onValueChange={(v) => {
                conta.setAvisosNoTelemovel(v);
                if (v) pedirAutorizacao();
              }}
              trackColor={{ true: cores.go }}
            />
          </View>
        </View>
        {conta.avisos.length === 0 && <Text style={s.secundario}>Ainda não há avisos. Aparecem aqui durante as viagens.</Text>}
        {conta.avisos.map((a) => (
          <View key={a.id} style={[s.aviso, !a.lido && s.avisoNovo]}>
            <Text style={s.nomePequeno}>
              {a.titulo} <Text style={s.secundario}>· {formatarDia(a.em, agora)}, {formatarHora(a.em)}</Text>
            </Text>
            <Text style={s.texto}>{a.texto}</Text>
          </View>
        ))}

        <Text style={s.ligacaoLegal} onPress={() => router.push({ pathname: '/legal', params: { doc: 'termos' } })}>
          Termos de Utilização
        </Text>
        <Text style={s.ligacaoLegal} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacidade' } })}>
          Política de Privacidade
        </Text>
        <Pressable onPress={sessao.sair} style={s.entrada} accessibilityRole="button">
          <Text style={[s.nome, { color: '#D93025' }]}>Sair da conta</Text>
          {sessao.semSms && <Text style={s.secundario}>Conta de teste, sem SMS: fica só neste telemóvel.</Text>}
        </Pressable>
        {!apagar ? (
          <Text style={[s.ligacaoLegal, { color: cores.textSecondary }]} onPress={() => setApagar(true)}>
            Apagar a conta
          </Text>
        ) : (
          <View style={[s.entrada, { gap: Spacing.two }]}>
            <Text style={s.nome}>Apagar a conta?</Text>
            <Text style={s.secundario}>
              Apagamos o teu perfil, os locais guardados e o histórico neste telemóvel. Os recibos de viagens pagas ficam guardados o tempo que a lei exige. Não dá para desfazer.
            </Text>
            {erroApagar && <Text style={[s.secundario, { color: '#D93025' }]}>{erroApagar}</Text>}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Pressable onPress={() => setApagar(false)} style={[s.botaoPequeno, { flex: 1, backgroundColor: cores.background }]}>
                <Text style={[s.nomePequeno, { textAlign: 'center' }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => setErroApagar(await sessao.apagarConta())}
                style={[s.botaoPequeno, { flex: 1, backgroundColor: '#D93025' }]}
                accessibilityLabel="Apagar para sempre">
                <Text style={[s.nomePequeno, { textAlign: 'center', color: '#FFFFFF' }]}>Apagar para sempre</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
    perfil: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.two },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { color: c.onPrimary, fontSize: 22, fontWeight: '800' },
    ligacaoLegal: { color: c.textSecondary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
    entrada: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    secao: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: Spacing.three },
    caixa: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
    separador: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    nomePequeno: { color: c.text, fontSize: 15, fontWeight: '700' },
    texto: { color: c.text, fontSize: 14 },
    secundario: { color: c.textSecondary, fontSize: 13 },
    ligacao: { color: c.text, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
    codigo: { flex: 1, color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: 1 },
    botaoPequeno: { backgroundColor: c.go, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    botaoPequenoTexto: { color: c.onGo, fontWeight: '700' },
    aviso: { borderRadius: Radius.card, padding: Spacing.three, borderWidth: 1, borderColor: c.backgroundSelected },
    avisoNovo: { borderColor: c.accent, borderLeftWidth: 4 },
  });
}
