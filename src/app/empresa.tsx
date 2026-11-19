import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoSecundario, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { t } from '@/i18n';
import { totalPago, useConta } from '@/state/conta';

// Traduzidos ao desenhar, com t().
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Conta de empresa: o cliente junta os dados da empresa e passa a poder pagar com «Fatura da empresa».
 * As viagens do mês juntam-se numa fatura. Em testes, a fatura não é enviada a sério.
 */
export default function Empresa() {
  const cores = usePalette();
  const s = estilos(cores);
  const conta = useConta();
  const [editar, setEditar] = useState(!conta.empresa);
  const [nome, setNome] = useState(conta.empresa?.nome ?? '');
  const [nuit, setNuit] = useState(conta.empresa?.nuit ?? '');
  const [email, setEmail] = useState(conta.empresa?.emailFaturas ?? '');
  const valido = nome.trim().length >= 2 && /^\d{9}$/.test(nuit) && /^\S+@\S+\.\S+$/.test(email.trim());

  const agora = new Date();
  const doMes = conta.viagens.filter(
    (v) => v.pagamento === 'empresa' && v.estado !== 'agendada' && v.recolhaEm.getMonth() === agora.getMonth() && v.recolhaEm.getFullYear() === agora.getFullYear(),
  );
  const total = doMes.reduce((t, v) => t + totalPago(v), 0);
  const fimDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  function guardar() {
    conta.setEmpresa({ nome: nome.trim(), nuit, emailFaturas: email.trim() });
    setEditar(false);
  }

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Conta de empresa')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {editar ? (
            <>
              <Text style={s.secundario}>
                {t('Com a conta de empresa, escolhes «Fatura da empresa» no pagamento. As viagens do mês juntam-se numa fatura com o NUIT da empresa, enviada por email no fim do mês.')}
              </Text>
              <Text style={s.rotulo}>{t('Nome da empresa')}</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder={t('Ex.: Macuácua & Filhos, Lda')} placeholderTextColor={cores.textSecondary} style={s.campo} />
              <Text style={s.rotulo}>NUIT</Text>
              <TextInput
                value={nuit}
                onChangeText={(t) => setNuit(t.replace(/\D/g, '').slice(0, 9))}
                keyboardType="number-pad"
                placeholder={t('9 dígitos')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              <Text style={s.rotulo}>{t('Email para as faturas')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={t('contabilidade@empresa.co.mz')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              <BotaoPrincipal texto={t('Guardar')} desativado={!valido} onPress={guardar} />
            </>
          ) : (
            conta.empresa && (
              <>
                <View style={s.cartao}>
                  <Text style={s.nome}>{conta.empresa.nome}</Text>
                  <Text style={s.secundario}>
                    NUIT {conta.empresa.nuit} · {conta.empresa.emailFaturas}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two }}>
                    <View style={{ flex: 1 }}>
                      <BotaoSecundario texto={t('Mudar')} onPress={() => setEditar(true)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <BotaoSecundario
                        texto={t('Tirar')}
                        onPress={() => {
                          conta.setEmpresa(null);
                          setNome('');
                          setNuit('');
                          setEmail('');
                          setEditar(true);
                        }}
                      />
                    </View>
                  </View>
                </View>

                <Text style={s.secao}>{t('Fatura de {mes}', { mes: t(MESES[agora.getMonth()]) })}</Text>
                <View style={s.cartao}>
                  <Text style={s.total}>{formatarMzn(total)}</Text>
                  <Text style={s.secundario}>
                    {t(doMes.length === 1 ? '{n} viagem · enviada a {email} a {dia} de {mes}' : '{n} viagens · enviada a {email} a {dia} de {mes}', {
                      n: doMes.length,
                      email: conta.empresa.emailFaturas,
                      dia: fimDoMes.getDate(),
                      mes: t(MESES[fimDoMes.getMonth()]),
                    })}
                  </Text>
                  {doMes.map((v) => (
                    <View key={v.id} style={s.linha}>
                      <Text style={[s.texto, { flex: 1 }]} numberOfLines={1}>
                        {formatarDia(v.recolhaEm, agora)}, {formatarHora(v.recolhaEm)} · {v.destino.nome}
                      </Text>
                      <Text style={s.valor}>{formatarMzn(totalPago(v))}</Text>
                    </View>
                  ))}
                  <Text style={s.nota}>{t('Em testes: a fatura é simulada e não é enviada.')}</Text>
                </View>
              </>
            )
          )}
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
    campo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 16 },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 4 },
    nome: { color: c.text, fontSize: 17, fontWeight: '800' },
    total: { color: c.text, fontSize: 30, fontWeight: '800' },
    linha: { flexDirection: 'row', gap: Spacing.two, paddingVertical: 2 },
    texto: { color: c.text, fontSize: 14 },
    valor: { color: c.text, fontSize: 14, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 13 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: Spacing.one },
  });
}
