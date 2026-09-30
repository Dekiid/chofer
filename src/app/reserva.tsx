import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora, mesmoDia, reservaQueOcupa } from '@/data/agenda';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { precoCasamento } from '@/data/casamento';
import { diaria, diasReservaveis, fimReserva, horasLivres, MAX_DIAS, textoDias, totalReserva } from '@/data/reserva';
import { useAgenda } from '@/state/agenda';
import { usePedido } from '@/state/pedido';
import { Text } from '@/components/texto';

/** Aluguer e casamento: o mesmo fluxo das viagens, mas pago à diária. Local, dia, hora, dias, pagamento. */
export default function ReservaEcra() {
  const cores = usePalette();
  const s = estilos(cores);
  const pedido = usePedido();
  const { reservas } = useAgenda();
  const { reserva, viatura, origem } = pedido;
  const agora = new Date();
  const dias = diasReservaveis(agora);
  // Abre no primeiro dia com horas livres (à noite, hoje já não tem).
  const [dia, setDia] = useState(
    () => reserva?.inicio ?? dias.find((d) => horasLivres(d, viatura.id, reserva?.dias ?? 1, reservas, agora).some((h) => h.livre)) ?? dias[0],
  );

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
            {casamento ? 'Reservar para casamento' : 'Alugar'}
          </Text>
          <Text style={s.secundario} numberOfLines={1}>
            {nomeViatura(viatura)} · {formatarMzn(diaria(viatura, reserva))}/dia
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.conteudo}>
        {casamento && viatura.casamento && (
          <>
            <Text style={s.pergunta}>Decoração</Text>
            <View style={s.opcoes}>
              {(['com', 'sem'] as const).map((d) => (
                <Pressable key={d} onPress={() => mudar({ decoracao: d })} style={[s.opcao, reserva.decoracao === d && s.opcaoAtiva]}>
                  <Text style={[s.textoOpcao, reserva.decoracao === d && s.textoOpcaoAtiva]}>{d === 'com' ? 'Com decoração' : 'Sem decoração'}</Text>
                  <Text style={[s.precoOpcao, reserva.decoracao === d && s.textoOpcaoAtiva]}>{formatarMzn(precoCasamento(viatura.casamento!, d))}/dia</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={s.pergunta}>{casamento ? 'Onde o motorista vai buscar os noivos?' : 'Onde entregamos o carro?'}</Text>
        <Pressable onPress={() => router.push({ pathname: '/destino', params: { campo: 'origem', para: 'reserva' } })} style={s.linhaLocal}>
          <View style={s.pontoRecolha} />
          <Text style={s.local} numberOfLines={1}>
            {origem.nome}
          </Text>
          <Text style={s.mudar}>Mudar</Text>
        </Pressable>

        <Text style={s.pergunta}>Quantos dias?</Text>
        <View style={s.contador}>
          <Pressable onPress={() => mudar({ dias: Math.max(1, reserva.dias - 1) })} style={s.botaoContador} disabled={reserva.dias <= 1} accessibilityLabel="Menos um dia">
            <Text style={[s.sinal, reserva.dias <= 1 && { opacity: 0.3 }]}>−</Text>
          </Pressable>
          <Text style={s.numeroDias}>{textoDias(reserva.dias)}</Text>
          <Pressable onPress={() => mudar({ dias: Math.min(MAX_DIAS, reserva.dias + 1) })} style={s.botaoContador} disabled={reserva.dias >= MAX_DIAS} accessibilityLabel="Mais um dia">
            <Text style={s.sinal}>+</Text>
          </Pressable>
        </View>

        <Text style={s.pergunta}>{casamento ? 'Dia do casamento' : 'Dia da entrega'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila} style={{ flexGrow: 0, flexShrink: 0 }}>
          {dias.map((d) => {
            // Um dia sem nenhuma hora livre fica riscado.
            const cheio = !horasLivres(d, viatura.id, reserva.dias, reservas, agora).some((h) => h.livre);
            const ativo = mesmoDia(d, dia);
            return (
              <Pressable key={d.getTime()} onPress={() => setDia(d)} style={[s.chip, ativo && s.chipAtivo]}>
                <Text style={[s.textoChip, ativo && s.textoChipAtivo, cheio && s.riscado]}>{formatarDia(d, agora)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={s.pergunta}>{casamento ? 'Hora da recolha' : 'Hora da entrega'}</Text>
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
        {!horas.some((h) => h.livre) && <Text style={s.aviso}>O carro não está livre neste dia para {textoDias(reserva.dias)}. Escolhe outro dia.</Text>}

        <View style={s.resumo}>
          <Linha s={s} nome={casamento ? 'Carro com motorista' : 'Carro sem motorista'} valor={nomeViatura(viatura)} />
          {casamento && <Linha s={s} nome="Decoração" valor={reserva.decoracao === 'com' ? 'Com decoração' : 'Sem decoração'} />}
          <Linha
            s={s}
            nome={casamento ? 'Recolha' : 'Entrega'}
            valor={reserva.inicio && inicioValido ? `${formatarDia(reserva.inicio, agora)}, ${formatarHora(reserva.inicio)}` : 'Escolhe o dia e a hora'}
          />
          {reserva.inicio && inicioValido && (
            <Linha s={s} nome={casamento ? 'Fim' : 'Devolução'} valor={`${formatarDia(fimReserva(reserva.inicio, reserva.dias), agora)}, ${formatarHora(reserva.inicio)}`} />
          )}
          <Linha s={s} nome="Diária" valor={`${formatarMzn(diaria(viatura, reserva))} × ${textoDias(reserva.dias)}`} />
          <View style={[s.linhaResumo, s.linhaTotal]}>
            <Text style={s.total}>Total</Text>
            <Text style={s.total}>{formatarMzn(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.rodape}>
        <BotaoPrincipal texto={casamento ? 'Reservar e pagar' : 'Alugar e pagar'} escuro onPress={() => router.push('/pagamento')} desativado={!inicioValido} />
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
