import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { ESPERA_MIN, HORAS_CANCELAR_GRATIS, MINUTOS_CANCELAR_GRATIS, TAXA_CANCELAMENTO_MZN } from '@/data/cancelamento';
import { formatarMzn } from '@/data/categorias';
import { t } from '@/i18n';
import { ligarProtegido } from '@/data/chamadas';
import { metodosTexto } from '@/data/paises';
import { useConta, type ViagemFeita } from '@/state/conta';
import { useSessao } from '@/state/sessao';
import { TIPOS_AJUDA, useSuporte, type TipoAjuda } from '@/state/suporte';

// Os textos traduzem-se ao desenhar (t(q.p), t(q.r, q.v)); os valores ficam em v.
// É uma função para os valores (moeda, métodos de pagamento) seguirem o país da conta.
const perguntas = (): { p: string; r: string; v?: Record<string, string | number> }[] => [
  {
    p: 'Como cancelo uma viagem?',
    r: 'Na viagem em curso, toca em «Cancelar pedido». Numa viagem marcada, abre-a em As tuas viagens e toca em «Cancelar a reserva». Reservas: grátis até {horas} horas antes. Pedidos para agora: grátis até {minutos} minutos depois de o motorista aceitar, depois {taxa}.',
    v: { horas: HORAS_CANCELAR_GRATIS, minutos: MINUTOS_CANCELAR_GRATIS, taxa: formatarMzn(TAXA_CANCELAMENTO_MZN) },
  },
  { p: 'Quanto tempo espera o motorista?', r: '{min} minutos depois de chegar à recolha. Depois disso, pode marcar falta de comparência.', v: { min: ESPERA_MIN } },
  { p: 'Posso pagar em dinheiro?', r: 'Não. Pagas só pela app, por {metodos}, ou com a fatura da tua empresa.', v: { metodos: metodosTexto() } },
  { p: 'Quando pago?', r: 'As viagens marcadas, os alugueres e os casamentos pagam-se ao reservar. Os pedidos para agora pagam-se no fim da viagem.' },
  { p: 'Esqueci-me de uma coisa no carro', r: 'Escolhe «Esqueci-me de um objeto no carro» aqui em baixo e a viagem. Podes ligar logo ao motorista, e nós também o contactamos.' },
];

/** Ajuda, como na Uber: perguntas frequentes, pedir ajuda sobre uma viagem, e as respostas da equipa. */
export default function Ajuda() {
  const cores = usePalette();
  const s = estilos(cores);
  const { viagem: viagemParam } = useLocalSearchParams<{ viagem?: string }>();
  const { viagens } = useConta();
  const { perfil } = useSessao();
  const suporte = useSuporte();
  const [aberta, setAberta] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoAjuda | null>(null);
  const [viagemId, setViagemId] = useState<string | undefined>(viagemParam);
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);

  const recentes = viagens.filter((v) => v.estado !== 'agendada').slice(0, 5);
  const viagem = viagens.find((v) => v.id === viagemId);
  const meus = suporte.pedidos.filter((p) => p.clienteTelefone === perfil?.telefone);
  const agora = new Date();
  const resumo = (v: ViagemFeita) => `${formatarDia(v.recolhaEm, agora)}, ${formatarHora(v.recolhaEm)} · ${v.origem.nome} → ${v.destino.nome}`;

  function enviar() {
    if (!tipo || !perfil) return;
    suporte.criar({
      tipo,
      texto: texto.trim(),
      viagemId,
      viagemResumo: viagem ? `${resumo(viagem)} · ${viagem.viatura} · ${viagem.motorista.nome} · ${formatarMzn(viagem.precoMzn - viagem.descontoMzn)}` : undefined,
      clienteNome: [perfil.nome, perfil.apelido].filter(Boolean).join(' '),
      clienteTelefone: perfil.telefone,
    });
    setTipo(null);
    setTexto('');
    setEnviado(true);
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Ajuda')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {meus.length > 0 && (
            <>
              <Text style={s.secao}>{t('Os teus pedidos')}</Text>
              {meus.map((p) => (
                <View key={p.id} style={s.cartao}>
                  <View style={s.linha}>
                    <Text style={s.nome}>{t(TIPOS_AJUDA.find((x) => x.id === p.tipo)?.nome ?? 'Outro assunto')}</Text>
                    <Text style={[s.estado, { color: p.estado === 'aberto' ? '#F59E0B' : cores.go }]}>{p.estado === 'aberto' ? t('Em análise') : t('Respondido')}</Text>
                  </View>
                  {p.viagemResumo && <Text style={s.secundario}>{p.viagemResumo}</Text>}
                  {p.texto ? <Text style={s.texto}>{p.texto}</Text> : null}
                  {p.resposta && <Text style={[s.texto, s.resposta]}>Chauffeur: {p.resposta}</Text>}
                  {(p.reembolsoMzn ?? 0) > 0 && <Text style={[s.texto, { fontWeight: '700' }]}>{t('Devolvemos {valor}.', { valor: formatarMzn(p.reembolsoMzn!) })}</Text>}
                </View>
              ))}
            </>
          )}

          <Text style={s.secao}>{t('Pedir ajuda')}</Text>
          {enviado && <Text style={[s.secundario, { color: cores.go }]}>{t('Recebemos o teu pedido. Respondemos aqui e com um aviso.')}</Text>}
          {TIPOS_AJUDA.map((tp) => (
            <Pressable
              key={tp.id}
              onPress={() => {
                setTipo(tp.id);
                setEnviado(false);
              }}
              style={[s.opcao, tipo === tp.id && s.opcaoAtiva]}>
              <Text style={[s.texto, tipo === tp.id && { fontWeight: '800' }]}>{t(tp.nome)}</Text>
            </Pressable>
          ))}

          {tipo && (
            <>
              <Text style={s.rotulo}>{t('Que viagem?')}</Text>
              {recentes.length === 0 && <Text style={s.secundario}>{t('Ainda não tens viagens.')}</Text>}
              {recentes.map((v) => (
                <Pressable key={v.id} onPress={() => setViagemId(v.id === viagemId ? undefined : v.id)} style={[s.opcao, v.id === viagemId && s.opcaoAtiva]}>
                  <Text style={s.texto} numberOfLines={1}>
                    {resumo(v)}
                  </Text>
                  <Text style={s.secundario}>
                    {v.viatura} · {v.motorista.nome}
                  </Text>
                </Pressable>
              ))}
              {tipo === 'objeto' && viagem?.motorista.telefone && (
                <Pressable onPress={() => ligarProtegido(viagem.motorista.telefone, viagem.id)} style={[s.opcao, { alignItems: 'center' }]}>
                  <Text style={[s.texto, { fontWeight: '800' }]}>{t('Ligar a {nome}', { nome: viagem.motorista.nome.split(' ')[0] })}</Text>
                </Pressable>
              )}
              {tipo === 'seguranca' && <Text style={s.secundario}>{t('Se estiveres em perigo agora, liga 119 (polícia).')}</Text>}
              <Text style={s.rotulo}>{t('Conta-nos o que aconteceu')}</Text>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                multiline
                placeholder={tipo === 'objeto' ? t('Que objeto, e onde estava no carro?') : t('Escreve aqui')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              <BotaoPrincipal texto={t('Enviar')} desativado={texto.trim().length < 5} onPress={enviar} />
            </>
          )}

          <Text style={s.secao}>{t('Perguntas frequentes')}</Text>
          {perguntas().map((q, i) => (
            <Pressable key={q.p} onPress={() => setAberta(aberta === i ? null : i)} style={s.cartao}>
              <Text style={s.nome}>{t(q.p)}</Text>
              {aberta === i && <Text style={s.texto}>{t(q.r, q.v)}</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </FecharTeclado>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
    secao: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: Spacing.three },
    rotulo: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: Spacing.two },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 4 },
    linha: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
    nome: { color: c.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    estado: { fontSize: 12, fontWeight: '800' },
    texto: { color: c.text, fontSize: 14 },
    resposta: { borderLeftWidth: 3, borderLeftColor: c.go, paddingLeft: Spacing.two, marginTop: 4 },
    secundario: { color: c.textSecondary, fontSize: 13 },
    opcao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, borderWidth: 2, borderColor: 'transparent', gap: 2 },
    opcaoAtiva: { borderColor: c.primary },
    campo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 15, minHeight: 96, textAlignVertical: 'top' },
  });
}
