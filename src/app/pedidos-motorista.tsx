import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { nomeLugar } from '@/data/lugares';
import { TEMPO_REAL_ATIVO, type PedidoMotorista } from '@/data/tempo-real';
import { ganhoMotorista, useModoMotorista } from '@/state/modo-motorista';
import { t } from '@/i18n';
import { etiquetaLembrete } from '@/state/vigia-agenda';

type Separador = 'agendadas' | 'feitas';

/** Todos os pedidos do motorista: reservas agendadas (já pagas e confirmadas) e viagens feitas. */
export default function PedidosMotorista() {
  const cores = usePalette();
  const s = estilos(cores);
  const m = useModoMotorista();
  const [separador, setSeparador] = useState<Separador>('agendadas');

  const separadores: { id: Separador; nome: string; n: number }[] = [
    { id: 'agendadas', nome: 'Agendadas', n: m.agendadas.length },
    { id: 'feitas', nome: 'Feitas', n: m.feitas.length },
  ];

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Pedidos')}</Text>
      </View>

      <View style={s.separadores}>
        {separadores.map((x) => {
          const ativo = separador === x.id;
          return (
            <Pressable key={x.id} onPress={() => setSeparador(x.id)} style={[s.separador, ativo && s.separadorAtivo]}>
              <Text style={[s.textoSeparador, ativo && s.textoSeparadorAtivo]}>
                {t(x.nome)} {x.n > 0 ? `(${x.n})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={s.conteudo}>
        {separador === 'agendadas' && (
          <>
            {m.agendadas.length === 0 && <Text style={s.vazio}>{t('Sem reservas. Quando um cliente marca e paga uma viagem no teu carro, ela aparece aqui, com um aviso.')}</Text>}
            {m.agendadas.map((p) => (
              <Cartao key={p.id} pedido={p} s={s}>
                <Pressable
                  disabled={m.viagem != null}
                  onPress={() => {
                    m.comecarAgendada(p.id);
                    router.back();
                  }}
                  style={[s.botao, { backgroundColor: cores.primary, opacity: m.viagem ? 0.4 : 1 }]}>
                  <Text style={[s.textoBotaoVerde, { color: cores.onPrimary }]}>{m.viagem ? t('Termina a viagem atual primeiro') : t('Começar viagem')}</Text>
                </Pressable>
              </Cartao>
            ))}
            {m.viatura && (
              <Text style={s.ligacao} onPress={() => router.push({ pathname: '/agenda', params: { viatura: m.viatura!.id, meus: '1' } })}>
                {t('Ver a agenda do carro')}
              </Text>
            )}
            {!TEMPO_REAL_ATIVO && m.viatura && (
              <Text style={s.ligacao} onPress={m.simularReserva}>
                {t('Simular uma reserva (demonstração)')}
              </Text>
            )}
          </>
        )}

        {separador === 'feitas' && (
          <>
            {m.feitas.length === 0 && <Text style={s.vazio}>{t('As viagens que terminares aparecem aqui.')}</Text>}
            {m.feitas.map(({ pedido, concluidaEm }) => (
              <Cartao key={pedido.id} pedido={pedido} quando={t('Concluída às {hora}', { hora: formatarHora(new Date(concluidaEm)) })} s={s} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cartao({ pedido, quando, s, children }: { pedido: PedidoMotorista; quando?: string; s: ReturnType<typeof estilos>; children?: ReactNode }) {
  const data = pedido.recolhaEm ? new Date(pedido.recolhaEm) : null;
  // Faltando um dia ou menos, lembra quanto falta para a recolha.
  const etiqueta = !quando && data ? etiquetaLembrete(data.getTime()) : null;
  return (
    <View style={s.cartao}>
      <View style={s.topoCartao}>
        <Text style={s.quando}>
          {quando ?? (data ? `${formatarDia(data, new Date())}, ${formatarHora(data)}` : t('Para agora'))}
          {etiqueta ? <Text style={{ color: etiqueta.urgente ? '#DC2626' : '#B45309' }}>{` · ${etiqueta.texto}`}</Text> : null}
        </Text>
        <Text style={s.ganho}>{formatarMzn(ganhoMotorista(pedido))}</Text>
      </View>
      <View style={s.linha}>
        <View style={s.pontoRecolha} />
        <Text style={s.local} numberOfLines={1}>
          {nomeLugar(pedido.origem)}
        </Text>
      </View>
      {pedido.paragens.map((p, i) => (
        <View key={i} style={s.linha}>
          <View style={s.pontoParagem} />
          <Text style={s.local} numberOfLines={1}>
            {nomeLugar(p)}
          </Text>
        </View>
      ))}
      <View style={s.linha}>
        <View style={s.pontoDestino} />
        <Text style={s.local} numberOfLines={1}>
          {nomeLugar(pedido.destino)}
        </Text>
      </View>
      <Text style={s.detalhe}>
        {t('{km} km · {min} min · pago por {pagamento}', { km: pedido.km.toFixed(1).replace('.', ','), min: pedido.minutos, pagamento: t(pedido.pagamento) })}
      </Text>
      {children}
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    separadores: { flexDirection: 'row', marginHorizontal: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.pill, padding: 4 },
    separador: { flex: 1, paddingVertical: Spacing.two, borderRadius: Radius.pill, alignItems: 'center' },
    separadorAtivo: { backgroundColor: c.background },
    textoSeparador: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    textoSeparadorAtivo: { color: c.text, fontWeight: '800' },
    conteudo: { padding: Spacing.three, gap: Spacing.three },
    vazio: { color: c.textSecondary, textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.four },
    ligacao: { color: c.text, fontWeight: '700', textDecorationLine: 'underline', textAlign: 'center', marginTop: Spacing.two },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
    topoCartao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    quando: { color: c.text, fontSize: 15, fontWeight: '800' },
    ganho: { color: c.text, fontSize: 20, fontWeight: '800' },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    local: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
    pontoRecolha: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.go },
    pontoDestino: { width: 9, height: 9, backgroundColor: c.text },
    pontoParagem: { width: 9, height: 9, borderWidth: 2, borderColor: c.text },
    detalhe: { color: c.textSecondary, fontSize: 13 },
    botao: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.two + 4, alignItems: 'center', marginTop: Spacing.one },
    textoBotaoVerde: { color: '#000000', fontSize: 15, fontWeight: '800' },
  });
}
