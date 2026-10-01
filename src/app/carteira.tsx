import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoSecundario, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { normalizarTelefone } from '@/data/motorista';
import { t } from '@/i18n';
import { useConta, type Movimento } from '@/state/conta';

/** Valores rápidos para carregar a carteira. */
const CARREGAMENTOS = [500, 1000, 2000];
// Tempo simulado até a operadora confirmar; o real virá do servidor (DebitoPay).
const TEMPO_CONFIRMACAO = 2500;

/** O nome de cada movimento, na língua da app. */
function nomeMovimento(m: Movimento): string {
  switch (m.tipo) {
    case 'reembolso':
      return m.detalhe ? t('Reembolso · {detalhe}', { detalhe: m.detalhe }) : t('Reembolso');
    case 'convite':
      return t('Crédito de convite');
    case 'carregamento':
      return t('Carregamento por M-Pesa');
    case 'viagem':
      return m.detalhe ? t('Viagem para {destino}', { destino: m.detalhe }) : t('Viagem');
    case 'levantamento':
      return t('Levantamento para o M-Pesa');
  }
}

/** Carteira Chauffeur: reembolsos e créditos ficam aqui e pagam as próximas viagens. Pode carregar-se e levantar-se. */
export default function Carteira() {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const [acao, setAcao] = useState<'carregar' | 'levantar' | null>(null);
  const [valor, setValor] = useState(CARREGAMENTOS[1]);
  const [telefone, setTelefone] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  const numero = normalizarTelefone(telefone);
  const agora = new Date();
  const valorLevantar = conta.saldoMzn;

  async function confirmar() {
    if (!numero || !acao) return;
    setAProcessar(true);
    await new Promise((r) => setTimeout(r, TEMPO_CONFIRMACAO));
    if (acao === 'carregar') {
      conta.movimentar(valor, 'carregamento');
      conta.avisar(t('Carteira carregada'), t('{valor} entraram na tua carteira.', { valor: formatarMzn(valor) }));
    } else {
      conta.movimentar(-valorLevantar, 'levantamento');
      conta.avisar(t('Levantamento feito'), t('{valor} foram para o M-Pesa {numero}.', { valor: formatarMzn(valorLevantar), numero: telefone.replace(/\s/g, '') }));
    }
    setAProcessar(false);
    setAcao(null);
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Carteira')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <View style={s.caixa}>
            <Text style={s.secundario}>{t('Saldo')}</Text>
            <Text style={s.saldo}>{formatarMzn(conta.saldoMzn)}</Text>
            <Text style={s.secundario}>{t('Os reembolsos e os créditos de convite entram aqui. O saldo paga primeiro as próximas viagens.')}</Text>
          </View>

          {aProcessar ? (
            <View style={[s.caixa, { alignItems: 'center', gap: Spacing.two }]}>
              <ActivityIndicator color={cores.text} />
              <Text style={s.secundario}>{acao === 'carregar' ? t('Confirma no teu telemóvel com o PIN do M-Pesa.') : t('A enviar para o teu M-Pesa…')}</Text>
            </View>
          ) : acao ? (
            <View style={[s.caixa, { gap: Spacing.two }]}>
              <Text style={s.nome}>{acao === 'carregar' ? t('Carregar a carteira') : t('Levantar {valor} para o M-Pesa', { valor: formatarMzn(valorLevantar) })}</Text>
              {acao === 'carregar' && (
                <View style={s.chips}>
                  {CARREGAMENTOS.map((v) => (
                    <Pressable key={v} onPress={() => setValor(v)} style={[s.chip, valor === v && s.chipAtivo]}>
                      <Text style={[s.chipTexto, valor === v && { fontWeight: '800' }]}>{formatarMzn(v)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder={t('Número M-Pesa, ex.: 84 123 4567')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              <BotaoPrincipal texto={acao === 'carregar' ? t('Carregar {valor}', { valor: formatarMzn(valor) }) : t('Levantar')} desativado={!numero} onPress={confirmar} />
              <BotaoSecundario texto={t('Cancelar')} onPress={() => setAcao(null)} />
            </View>
          ) : (
            <View style={{ gap: Spacing.two }}>
              <BotaoPrincipal texto={t('Carregar a carteira')} onPress={() => setAcao('carregar')} />
              {conta.saldoMzn > 0 && <BotaoSecundario texto={t('Levantar para o M-Pesa')} onPress={() => setAcao('levantar')} />}
            </View>
          )}

          <Text style={s.secao}>{t('Movimentos')}</Text>
          {conta.movimentos.length === 0 && <Text style={s.secundario}>{t('Ainda não há movimentos.')}</Text>}
          {conta.movimentos.map((m) => (
            <View key={m.id} style={s.linha}>
              <View style={{ flex: 1 }}>
                <Text style={s.nomePequeno} numberOfLines={1}>
                  {nomeMovimento(m)}
                </Text>
                <Text style={s.secundario}>
                  {formatarDia(m.em, agora)}, {formatarHora(m.em)}
                </Text>
              </View>
              <Text style={[s.valor, m.valorMzn > 0 && { color: '#15803D' }]}>
                {m.valorMzn > 0 ? '+' : '−'}
                {formatarMzn(Math.abs(m.valorMzn))}
              </Text>
            </View>
          ))}
          <Text style={[s.secundario, { marginTop: Spacing.three }]}>{t('Protótipo: os carregamentos e os levantamentos são simulados até os pagamentos estarem ligados.')}</Text>
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
    caixa: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    saldo: { color: c.text, fontSize: 36, fontWeight: '800', marginVertical: Spacing.one },
    secao: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: Spacing.three },
    nome: { color: c.text, fontSize: 17, fontWeight: '700' },
    nomePequeno: { color: c.text, fontSize: 15, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 13 },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    valor: { color: c.text, fontSize: 15, fontWeight: '800' },
    chips: { flexDirection: 'row', gap: Spacing.two },
    chip: { flex: 1, alignItems: 'center', borderRadius: Radius.pill, paddingVertical: Spacing.two, backgroundColor: c.background, borderWidth: 1.5, borderColor: 'transparent' },
    chipAtivo: { borderColor: c.primary },
    chipTexto: { color: c.text, fontSize: 14, fontWeight: '600' },
    campo: { backgroundColor: c.background, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 16 },
  });
}
