import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { pedirAutorizacao } from '@/data/avisos-telemovel';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { CLUB } from '@/data/club';
import { usePedido } from '@/state/pedido';
import { textoPreferencias } from '@/data/extras-viagem';
import { CREDITO_CONVITE_MZN, DESCONTO_CONVIDADO, PROMOS } from '@/data/promocoes';
import { formatarNumero } from '@/data/telefone';
import { t } from '@/i18n';
import { useIdioma } from '@/i18n/idioma';
import { LOCAIS, useConta } from '@/state/conta';
import { useAvaliacoes } from '@/state/avaliacoes';
import { useInscricoes } from '@/state/inscricoes';
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
  const meusCarros = useInscricoes().inscricoes.filter((i) => i.telefone === sessao.perfil?.telefone).length;
  const { marcarAvisosLidos } = conta;
  const { idioma, setIdioma } = useIdioma();
  const agora = new Date();
  const nota = useAvaliacoes().mediaCliente(sessao.perfil?.telefone);
  const [apagar, setApagar] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);
  const feitas = conta.viagens.filter((v) => v.estado === 'concluida').length;
  const { viaturas, setViaturaId } = usePedido();

  // Ao sair, os avisos vistos deixam de contar como novos.
  useEffect(() => marcarAvisosLidos, [marcarAvisosLidos]);

  async function convidar() {
    try {
      await Share.share({
        message: t('Experimenta a Chauffeur, carros premium com motorista em Maputo e Matola. Usa o meu código {codigo} e ganhas {valor} na primeira viagem.', {
          codigo: conta.codigoConvite,
          valor: formatarMzn(DESCONTO_CONVIDADO.valorMzn ?? 0),
        }),
      });
    } catch {}
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('A tua conta')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.perfil}>
          <View style={s.avatar}>
            <Text style={s.avatarTexto}>{(sessao.perfil?.nome ?? 'C').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.nome}>{sessao.perfil?.nome ? `${sessao.perfil.nome} ${sessao.perfil.apelido ?? ''}`.trim() : t('Cliente Chauffeur')}</Text>
            {sessao.perfil?.telefone ? <Text style={s.secundario}>+258 {formatarNumero(sessao.perfil.telefone)}</Text> : null}
            <Text style={s.secundario}>
              {nota
                ? `★ ${feitas === 1 ? t('{nota} dada pelos motoristas · {n} viagem', { nota: nota.media.toFixed(1).replace('.', ','), n: feitas }) : t('{nota} dada pelos motoristas · {n} viagens', { nota: nota.media.toFixed(1).replace('.', ','), n: feitas })}`
                : feitas === 1
                  ? t('Ainda sem avaliações · {n} viagem', { n: feitas })
                  : t('Ainda sem avaliações · {n} viagens', { n: feitas })}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/viagens')} style={s.entrada}>
          <Text style={s.nome}>{t('As tuas viagens')}</Text>
          <Text style={s.secundario}>{t('Histórico, viagens marcadas e recibos')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/carteira')} style={s.entrada}>
          <Text style={s.nome}>{t('Carteira')}</Text>
          <Text style={s.secundario}>{t('Saldo {valor} · reembolsos e créditos pagam as próximas viagens', { valor: formatarMzn(conta.saldoMzn) })}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/club')} style={s.entrada}>
          <Text style={s.nome}>Chauffeur Club</Text>
          <Text style={s.secundario}>
            {conta.clubAtivo
              ? t('Ativo · {p}% de desconto em todas as viagens', { p: Math.round(CLUB.percentagem * 100) })
              : t('{p}% de desconto em todas as viagens por {valor} por mês', { p: Math.round(CLUB.percentagem * 100), valor: formatarMzn(CLUB.precoMensalMzn) })}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/ajuda')} style={s.entrada}>
          <Text style={s.nome}>{t('Ajuda')}</Text>
          <Text style={s.secundario}>{t('Objetos perdidos, cobranças, queixas e perguntas frequentes')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/seguranca')} style={s.entrada}>
          <Text style={s.nome}>{t('Contactos de confiança')}</Text>
          <Text style={s.secundario}>
            {conta.contactosConfianca.length === 0
              ? t('Quem recebe a tua viagem partilhada e o SOS')
              : conta.contactosConfianca.map((c) => c.nome).join(', ')}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/opcoes', params: { so: 'preferencias' } })} style={s.entrada}>
          <Text style={s.nome}>{t('Preferências da viagem')}</Text>
          <Text style={s.secundario}>{textoPreferencias(conta.preferencias).join(' · ') || t('Silêncio, temperatura, música e malas')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/faturacao')} style={s.entrada}>
          <Text style={s.nome}>{t('Recibos com NUIT')}</Text>
          <Text style={s.secundario}>{conta.faturacao ? t('{nome} · NUIT {nuit}', { nome: conta.faturacao.nome, nuit: conta.faturacao.nuit }) : t('Para justificares a despesa')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/empresa')} style={s.entrada}>
          <Text style={s.nome}>{t('Conta de empresa')}</Text>
          <Text style={s.secundario}>{conta.empresa ? t('{empresa} · fatura mensal', { empresa: conta.empresa.nome }) : t('Viagens de trabalho numa fatura por mês')}</Text>
        </Pressable>

        {/* O modo motorista é só para motoristas aprovados; os outros veem como se inscrever. */}
        {motorista.pode ? (
          <Pressable onPress={() => router.push('/motorista')} style={s.entrada}>
            <Text style={s.nome}>{t('Modo motorista')}</Text>
            <Text style={s.secundario}>
              {sessao.perfil?.motoristaDemo
                ? t('Conta de demonstração · Fica online, recebe pedidos e conduz com a Chauffeur')
                : MOTORISTA_ABERTO_EM_TESTES
                  ? t('Aberto a todos em testes · Fica online, recebe pedidos e conduz com a Chauffeur')
                  : t('Fica online, recebe pedidos e conduz com a Chauffeur')}
            </Text>
          </Pressable>
        ) : motorista.inscricao === 'pendente' ? (
          <View style={s.entrada}>
            <Text style={s.nome}>{t('Inscrição de motorista em análise')}</Text>
            <Text style={s.secundario}>{t('O modo motorista abre quando a tua inscrição for aprovada.')}</Text>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/inscricao')} style={s.entrada}>
            <Text style={s.nome}>{t('Conduzir com a Chauffeur')}</Text>
            <Text style={s.secundario}>
              {motorista.inscricao === 'rejeitada' ? t('A tua inscrição não foi aprovada. Podes enviar outra.') : t('Inscreve o teu carro. Depois de aprovado, abres aqui o modo motorista.')}
            </Text>
          </Pressable>
        )}

        {/* Donos de carros (que conduzem ou não): resumo de cada carro. */}
        {meusCarros > 0 && (
          <Pressable onPress={() => router.push('/frota')} style={s.entrada}>
            <Text style={s.nome}>{t('Os meus carros')}</Text>
            <Text style={s.secundario}>
              {meusCarros === 1 ? t('{n} carro · ganhos, motoristas e documentos', { n: meusCarros }) : t('{n} carros · ganhos, motoristas e documentos', { n: meusCarros })}
            </Text>
          </Pressable>
        )}

        <Text style={s.secao}>{t('Motoristas favoritos')}</Text>
        <View style={s.caixa}>
          {conta.favoritos.length === 0 && <Text style={s.secundario}>{t('No fim de uma viagem, toca no coração para guardares o motorista. Depois podes pedi-lo outra vez.')}</Text>}
          {conta.favoritos.map((f, i) => {
            // O carro que conduz agora; nos carros de exemplo (sem motorista próprio), o da última viagem com ele.
            const ultima = conta.viagens.find((v) => v.motorista.telefone === f.telefone && v.viaturaId);
            const carro = viaturas.find((v) => v.motorista?.telefone === f.telefone) ?? viaturas.find((v) => v.id === ultima?.viaturaId);
            return (
              <View key={f.telefone} style={[s.linha, i > 0 && s.separador]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nomePequeno}>♥ {f.nome}</Text>
                  <Text style={s.secundario} numberOfLines={1}>
                    {carro ? `${nomeViatura(carro)} · ${f.matricula}` : t('Sem carro disponível agora')}
                  </Text>
                </View>
                {carro && (
                  <Text
                    style={s.ligacao}
                    onPress={() => {
                      setViaturaId(carro.id);
                      router.dismissTo('/');
                      router.push('/destino');
                    }}>
                    {t('Pedir')}
                  </Text>
                )}
                <Text style={[s.secundario, { textDecorationLine: 'underline' }]} onPress={() => conta.alternarFavorito(f)}>
                  {t('Tirar')}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={s.secao}>{t('Locais guardados')}</Text>
        <View style={s.caixa}>
          {LOCAIS.map(({ tipo, nome }, i) => {
            const l = conta.locais[tipo];
            return (
              <Pressable key={tipo} onPress={() => router.push({ pathname: '/destino', params: { guardar: tipo } })} style={[s.linha, i > 0 && s.separador]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nomePequeno}>{t(nome)}</Text>
                  <Text style={s.secundario} numberOfLines={1}>
                    {l ? l.zona : t('Por guardar')}
                  </Text>
                </View>
                <Text style={s.ligacao}>{l ? t('Mudar') : t('Guardar')}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.secao}>{t('Convida amigos')}</Text>
        <View style={s.caixa}>
          <Text style={s.texto}>
            {t('O teu amigo ganha {valor} na primeira viagem. Tu ganhas {credito} de crédito quando ele viajar.', {
              valor: formatarMzn(DESCONTO_CONVIDADO.valorMzn ?? 0),
              credito: formatarMzn(CREDITO_CONVITE_MZN),
            })}
          </Text>
          <View style={[s.linha, { marginTop: Spacing.two }]}>
            <Text style={s.codigo}>{conta.codigoConvite}</Text>
            <Pressable onPress={convidar} style={s.botaoPequeno}>
              <Text style={s.botaoPequenoTexto}>{t('Partilhar')}</Text>
            </Pressable>
          </View>
          <Text style={s.secundario}>
            {conta.amigosConvidados === 1
              ? t('{n} amigo convidado · crédito {credito}', { n: conta.amigosConvidados, credito: formatarMzn(conta.creditoMzn) })
              : t('{n} amigos convidados · crédito {credito}', { n: conta.amigosConvidados, credito: formatarMzn(conta.creditoMzn) })}
          </Text>
        </View>

        <Text style={s.secao}>{t('Promoções')}</Text>
        <View style={s.caixa}>
          {PROMOS.map((p, i) => (
            <View key={p.codigo} style={[s.linha, i > 0 && s.separador]}>
              <View style={{ flex: 1 }}>
                <Text style={s.nomePequeno}>{p.codigo}</Text>
                <Text style={s.secundario}>{p.descricao}</Text>
              </View>
            </View>
          ))}
          <Text style={[s.secundario, { marginTop: Spacing.two }]}>{t('Escreve o código no pagamento, em «Tens um código promocional?».')}</Text>
        </View>

        <Text style={s.secao}>{t('Notificações')}</Text>
        <View style={s.caixa}>
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={s.nomePequeno}>{t('Avisos no telemóvel')}</Text>
              <Text style={s.secundario}>{t('Motorista a caminho, chegada, pagamento')}</Text>
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
        {conta.avisos.length === 0 && <Text style={s.secundario}>{t('Ainda não há avisos. Aparecem aqui durante as viagens.')}</Text>}
        {conta.avisos.map((a) => (
          <View key={a.id} style={[s.aviso, !a.lido && s.avisoNovo]}>
            <Text style={s.nomePequeno}>
              {a.titulo} <Text style={s.secundario}>· {formatarDia(a.em, agora)}, {formatarHora(a.em)}</Text>
            </Text>
            <Text style={s.texto}>{a.texto}</Text>
          </View>
        ))}

        <View style={s.entrada}>
          <Text style={s.nome}>{t('Idioma')}</Text>
          <View style={s.segmentos} accessibilityRole="radiogroup">
            {(['pt', 'en'] as const).map((i) => (
              <Pressable
                key={i}
                onPress={() => setIdioma(i)}
                accessibilityRole="radio"
                accessibilityState={{ checked: idioma === i }}
                style={[s.segmento, idioma === i && s.segmentoAtivo]}>
                <Text style={[s.nomePequeno, idioma === i && { color: cores.onPrimary }]}>{i === 'pt' ? t('Português') : t('English')}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={s.ligacaoLegal} onPress={() => router.push({ pathname: '/legal', params: { doc: 'termos' } })}>
          {t('Termos de Utilização')}
        </Text>
        <Text style={s.ligacaoLegal} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacidade' } })}>
          {t('Política de Privacidade')}
        </Text>
        <Pressable onPress={sessao.sair} style={s.entrada} accessibilityRole="button">
          <Text style={[s.nome, { color: '#D93025' }]}>{t('Sair da conta')}</Text>
          {sessao.semSms && <Text style={s.secundario}>{t('Conta de teste, sem SMS: fica só neste telemóvel.')}</Text>}
        </Pressable>
        {!apagar ? (
          <Text style={[s.ligacaoLegal, { color: cores.textSecondary }]} onPress={() => setApagar(true)}>
            {t('Apagar a conta')}
          </Text>
        ) : (
          <View style={[s.entrada, { gap: Spacing.two }]}>
            <Text style={s.nome}>{t('Apagar a conta?')}</Text>
            <Text style={s.secundario}>
              {t('Apagamos o teu perfil, os locais guardados e o histórico neste telemóvel. Os recibos de viagens pagas ficam guardados o tempo que a lei exige. Não dá para desfazer.')}
            </Text>
            {erroApagar && <Text style={[s.secundario, { color: '#D93025' }]}>{erroApagar}</Text>}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Pressable onPress={() => setApagar(false)} style={[s.botaoPequeno, { flex: 1, backgroundColor: cores.background }]}>
                <Text style={[s.nomePequeno, { textAlign: 'center' }]}>{t('Cancelar')}</Text>
              </Pressable>
              <Pressable
                onPress={async () => setErroApagar(await sessao.apagarConta())}
                style={[s.botaoPequeno, { flex: 1, backgroundColor: '#D93025' }]}
                accessibilityLabel={t('Apagar para sempre')}>
                <Text style={[s.nomePequeno, { textAlign: 'center', color: '#FFFFFF' }]}>{t('Apagar para sempre')}</Text>
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
    segmentos: { flexDirection: 'row', gap: Spacing.one, backgroundColor: c.background, borderRadius: Radius.pill, padding: 4, marginTop: Spacing.two },
    segmento: { flex: 1, alignItems: 'center', borderRadius: Radius.pill, paddingVertical: Spacing.two },
    segmentoAtivo: { backgroundColor: c.primary },
  });
}
