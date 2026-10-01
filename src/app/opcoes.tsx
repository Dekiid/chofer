import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FecharTeclado } from '@/components/fechar-teclado';
import { Text, TextInput } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { eAeroporto, ESPERA_AEROPORTO_MIN, MAX_CADEIRINHAS, normalizarVoo, VOO_VALIDO, type Preferencias } from '@/data/extras-viagem';
import { normalizarTelefone } from '@/data/motorista';
import { t } from '@/i18n';
import { useConta } from '@/state/conta';
import { usePedido } from '@/state/pedido';

/** Opções da viagem, antes de pedir: para quem é, as preferências e, no aeroporto, o voo. */
export default function Opcoes() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const conta = useConta();
  // Aberto a partir da conta: só as preferências, sem a viagem.
  const soPreferencias = useLocalSearchParams<{ so?: string }>().so === 'preferencias';
  const [paraOutro, setParaOutro] = useState(pedido.passageiro != null);
  const [nome, setNome] = useState(pedido.passageiro?.nome ?? '');
  const [telefone, setTelefone] = useState(pedido.passageiro?.telefone.replace(/^\+258/, '') ?? '');
  const [pref, setPref] = useState<Preferencias>(conta.preferencias);
  const [voo, setVoo] = useState(pedido.voo ?? '');
  const aeroporto = !soPreferencias && eAeroporto(pedido.origem);

  const telefoneValido = normalizarTelefone(telefone);
  const passageiroValido = soPreferencias || !paraOutro || (nome.trim().length >= 2 && telefoneValido != null);
  const vooValido = !aeroporto || voo.trim() === '' || VOO_VALIDO.test(voo.trim());

  function guardar() {
    if (!soPreferencias) pedido.setPassageiro(paraOutro && telefoneValido ? { nome: nome.trim(), telefone: telefoneValido } : null);
    conta.setPreferencias(pref);
    pedido.setVoo(aeroporto && voo.trim() ? voo.trim() : null);
    router.back();
  }

  const escolha = <K extends keyof Preferencias>(campo: K, opcoes: { v: Preferencias[K]; nome: string }[]) => (
    <View style={s.segmentos}>
      {opcoes.map((o) => {
        const ativo = pref[campo] === o.v;
        return (
          <Pressable key={String(o.v)} onPress={() => setPref((p) => ({ ...p, [campo]: ativo ? null : o.v }))} style={[s.segmento, ativo && s.segmentoAtivo]}>
            <Text style={[s.textoSegmento, ativo && s.textoSegmentoAtivo]}>{o.nome}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{soPreferencias ? t('Preferências da viagem') : t('Opções da viagem')}</Text>
      </View>
      <FecharTeclado style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          {!soPreferencias && (
          <>
          <Text style={s.secao}>{t('Quem vai no carro?')}</Text>
          <View style={s.segmentos}>
            {[false, true].map((outro) => (
              <Pressable key={String(outro)} onPress={() => setParaOutro(outro)} style={[s.segmento, paraOutro === outro && s.segmentoAtivo]}>
                <Text style={[s.textoSegmento, paraOutro === outro && s.textoSegmentoAtivo]}>{outro ? t('Outra pessoa') : t('Eu')}</Text>
              </Pressable>
            ))}
          </View>
          {paraOutro && (
            <>
              <Text style={s.ajuda}>{t('O motorista liga a esta pessoa, e ela recebe o código de recolha por SMS. Tu pagas e acompanhas a viagem.')}</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder={t('Nome de quem vai')} placeholderTextColor={cores.textSecondary} style={s.campo} />
              <TextInput
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder={t('Telemóvel, ex.: 84 123 4567')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              {telefone.length > 0 && !telefoneValido && <Text style={s.erro}>{t('Número móvel moçambicano, ex.: 84 123 4567.')}</Text>}
            </>
          )}
          </>
          )}

          {aeroporto && (
            <>
              <Text style={s.secao}>{t('Número do voo')}</Text>
              <Text style={s.ajuda}>{t('O motorista acompanha o voo. Se atrasar, espera por ti: tens {min} minutos grátis depois de aterrar.', { min: ESPERA_AEROPORTO_MIN })}</Text>
              <TextInput
                value={voo}
                onChangeText={(v) => setVoo(normalizarVoo(v))}
                autoCapitalize="characters"
                placeholder={t('Ex.: TM 101')}
                placeholderTextColor={cores.textSecondary}
                style={s.campo}
              />
              {!vooValido && <Text style={s.erro}>{t('Escreve as letras da companhia e o número, ex.: TM 101.')}</Text>}
            </>
          )}

          <Text style={s.secao}>{t('Crianças e acessibilidade')}</Text>
          <Text style={s.ajuda}>{t('O motorista vê isto no pedido e traz o que precisas.')}</Text>
          <Text style={s.rotulo}>{t('Cadeirinhas de criança')}</Text>
          <View style={s.segmentos}>
            {Array.from({ length: MAX_CADEIRINHAS + 1 }, (_, n) => {
              const ativo = (pref.cadeirinhas ?? 0) === n;
              return (
                <Pressable key={n} onPress={() => setPref((p) => ({ ...p, cadeirinhas: n }))} style={[s.segmento, ativo && s.segmentoAtivo]} accessibilityState={{ selected: ativo }}>
                  <Text style={[s.textoSegmento, ativo && s.textoSegmentoAtivo]}>{n === 0 ? t('Nenhuma') : String(n)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Linha s={s} titulo={t('Cadeira de rodas')} texto={t('Dobrável. O motorista ajuda a entrar e guarda-a na bagageira')}>
            <Switch value={pref.cadeiraRodas === true} onValueChange={(v) => setPref((p) => ({ ...p, cadeiraRodas: v }))} />
          </Linha>

          <Text style={s.secao}>{t('Preferências')}</Text>
          <Text style={s.ajuda}>{t('Ficam guardadas para as próximas viagens. O motorista vê-as no pedido.')}</Text>
          <Linha s={s} titulo={t('Viagem em silêncio')} texto={t('O motorista só fala se for preciso')}>
            <Switch value={pref.silencio} onValueChange={(v) => setPref((p) => ({ ...p, silencio: v }))} />
          </Linha>
          <Linha s={s} titulo={t('Ajuda com as malas')} texto={t('O motorista sai do carro para ajudar')}>
            <Switch value={pref.ajudaMalas} onValueChange={(v) => setPref((p) => ({ ...p, ajudaMalas: v }))} />
          </Linha>
          <Text style={s.rotulo}>{t('Temperatura')}</Text>
          {escolha('temperatura', [
            { v: 'fresco', nome: t('Fresco') },
            { v: 'normal', nome: t('Normal') },
            { v: 'quente', nome: t('Pouco ar') },
          ])}
          <Text style={s.rotulo}>{t('Música')}</Text>
          {escolha('musica', [
            { v: 'sem', nome: t('Sem música') },
            { v: 'baixa', nome: t('Música baixa') },
          ])}

          <View style={{ height: Spacing.three }} />
          <BotaoPrincipal texto={t('Guardar')} desativado={!passageiroValido || !vooValido} onPress={guardar} />
        </ScrollView>
      </FecharTeclado>
    </SafeAreaView>
  );
}

function Linha({ s, titulo, texto, children }: { s: ReturnType<typeof estilos>; titulo: string; texto: string; children: ReactNode }) {
  return (
    <View style={s.linha}>
      <View style={{ flex: 1 }}>
        <Text style={s.nome}>{titulo}</Text>
        <Text style={s.ajuda}>{texto}</Text>
      </View>
      {children}
    </View>
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
    ajuda: { color: c.textSecondary, fontSize: 13 },
    erro: { color: '#DC2626', fontSize: 13 },
    campo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, color: c.text, fontSize: 16 },
    segmentos: { flexDirection: 'row', backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: 4 },
    segmento: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    segmentoAtivo: { backgroundColor: c.background },
    textoSegmento: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    textoSegmentoAtivo: { color: c.text, fontWeight: '800' },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three },
    nome: { color: c.text, fontSize: 15, fontWeight: '700' },
  });
}
