import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora, inicioDoDia, mesmoDia, reservaQueOcupa } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { precoCasamento } from '@/data/casamento';
import { nomeLugar } from '@/data/lugares';
import { diaria, diasAluguer, diasLivres, diasReservaveis, fimReserva, horasLivres, MAX_DIAS, textoDias, totalReserva, ultimoDia } from '@/data/reserva';
import { useAgenda } from '@/state/agenda';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';
import { t } from '@/i18n';

/** Aluguer e casamento: o mesmo fluxo das viagens, mas pago à diária. Local, dia, hora, dias, pagamento. */
export default function ReservaEcra() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { reservas } = useAgenda();
  const { reserva, viatura, origem } = pedido;
  const agora = new Date();
  // O aluguer é por dias inteiros, a partir de amanhã; o casamento continua com a hora da recolha.
  const aluguer = reserva?.modo === 'aluguer';
  const dias = aluguer ? diasAluguer(agora) : diasReservaveis(agora);
  const livreNoDia = (d: Date) =>
    aluguer ? diasLivres(d, viatura.id, reserva?.dias ?? 1, reservas) : horasLivres(d, viatura.id, reserva?.dias ?? 1, reservas, agora).some((h) => h.livre);
  // Abre no primeiro dia livre (à noite, hoje já não tem horas).
  const [dia, setDia] = useState(() => reserva?.inicio ?? dias.find(livreNoDia) ?? dias[0]);
  // No aluguer, o dia escolhido já é a reserva: o carro fica com o cliente desde o início desse dia.
  useEffect(() => {
    if (!aluguer || !reserva) return;
    const inicio = inicioDoDia(dia);
    if (reserva.inicio?.getTime() !== inicio.getTime()) pedido.setReserva({ ...reserva, inicio });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluguer, dia, reserva?.inicio]);

  if (!reserva) return <Redirect href="/" />;
  const casamento = reserva.modo === 'casamento';
  const mudar = (m: Partial<typeof reserva>) => pedido.setReserva({ ...reserva, ...m });

  const horas = horasLivres(dia, viatura.id, reserva.dias, reservas, agora);
  // A hora escolhida pode deixar de estar livre ao mudar o número de dias.
  const inicioValido = reserva.inicio != null && !reservaQueOcupa(reservas, viatura.id, reserva.inicio, fimReserva(reserva.inicio, reserva.dias)) && reserva.inicio > agora;
  const total = totalReserva(viatura, reserva);

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={s.titulo} numberOfLines={1}>
            {casamento ? t('Reservar para casamento') : t('Alugar')}
          </Text>
          <Text style={s.secundario} numberOfLines={1}>
            {nomeViatura(viatura)} · {t('{preco}/dia', { preco: formatarMzn(diaria(viatura, reserva)) })}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.conteudo}>
        {casamento && viatura.casamento && (
          <>
            <Text style={s.pergunta}>{t('Decoração')}</Text>
            <View style={s.opcoes}>
              {(['com', 'sem'] as const).map((d) => (
                <Pressable key={d} onPress={() => mudar({ decoracao: d })} style={[s.opcao, reserva.decoracao === d && s.opcaoAtiva]}>
                  <Text style={[s.textoOpcao, reserva.decoracao === d && s.textoOpcaoAtiva]}>{d === 'com' ? t('Com decoração') : t('Sem decoração')}</Text>
                  <Text style={[s.precoOpcao, reserva.decoracao === d && s.textoOpcaoAtiva]}>{t('{preco}/dia', { preco: formatarMzn(precoCasamento(viatura.casamento!, d)) })}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={s.pergunta}>{casamento ? t('Onde o motorista vai buscar os noivos?') : t('Onde entregamos o carro?')}</Text>
        <Pressable onPress={() => router.push({ pathname: '/destino', params: { campo: 'origem', para: 'reserva' } })} style={s.linhaLocal}>
          <View style={s.pontoRecolha} />
          <Text style={s.local} numberOfLines={1}>
            {nomeLugar(origem)}
          </Text>
          <Text style={s.mudar}>{t('Mudar')}</Text>
        </Pressable>

        <Text style={s.pergunta}>{t('Quantos dias?')}</Text>
        <View style={s.contador}>
          <Pressable onPress={() => mudar({ dias: Math.max(1, reserva.dias - 1) })} style={s.botaoContador} disabled={reserva.dias <= 1} accessibilityLabel={t('Menos um dia')}>
            <Text style={[s.sinal, reserva.dias <= 1 && { opacity: 0.3 }]}>−</Text>
          </Pressable>
          <Text style={s.numeroDias}>{textoDias(reserva.dias)}</Text>
          <Pressable onPress={() => mudar({ dias: Math.min(MAX_DIAS, reserva.dias + 1) })} style={s.botaoContador} disabled={reserva.dias >= MAX_DIAS} accessibilityLabel={t('Mais um dia')}>
            <Text style={s.sinal}>+</Text>
          </Pressable>
        </View>

        <Text style={s.pergunta}>{casamento ? t('Dia do casamento') : t('Primeiro dia do aluguer')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila} style={{ flexGrow: 0, flexShrink: 0 }}>
          {dias.map((d) => {
            // Um dia sem nenhuma hora livre (ou, no aluguer, sem os dias todos livres) fica riscado.
            const cheio = !livreNoDia(d);
            const ativo = mesmoDia(d, dia);
            return (
              <Pressable
                key={d.getTime()}
                onPress={() => setDia(d)}
                style={[s.chip, ativo && s.chipAtivo]}>
                <Text style={[s.textoChip, ativo && s.textoChipAtivo, cheio && s.riscado]}>{formatarDia(d, agora)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {aluguer ? (
          !diasLivres(dia, viatura.id, reserva.dias, reservas) && <Text style={s.aviso}>{t('O carro não está livre em todos estes dias. Escolhe outro dia ou menos dias.')}</Text>
        ) : (
        <>
        <Text style={s.pergunta}>{t('Hora da recolha')}</Text>
        <View style={s.horas}>
          {horas.map(({ inicio, livre }) => {
            const ativo = reserva.inicio?.getTime() === inicio.getTime();
            return (
              <Pressable key={inicio.getTime()} disabled={!livre} onPress={() => mudar({ inicio })} style={[s.hora, ativo && s.chipAtivo, !livre && { opacity: 0.4 }]}>
                <Text style={[s.textoChip, ativo && s.textoChipAtivo, !livre && s.riscado]}>{formatarHora(inicio)}</Text>
              </Pressable>
            );
          })}
        </View>
        {!horas.some((h) => h.livre) && <Text style={s.aviso}>{t('O carro não está livre neste dia para {dias}. Escolhe outro dia.', { dias: textoDias(reserva.dias) })}</Text>}
        </>
        )}

        <View style={s.resumo}>
          <Linha s={s} nome={casamento ? t('Carro com motorista') : t('Carro sem motorista')} valor={nomeViatura(viatura)} />
          {casamento && <Linha s={s} nome={t('Decoração')} valor={reserva.decoracao === 'com' ? t('Com decoração') : t('Sem decoração')} />}
          {aluguer ? (
            <Linha
              s={s}
              nome={t('Dias')}
              valor={
                reserva.inicio && inicioValido
                  ? reserva.dias === 1
                    ? formatarDia(reserva.inicio, agora)
                    : t('{inicio} a {fim}', { inicio: formatarDia(reserva.inicio, agora), fim: formatarDia(ultimoDia(reserva.inicio, reserva.dias), agora) })
                  : t('Escolhe o primeiro dia')
              }
            />
          ) : (
            <>
              <Linha s={s} nome={t('Recolha')} valor={reserva.inicio && inicioValido ? `${formatarDia(reserva.inicio, agora)}, ${formatarHora(reserva.inicio)}` : t('Escolhe o dia e a hora')} />
              {reserva.inicio && inicioValido && <Linha s={s} nome={t('Fim')} valor={`${formatarDia(fimReserva(reserva.inicio, reserva.dias), agora)}, ${formatarHora(reserva.inicio)}`} />}
            </>
          )}
          <Linha s={s} nome={t('Diária')} valor={`${formatarMzn(diaria(viatura, reserva))} × ${textoDias(reserva.dias)}`} />
          <View style={[s.linhaResumo, s.linhaTotal]}>
            <Text style={s.total}>{t('Total')}</Text>
            <Text style={s.total}>{formatarMzn(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.rodape}>
        <BotaoPrincipal texto={casamento ? t('Reservar e pagar') : t('Alugar e pagar')} escuro onPress={() => router.push('/pagamento')} desativado={!inicioValido} />
      </View>
    </SafeAreaView>
  );
}

function Linha({ nome, valor, s }: { nome: string; valor: string; s: ReturnType<typeof estilos> }) {
  return (
    <View style={s.linhaResumo}>
      <Text style={s.secundarioResumo}>{nome}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    secundario: { color: c.textSecondary, fontSize: 14 },
    conteudo: { padding: Spacing.three, paddingTop: Spacing.one },
    pergunta: { color: c.text, fontSize: 17, fontWeight: '700', marginTop: Spacing.three, marginBottom: Spacing.two },
    opcoes: { flexDirection: 'row', gap: Spacing.two },
    opcao: { flex: 1, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, borderWidth: 2, borderColor: 'transparent' },
    opcaoAtiva: { borderColor: c.primary },
    textoOpcao: { color: c.text, fontSize: 15, fontWeight: '600' },
    textoOpcaoAtiva: { fontWeight: '800' },
    precoOpcao: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
    linhaLocal: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.botao, padding: Spacing.three },
    pontoRecolha: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.go },
    local: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
    mudar: { color: c.text, fontWeight: '700', textDecorationLine: 'underline' },
    contador: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    botaoContador: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.backgroundElement, alignItems: 'center', justifyContent: 'center' },
    sinal: { color: c.text, fontSize: 24, fontWeight: '700', marginTop: -2 },
    numeroDias: { color: c.text, fontSize: 18, fontWeight: '800', minWidth: 80, textAlign: 'center' },
    fila: { gap: Spacing.two },
    chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: c.backgroundElement },
    chipAtivo: { backgroundColor: c.primary },
    textoChip: { color: c.text, fontSize: 14, fontWeight: '600' },
    textoChipAtivo: { color: c.onPrimary, fontWeight: '800' },
    riscado: { textDecorationLine: 'line-through' },
    horas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    hora: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: c.backgroundElement, minWidth: 72, alignItems: 'center' },
    aviso: { color: c.textSecondary, fontSize: 13, marginTop: Spacing.two },
    resumo: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.one, marginTop: Spacing.four },
    linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
    linhaTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.backgroundSelected, paddingTop: Spacing.two, marginTop: Spacing.one },
    secundarioResumo: { color: c.textSecondary, fontSize: 15 },
    valor: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    total: { color: c.text, fontSize: 22, fontWeight: '800' },
    rodape: { padding: Spacing.three },
  });
}
