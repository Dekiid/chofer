import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { useAgenda } from '@/state/agenda';
import { COMISSAO, formatarMzn } from '@/data/categorias';
import { t } from '@/i18n';
import { totalPago, useConta } from '@/state/conta';
import { estadoDocumentos, useInscricoes } from '@/state/inscricoes';
import { useSuporte } from '@/state/suporte';
import { Text } from '@/components/texto';

// Área da equipa. No protótipo fica na app; no produto final passa para o painel de gestão.
export default function Gestao() {
  const cores = usePalette();
  const s = estilos(cores);
  const { notificacoes, marcarLidas } = useAgenda();
  const { inscricoes } = useInscricoes();
  const pendentes = inscricoes.filter((i) => i.estado === 'pendente').length;
  const ajudaAbertos = useSuporte().pedidos.filter((p) => p.estado === 'aberto').length;
  const { viagens } = useConta();
  // Resumo de hoje, com as viagens deste telemóvel (no produto final, de todos os clientes).
  const deHoje = viagens.filter((v) => v.recolhaEm.toDateString() === new Date().toDateString() && v.estado !== 'agendada');
  const feitasHoje = deHoje.filter((v) => v.estado !== 'cancelada');
  const receita = deHoje.reduce((t, v) => t + totalPago(v), 0);
  const comissao = Math.round(feitasHoje.reduce((t, v) => t + (v.precoMzn - v.descontoMzn), 0) * COMISSAO);
  const motoristas = inscricoes.filter((i) => i.estado === 'aprovada');
  // Avaliações dos clientes por motorista, para decidir quem continua na plataforma.
  const porMotorista = new Map<string, { nome: string; matricula: string; estrelas: number[]; notas: string[] }>();
  for (const v of viagens) {
    if (!v.avaliacao) continue;
    const m = porMotorista.get(v.motorista.matricula) ?? { nome: v.motorista.nome, matricula: v.motorista.matricula, estrelas: [], notas: [] };
    m.estrelas.push(v.avaliacao.estrelas);
    m.notas.push(...v.avaliacao.elogios, ...(v.avaliacao.comentario ? [`«${v.avaliacao.comentario}»`] : []));
    porMotorista.set(v.motorista.matricula, m);
  }

  // Ao sair, as notificações vistas deixam de contar como novas.
  useEffect(() => marcarLidas, [marcarLidas]);

  const agora = new Date();

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Painel de gestão')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <Text style={s.nota}>{t('Em testes, o painel fica na app e vê os dados deste telemóvel. Antes do lançamento passa para um painel web só da equipa.')}</Text>
        <View style={s.numeros}>
          {[
            { n: String(feitasHoje.length), t: t('viagens hoje') },
            { n: formatarMzn(receita), t: t('recebido hoje') },
            { n: formatarMzn(comissao), t: t('comissão {pct}%', { pct: Math.round(COMISSAO * 100) }) },
            { n: String(deHoje.length - feitasHoje.length), t: t('canceladas') },
          ].map((x) => (
            <View key={x.t} style={s.numero}>
              <Text style={s.numeroValor}>{x.n}</Text>
              <Text style={s.secundario}>{x.t}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={() => router.push('/suporte')} style={[s.entrada, ajudaAbertos > 0 && s.naoLida]}>
          <Text style={s.nome}>{t('Ajuda e queixas')}{ajudaAbertos > 0 ? ` (${ajudaAbertos})` : ''}</Text>
          <Text style={s.secundario}>{t('Responder, objetos perdidos e reembolsos')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/agenda')} style={s.entrada}>
          <Text style={s.nome}>{t('Agenda das viaturas')}</Text>
          <Text style={s.secundario}>{t('Horários livres e ocupados de cada carro')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/aprovacoes')} style={s.entrada}>
          <Text style={s.nome}>{t('Aprovar inscrições')}{pendentes > 0 ? ` (${pendentes})` : ''}</Text>
          <Text style={s.secundario}>{t('Motoristas à espera de aprovação')}</Text>
        </Pressable>

        <Text style={s.secao}>{t('Motoristas e documentos')}</Text>
        {motoristas.length === 0 && <Text style={s.secundario}>{t('Ainda não há motoristas aprovados.')}</Text>}
        {motoristas.map((i) => {
          const docs = estadoDocumentos(i.validades);
          const mal = docs.filter((d) => d.estado !== 'ok');
          return (
            <View key={i.id} style={[s.notificacao, mal.length > 0 && s.naoLida]}>
              <Text style={s.nome}>
                {i.nome} <Text style={s.secundario}>· {i.marca} {i.modelo} · {i.matricula}</Text>
              </Text>
              <Text style={s.texto}>
                {mal.length === 0
                  ? t('Documentos em dia')
                  : mal
                      .map((d) =>
                        d.estado === 'em_falta'
                          ? t('{doc}: sem validade', { doc: t(d.nome) })
                          : d.estado === 'expirado'
                            ? t('{doc}: expirado', { doc: t(d.nome) })
                            : d.dias === 1
                              ? t('{doc}: expira em {n} dia', { doc: t(d.nome), n: d.dias })
                              : t('{doc}: expira em {n} dias', { doc: t(d.nome), n: d.dias ?? 0 }),
                      )
                      .join(' · ')}
              </Text>
            </View>
          );
        })}

        <Text style={s.secao}>{t('Avaliações dos motoristas')}</Text>
        {porMotorista.size === 0 && <Text style={s.secundario}>{t('Ainda não há avaliações.')}</Text>}
        {[...porMotorista.values()].map((m) => {
          const media = m.estrelas.reduce((a, b) => a + b, 0) / m.estrelas.length;
          return (
            <View key={m.matricula} style={[s.notificacao, media < 4 && s.naoLida]}>
              <Text style={s.nome}>
                {m.nome} <Text style={s.secundario}>· {m.matricula}</Text>
              </Text>
              <Text style={s.texto}>
                ★{' '}
                {t(m.estrelas.length === 1 ? '{nota} em {n} viagem' : '{nota} em {n} viagens', { nota: media.toFixed(1).replace('.', ','), n: m.estrelas.length })}
                {media < 4 ? ` · ${t('abaixo de 4, a rever')}` : ''}
              </Text>
              {m.notas.length > 0 && <Text style={s.secundario}>{[...new Set(m.notas)].slice(0, 6).join(' · ')}</Text>}
            </View>
          );
        })}

        <Text style={s.secao}>{t('Notificações')}</Text>
        {notificacoes.length === 0 && <Text style={s.secundario}>{t('Sem notificações. Os pedidos imediatos aparecem aqui.')}</Text>}
        {notificacoes.map((n) => (
          <View key={n.id} style={[s.notificacao, !n.lida && s.naoLida]}>
            <Text style={s.nome}>
              {n.titulo} <Text style={s.secundario}>· {formatarDia(n.criadaEm, agora)}, {formatarHora(n.criadaEm)}</Text>
            </Text>
            <Text style={s.texto}>{n.texto}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two },
    entrada: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    secao: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
    nome: { color: c.text, fontSize: 16, fontWeight: '700' },
    texto: { color: c.text, fontSize: 14, marginTop: 2 },
    secundario: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    notificacao: { borderRadius: Radius.card, padding: Spacing.three, borderWidth: 1, borderColor: c.backgroundSelected },
    naoLida: { borderColor: c.accent, borderLeftWidth: 4 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic' },
    numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    numero: { flexBasis: '48%', flexGrow: 1, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three },
    numeroValor: { color: c.text, fontSize: 20, fontWeight: '800' },
  });
}
