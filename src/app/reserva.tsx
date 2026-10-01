import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, mesmoDia } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { precoCasamento } from '@/data/casamento';
import { nomeLugar } from '@/data/lugares';
import { devolucaoReserva, diaria, diasAluguer, diasLivres, HORA_DEVOLUCAO, HORA_ENTREGA, inicioDias, MAX_DIAS, periodoLivre, textoDias, totalReserva } from '@/data/reserva';
import { useAgenda } from '@/state/agenda';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';
import { t } from '@/i18n';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Aluguer e casamento: o mesmo fluxo das viagens, mas pago à diária. Local, dia, hora, dias, pagamento. */
export default function ReservaEcra() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { reservas } = useAgenda();
  const { reserva, viatura, origem } = pedido;
  const agora = new Date();
  // Aluguer e casamento são por dias inteiros, a partir de amanhã, sem hora (Flavio, 2026-10-01).
  // Só as viagens com motorista são à hora, com a duração calculada pelo mapa.
  const dias = diasAluguer(agora);
  // Regra fixa para todos (Flavio, 2026-10-01): entrega às 10:00 e devolução às 08:00, sem escolha de hora.
  const hora = HORA_ENTREGA;
  const livreNoDia = (d: Date) => diasLivres(d, viatura.id, reserva?.dias ?? 1, reservas, hora);
  // Abre no primeiro dia livre.
  const [dia, setDia] = useState(() => reserva?.inicio ?? dias.find(livreNoDia) ?? dias[0]);
  // O dia escolhido já é a reserva: o carro fica reservado desde o início desse dia.
  useEffect(() => {
    if (!reserva) return;
    const inicio = inicioDias(dia, hora);
    if (reserva.inicio?.getTime() !== inicio.getTime()) pedido.setReserva({ ...reserva, inicio });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, hora, reserva?.inicio]);

  if (!reserva) return <Redirect href="/" />;
  const casamento = reserva.modo === 'casamento';
  const mudar = (m: Partial<typeof reserva>) => pedido.setReserva({ ...reserva, ...m });

  // A hora escolhida pode deixar de estar livre ao mudar o número de dias.
  const inicioValido = reserva.inicio != null && periodoLivre(reservas, viatura.id, reserva.inicio, reserva.dias) && reserva.inicio > agora;
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

        <Text style={s.pergunta}>{casamento ? t('Dia do casamento (primeiro dia)') : t('Primeiro dia do aluguer')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila} style={{ flexGrow: 0, flexShrink: 0 }}>
          {dias.map((d) => {
            // Um dia em que o carro não está livre em todos os dias pedidos fica riscado.
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

        {!diasLivres(dia, viatura.id, reserva.dias, reservas, hora) && <Text style={s.aviso}>{t('O carro não está livre em todos estes dias. Escolhe outro dia ou menos dias.')}</Text>}

        <View style={s.nota}>
          <Text style={s.textoNota}>
            {t('Todos os carros são entregues às {entrega} do primeiro dia e devolvidos às {devolucao} do dia seguinte ao último, para dar tempo à lavagem antes do próximo cliente.', { entrega: hh(HORA_ENTREGA), devolucao: hh(HORA_DEVOLUCAO) })}
          </Text>
        </View>

        <View style={s.resumo}>
          <Linha s={s} nome={casamento ? t('Carro com motorista') : t('Carro sem motorista')} valor={nomeViatura(viatura)} />
          {casamento && <Linha s={s} nome={t('Decoração')} valor={reserva.decoracao === 'com' ? t('Com decoração') : t('Sem decoração')} />}
          <Linha
            s={s}
            nome={casamento ? t('Início') : t('Entrega')}
            valor={reserva.inicio && inicioValido ? t('{dia}, às {hora}', { dia: formatarDia(reserva.inicio, agora), hora: hh(hora) }) : t('Escolhe o primeiro dia')}
          />
          {reserva.inicio && inicioValido && (
            <Linha s={s} nome={t('Devolução')} valor={t('{dia}, às {hora}', { dia: formatarDia(devolucaoReserva(reserva.inicio, reserva.dias), agora), hora: hh(HORA_DEVOLUCAO) })} />
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
    nota: { borderRadius: Radius.card, padding: Spacing.three, backgroundColor: c.backgroundElement },
    textoNota: { color: c.text, fontSize: 13, lineHeight: 18 },
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
