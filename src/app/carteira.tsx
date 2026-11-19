import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { cobrarEsperar, levantarCarteira, metodoDoNumero, pagamentosReais, saldoCarteiraReal } from '@/data/pagamentos';
import { carteiraPrincipal, lerTelefone, metodosTexto, paisAtual } from '@/data/paises';
import { useSessao } from '@/state/sessao';
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
      return t('Carregamento por {carteira}', { carteira: carteiraPrincipal() });
    case 'viagem':
      return m.detalhe ? t('Viagem para {destino}', { destino: m.detalhe }) : t('Viagem');
    case 'levantamento':
      return t('Levantamento para o {carteira}', { carteira: carteiraPrincipal() });
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
  const [erro, setErro] = useState('');
  const { perfil } = useSessao();
  // Com pagamentos reais, só se levanta o dinheiro que o servidor guarda (os carregamentos pagos, menos o que já se usou).
  // Os reembolsos e os créditos de convite ficam no telemóvel e só pagam viagens.
  const [saldoReal, setSaldoReal] = useState<number | null>(null);
  useEffect(() => {
    if (pagamentosReais()) saldoCarteiraReal().then(setSaldoReal);
  }, []);
  const levantarReal = pagamentosReais();
  // O levantamento real vai sempre para o número da conta; o simulado deixa escrever o número.
  const numero = levantarReal && acao === 'levantar' ? (perfil?.telefone ?? null) : normalizarTelefone(telefone);
  const agora = new Date();
  const valorLevantar = levantarReal ? Math.floor(saldoReal ?? 0) : conta.saldoMzn;

  async function confirmar() {
    if (!numero || !acao) return;
    setAProcessar(true);
    setErro('');
    if (acao === 'levantar' && levantarReal) {
      const r = await levantarCarteira(valorLevantar);
      setAProcessar(false);
      if (r.erro && !r.pendente) return setErro(r.erro);
      conta.movimentar(-valorLevantar, 'levantamento');
      conta.avisar(
        r.pendente ? t('Levantamento a confirmar') : t('Levantamento feito'),
        r.pendente ? (r.erro ?? '') : t('{valor} foram para o {numero}.', { valor: formatarMzn(valorLevantar), numero }),
      );
      setSaldoReal(await saldoCarteiraReal());
      setAcao(null);
      return;
    }
    // O carregamento é cobrado a sério pela DebitoPay quando os pagamentos reais estão ligados.
    // O levantamento ainda é simulado: a devolução para o M-Pesa faz-se à mão até haver envios pela API.
    const falhou =
      acao === 'carregar' && pagamentosReais()
        ? await cobrarEsperar({ tipo: 'carteira', metodo: metodoDoNumero(numero), telefone: lerTelefone(numero).digitos, valorMzn: valor, viaturaId: 'carteira', viagem: {} })
        : (await new Promise((r) => setTimeout(r, TEMPO_CONFIRMACAO)), null);
    if (falhou) {
      setErro(falhou);
      setAProcessar(false);
      return;
    }
    if (acao === 'carregar') {
      conta.movimentar(valor, 'carregamento');
      conta.avisar(t('Carteira carregada'), t('{valor} entraram na tua carteira.', { valor: formatarMzn(valor) }));
    } else {
      conta.movimentar(-valorLevantar, 'levantamento');
      conta.avisar(t('Levantamento feito'), t('{valor} foram para o {carteira} {numero}.', { carteira: carteiraPrincipal(), valor: formatarMzn(valorLevantar), numero: telefone.replace(/\s/g, '') }));
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
            {levantarReal && saldoReal != null && <Text style={s.secundario}>{t('Podes levantar {valor}.', { valor: formatarMzn(Math.floor(saldoReal)) })}</Text>}
          </View>

          {aProcessar ? (
            <View style={[s.caixa, { alignItems: 'center', gap: Spacing.two }]}>
              <ActivityIndicator color={cores.text} />
              <Text style={s.secundario}>{acao === 'carregar' ? t('Confirma no teu telemóvel com o PIN do {carteira}.', { carteira: carteiraPrincipal() }) : t('A enviar para o teu {carteira}…', { carteira: carteiraPrincipal() })}</Text>
            </View>
          ) : acao ? (
            <View style={[s.caixa, { gap: Spacing.two }]}>
              <Text style={s.nome}>{acao === 'carregar' ? t('Carregar a carteira') : t('Levantar {valor} para o {carteira}', { carteira: carteiraPrincipal(), valor: formatarMzn(valorLevantar) })}</Text>
              {acao === 'carregar' && (
                <View style={s.chips}>
                  {CARREGAMENTOS.map((v) => (
                    <Pressable key={v} onPress={() => setValor(v)} style={[s.chip, valor === v && s.chipAtivo]}>
                      <Text style={[s.chipTexto, valor === v && { fontWeight: '800' }]}>{formatarMzn(v)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {acao === 'levantar' && levantarReal ? (
                <Text style={s.secundario}>
                  {t('Vai para o número da tua conta, {numero}. Só se levanta o dinheiro que carregaste; os reembolsos e os créditos de convite pagam as próximas viagens.', { numero: numero ?? '' })}
                </Text>
              ) : (
              <TextInput
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder={acao === 'carregar' ? t('Número {metodos}, ex.: {exemplo}', { metodos: metodosTexto(), exemplo: paisAtual().exemploNumero }) : t('Número {carteira}, ex.: {exemplo}', { carteira: carteiraPrincipal(), exemplo: paisAtual().exemploNumero })}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              )}
              {erro ? <Text style={[s.secundario, { color: '#DC2626' }]}>{erro}</Text> : null}
              <BotaoPrincipal texto={acao === 'carregar' ? t('Carregar {valor}', { valor: formatarMzn(valor) }) : t('Levantar')} desativado={!numero} onPress={confirmar} />
              <BotaoSecundario texto={t('Cancelar')} onPress={() => setAcao(null)} />
            </View>
          ) : (
            <View style={{ gap: Spacing.two }}>
              <BotaoPrincipal texto={t('Carregar a carteira')} onPress={() => setAcao('carregar')} />
              {(levantarReal ? (saldoReal ?? 0) >= 10 : conta.saldoMzn > 0) && <BotaoSecundario texto={t('Levantar para o {carteira}', { carteira: carteiraPrincipal() })} onPress={() => setAcao('levantar')} />}
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
