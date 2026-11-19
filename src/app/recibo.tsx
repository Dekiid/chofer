import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoSecundario, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { custoCancelar } from '@/data/cancelamento';
import { formatarTelefone } from '@/data/motorista';
import { formatarMzn } from '@/data/categorias';
import { descricaoReserva, eReserva, linhasPagamento, linhasRecibo, numeroRecibo, pagoPor, partilharRecibo } from '@/data/recibo';
import { textoDias } from '@/data/reserva';
import { publicar, TEMPO_REAL_ATIVO } from '@/data/tempo-real';
import { useAgenda } from '@/state/agenda';
import { totalPago, useConta, type ViagemFeita } from '@/state/conta';
import { Text } from '@/components/texto';
import { t } from '@/i18n';
import { nomeLugar } from '@/data/lugares';

export default function Recibo() {
  const cores = usePalette();
  const s = estilos(cores);
  const { id } = useLocalSearchParams<{ id: string }>();
  const conta = useConta();
  const v = conta.viagens.find((x) => x.id === id);
  const [aGerar, setAGerar] = useState(false);
  if (!v) return <Redirect href="/viagens" />;

  const percurso = eReserva(v) ? [v.origem] : [v.origem, ...v.paragens, v.destino];

  async function pdf() {
    setAGerar(true);
    try {
      await partilharRecibo(v!, conta.faturacao);
    } finally {
      setAGerar(false);
    }
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Recibo')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <Text style={s.secundario}>{numeroRecibo(v)}</Text>
        <Text style={s.total}>{formatarMzn(totalPago(v))}</Text>
        <Text style={s.secundario}>
          {formatarDia(v.recolhaEm, new Date())}, {formatarHora(v.recolhaEm)} · {t('pago por {pagamento}', { pagamento: pagoPor(v) })}
        </Text>

        {v.passageiro && <Text style={s.secundario}>{t('Viagem para {nome} · {telefone}', { nome: v.passageiro.nome, telefone: formatarTelefone(v.passageiro.telefone) })}</Text>}
        {v.voo && <Text style={s.secundario}>{t('Voo {voo}', { voo: v.voo })}</Text>}
        <View style={s.caixa}>
          {percurso.map((l, i) => (
            <View key={`${l.id}-${i}`} style={s.paragem}>
              <View style={i === 0 ? s.pontoRecolha : i === percurso.length - 1 ? s.ponto : s.pontoParagem} />
              <Text style={s.lugar} numberOfLines={1}>
                {nomeLugar(l)}
              </Text>
            </View>
          ))}
          <Text style={[s.secundario, { marginTop: Spacing.two }]}>
            {eReserva(v) ? `${descricaoReserva(v)} · ${textoDias(v.dias ?? 1)} · ` : ''}
            {v.viatura} · {v.motorista.nome} · {v.motorista.matricula}
          </Text>
        </View>

        <View style={s.caixa}>
          {linhasRecibo(v).map((l) => (
            <View key={l.nome} style={s.linha}>
              <Text style={s.secundario}>{l.nome}</Text>
              <Text style={s.valor}>
                {l.valor < 0 ? '−' : ''}
                {formatarMzn(Math.abs(l.valor))}
              </Text>
            </View>
          ))}
          {v.estado === 'cancelada' && (v.taxaCancelamentoMzn ?? 0) + (v.reembolsoMzn ?? 0) > 0 && (
            <>
              <View style={s.linha}>
                <Text style={s.secundario}>{v.motivoCancelamento === 'falta' ? t('Falta de comparência') : t('Taxa de cancelamento')}</Text>
                <Text style={s.valor}>{formatarMzn(v.taxaCancelamentoMzn ?? 0)}</Text>
              </View>
              {(v.reembolsoMzn ?? 0) > 0 && (
                <View style={s.linha}>
                  <Text style={s.secundario}>{t('Devolvido')}</Text>
                  <Text style={s.valor}>{formatarMzn(v.reembolsoMzn ?? 0)}</Text>
                </View>
              )}
            </>
          )}
          <View style={[s.linha, s.linhaTotal]}>
            <Text style={s.totalLinha}>{v.estado === 'cancelada' ? t('Cancelada · pago') : t('Total pago')}</Text>
            <Text style={s.totalLinha}>{formatarMzn(totalPago(v))}</Text>
          </View>
          {linhasPagamento(v).map((l) => (
            <View key={l.nome} style={s.linha}>
              <Text style={s.secundario}>{l.nome}</Text>
              <Text style={s.secundario}>{formatarMzn(l.valor)}</Text>
            </View>
          ))}
        </View>
        {conta.faturacao ? (
          <Text style={s.secundario} onPress={() => router.push('/faturacao')}>
            {t('No PDF: {nome} · NUIT {nuit}', { nome: conta.faturacao.nome, nuit: conta.faturacao.nuit })}
          </Text>
        ) : (
          <Text style={[s.secundario, { textDecorationLine: 'underline' }]} onPress={() => router.push('/faturacao')}>
            {t('Pôr o meu NUIT nos recibos')}
          </Text>
        )}
        {v.estado === 'agendada' && <CancelarReserva v={v} />}
        <Text style={[s.secundario, { textDecorationLine: 'underline', marginTop: Spacing.two }]} onPress={() => router.push({ pathname: '/ajuda', params: { viagem: v.id } })}>
          {t('Ajuda com esta viagem')}
        </Text>
        {v.avaliacao && (
          <Text style={s.secundario}>
            {t('A tua avaliação:')} {'★'.repeat(v.avaliacao.estrelas)}
            {v.avaliacao.elogios.length ? ` · ${v.avaliacao.elogios.map((e) => t(e)).join(', ')}` : ''}
          </Text>
        )}
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrincipal texto={aGerar ? t('A preparar o PDF…') : t('Guardar ou partilhar PDF')} onPress={pdf} desativado={aGerar || v.estado === 'cancelada'} />
      </View>
    </SafeAreaView>
  );
}

/** Cancelar uma reserva já paga, com as regras de cancelamento à vista antes de confirmar. */
function CancelarReserva({ v }: { v: ViagemFeita }) {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const agenda = useAgenda();
  const [confirmar, setConfirmar] = useState(false);
  const c = custoCancelar(v, new Date(), true);

  function cancelar() {
    conta.atualizarViagem(v.id, { estado: 'cancelada', taxaCancelamentoMzn: c.taxaMzn, reembolsoMzn: c.reembolsoMzn, motivoCancelamento: 'cliente' });
    agenda.libertar(v.id);
    if (TEMPO_REAL_ATIVO) publicar({ tipo: 'cancelado', id: v.id, por: 'cliente' });
    if (c.reembolsoMzn > 0) conta.movimentar(c.reembolsoMzn, 'reembolso', v.destino.nome);
    conta.avisar(t('Reserva cancelada'), c.reembolsoMzn > 0 ? t('Devolvemos {valor} para a tua carteira.', { valor: formatarMzn(c.reembolsoMzn) }) : t('A reserva foi cancelada.'));
  }

  return (
    <View style={[s.caixa, { gap: Spacing.two }]}>
      <Text style={s.valor}>{t('Cancelar a reserva')}</Text>
      <Text style={s.secundario}>{c.texto}</Text>
      {c.taxaMzn > 0 && <Text style={s.secundario}>{t('Ficam {valor} como taxa de cancelamento.', { valor: formatarMzn(c.taxaMzn) })}</Text>}
      {confirmar ? (
        <>
          <BotaoPrincipal escuro texto={c.reembolsoMzn > 0 ? t('Cancelar e receber {valor}', { valor: formatarMzn(c.reembolsoMzn) }) : t('Cancelar a reserva')} onPress={cancelar} />
          <BotaoSecundario texto={t('Manter a reserva')} onPress={() => setConfirmar(false)} />
        </>
      ) : (
        <BotaoSecundario texto={t('Cancelar a reserva')} onPress={() => setConfirmar(true)} />
      )}
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two },
    total: { color: c.text, fontSize: 36, fontWeight: '800' },
    caixa: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one, marginTop: Spacing.two },
    paragem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    ponto: { width: 8, height: 8, backgroundColor: c.text },
    pontoParagem: { width: 8, height: 8, borderWidth: 2, borderColor: c.text },
    lugar: { color: c.text, fontSize: 15, fontWeight: '600', flex: 1 },
    linha: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: 2 },
    linhaTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two, marginTop: Spacing.one },
    secundario: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
    valor: { color: c.text, fontSize: 14, fontWeight: '600' },
    totalLinha: { color: c.text, fontSize: 18, fontWeight: '800' },
    rodape: { padding: Spacing.three },
  });
}
