import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoSecundario, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { CLUB, estadoViagensGratis, vantagensClub } from '@/data/club';
import { normalizarTelefone } from '@/data/motorista';
import { cobrarEsperar, metodoDoNumero, pagamentosReais } from '@/data/pagamentos';
import { t } from '@/i18n';
import { useConta } from '@/state/conta';

// Tempo simulado até a operadora confirmar.
const TEMPO_CONFIRMACAO = 2500;

/** Chauffeur Club: assinatura mensal com desconto em todas as viagens, como a Uber One. */
export default function Club() {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const [aderir, setAderir] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState('');
  const numero = normalizarTelefone(telefone);
  const a = conta.assinatura;
  const poupado = conta.viagens.reduce((t, v) => t + (v.descontoClubMzn ?? 0) + (v.gratisMzn ?? 0), 0);
  const gratis = estadoViagensGratis(conta.viagens, a);

  async function pagar() {
    if (!numero) return;
    setAProcessar(true);
    setErro('');
    const falhou = pagamentosReais
      ? await cobrarEsperar({ tipo: 'club', metodo: metodoDoNumero(numero), telefone: numero.replace(/^\+258/, ''), valorMzn: CLUB.precoMensalMzn, viaturaId: 'club', viagem: {} })
      : (await new Promise((r) => setTimeout(r, TEMPO_CONFIRMACAO)), null);
    if (falhou) {
      setErro(falhou);
      setAProcessar(false);
      return;
    }
    conta.aderirClub();
    conta.avisar(t('Bem-vindo ao Chauffeur Club'), t('O desconto já vale na próxima viagem.'));
    setAProcessar(false);
    setAderir(false);
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>Chauffeur Club</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <View style={s.cartao}>
            <Text style={s.marca}>
              chauffeur<Text style={{ color: cores.go }}>.</Text> club
            </Text>
            <Text style={s.preco}>
              {formatarMzn(CLUB.precoMensalMzn)}
              <Text style={s.porMes}>{t('/mês')}</Text>
            </Text>
            {conta.clubAtivo && a && (
              <Text style={s.estado}>
                {a.cancelada
                  ? t('Cancelado. Vale até {dia}.', { dia: formatarDia(a.renovaEm, new Date()).toLowerCase() })
                  : t('Ativo. Renova {dia}.', { dia: formatarDia(a.renovaEm, new Date()).toLowerCase() })}
              </Text>
            )}
          </View>

          {vantagensClub().map((v) => (
            <View key={v} style={s.vantagem}>
              <Text style={s.visto}>✓</Text>
              <Text style={s.texto}>{v}</Text>
            </View>
          ))}

          {conta.clubAtivo && (
            <Text style={s.secundario}>
              {gratis.disponivel
                ? t('Tens uma viagem grátis: aplica-se sozinha no próximo pagamento.')
                : gratis.faltam === 1
                  ? t('Falta {n} viagem para a próxima grátis.', { n: gratis.faltam })
                  : t('Faltam {n} viagens para a próxima grátis.', { n: gratis.faltam })}
            </Text>
          )}
          {poupado > 0 && <Text style={s.secundario}>{t('Já poupaste {valor} com o Club.', { valor: formatarMzn(poupado) })}</Text>}

          <View style={{ height: Spacing.two }} />
          {aProcessar ? (
            <View style={{ alignItems: 'center', gap: Spacing.two }}>
              <ActivityIndicator color={cores.text} />
              <Text style={s.secundario}>{t('Confirma no teu telemóvel com o PIN do M-Pesa.')}</Text>
            </View>
          ) : conta.clubAtivo && a && !a.cancelada ? (
            <BotaoSecundario
              texto={t('Cancelar a assinatura')}
              onPress={() => {
                conta.cancelarClub();
                conta.avisar(t('Assinatura cancelada'), t('O Club vale até ao fim do mês já pago.'));
              }}
            />
          ) : aderir ? (
            <View style={{ gap: Spacing.two }}>
              <TextInput
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder={t('Número M-Pesa ou e-Mola, ex.: 84 123 4567')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              {erro ? <Text style={[s.secundario, { color: '#DC2626' }]}>{erro}</Text> : null}
              <BotaoPrincipal texto={t('Pagar {valor}', { valor: formatarMzn(CLUB.precoMensalMzn) })} desativado={!numero} onPress={pagar} />
              <BotaoSecundario texto={t('Agora não')} onPress={() => setAderir(false)} />
            </View>
          ) : (
            <BotaoPrincipal
              texto={conta.clubAtivo ? t('Renovar o Club') : t('Aderir por {valor} por mês', { valor: formatarMzn(CLUB.precoMensalMzn) })}
              onPress={() => setAderir(true)}
            />
          )}
          <Text style={[s.secundario, { marginTop: Spacing.two }]}>
            {t('Renova todos os meses pelo mesmo número. Protótipo: o pagamento é simulado e os valores ainda podem mudar.')}
          </Text>
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
    cartao: { backgroundColor: '#000000', borderRadius: Radius.sheet, padding: Spacing.four, gap: Spacing.one, marginBottom: Spacing.two },
    marca: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    preco: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: Spacing.two },
    porMes: { color: '#8A908C', fontSize: 16, fontWeight: '500' },
    estado: { color: '#22C55E', fontSize: 14, fontWeight: '700' },
    vantagem: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
    visto: { color: c.text, fontSize: 16, fontWeight: '800' },
    texto: { color: c.text, fontSize: 15, flex: 1 },
    secundario: { color: c.textSecondary, fontSize: 13 },
    campo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 16 },
  });
}
