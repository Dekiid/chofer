import { router } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarMzn } from '@/data/categorias';
import { codigoConviteMotorista, PREMIO_CONVITE_MOTORISTA_MZN, VIAGENS_PARA_PREMIO } from '@/data/convite-motorista';
import { t } from '@/i18n';
import { useInscricoes } from '@/state/inscricoes';
import { useSessao } from '@/state/sessao';

/** Convidar motoristas: o código do motorista e quem já se inscreveu com ele. */
export default function ConvidarMotoristas() {
  const cores = usePalette();
  const s = estilos(cores);
  const { perfil } = useSessao();
  const codigo = codigoConviteMotorista(perfil?.telefone ?? '');
  // Protótipo: só se veem as inscrições guardadas neste telemóvel; no produto final vêm do servidor.
  const convidados = useInscricoes().inscricoes.filter((i) => i.convite === codigo);

  async function partilhar() {
    try {
      await Share.share({
        message: t('Conduz com a Chauffeur, carros premium com motorista em Maputo e Matola. Inscreve o teu carro na app e escreve o meu código {codigo} na inscrição.', { codigo }),
      });
    } catch {}
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Convidar motoristas')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.caixa}>
          <Text style={s.grande}>{formatarMzn(PREMIO_CONVITE_MOTORISTA_MZN)}</Text>
          <Text style={s.texto}>
            {t('por cada motorista que se inscrever com o teu código, for aprovado e fizer {n} viagens nos primeiros 30 dias.', { n: VIAGENS_PARA_PREMIO })}
          </Text>
        </View>
        <Text style={s.secao}>{t('O teu código')}</Text>
        <View style={[s.caixa, { flexDirection: 'row', alignItems: 'center' }]}>
          <Text style={s.codigo}>{codigo}</Text>
        </View>
        <BotaoPrincipal texto={t('Partilhar o convite')} onPress={partilhar} />

        <Text style={s.secao}>{t('Convidados')}</Text>
        {convidados.length === 0 && <Text style={s.secundario}>{t('Ainda ninguém se inscreveu com o teu código.')}</Text>}
        {convidados.map((i) => (
          <View key={i.id} style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>{i.motorista?.nome ?? i.nome}</Text>
              <Text style={s.secundario}>
                {i.marca} {i.modelo}
              </Text>
            </View>
            <Text style={s.secundario}>{i.estado === 'aprovada' ? t('Aprovado') : i.estado === 'rejeitada' ? t('Não aprovado') : t('Em análise')}</Text>
          </View>
        ))}
        <Text style={[s.secundario, { marginTop: Spacing.three }]}>
          {t('O prémio é pago com os teus ganhos, na segunda-feira a seguir. Valores provisórios, ainda podem mudar.')}
        </Text>
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
    caixa: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    grande: { color: c.text, fontSize: 32, fontWeight: '800' },
    texto: { color: c.text, fontSize: 15 },
    secao: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: Spacing.three },
    codigo: { flex: 1, color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.backgroundSelected },
    nome: { color: c.text, fontSize: 15, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 13 },
  });
}
