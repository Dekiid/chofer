import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarDia, formatarHora } from '@/data/agenda';
import { useAgenda } from '@/state/agenda';
import { useConta } from '@/state/conta';
import { useInscricoes } from '@/state/inscricoes';
import { Text } from '@/components/texto';

// Área da equipa. No protótipo fica na app; no produto final passa para o painel de gestão.
export default function Gestao() {
  const cores = usePalette();
  const s = estilos(cores);
  const { notificacoes, marcarLidas } = useAgenda();
  const pendentes = useInscricoes().inscricoes.filter((i) => i.estado === 'pendente').length;
  // Avaliações dos clientes por motorista, para decidir quem continua na plataforma.
  const porMotorista = new Map<string, { nome: string; matricula: string; estrelas: number[]; notas: string[] }>();
  for (const v of useConta().viagens) {
    if (!v.avaliacao) continue;
    const m = porMotorista.get(v.motorista.matricula) ?? { nome: v.motorista.nome, matricula: v.motorista.matricula, estrelas: [], notas: [] };
    m.estrelas.push(v.avaliacao.estrelas);
    m.notas.push(...v.avaliacao.elogios, ...(v.avaliacao.comentario ? [`«${v.avaliacao.comentario}»`] : []));
    porMotorista.set(v.motorista.matricula, m);
  }

  // Ao sair, as notificações vistas deixam de contar como novas.
  useEffect(() => marcarLidas, [marcarLidas]);

  const agora = new Date();

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>Gestão</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <Pressable onPress={() => router.push('/agenda')} style={s.entrada}>
          <Text style={s.nome}>Agenda das viaturas</Text>
          <Text style={s.secundario}>Horários livres e ocupados de cada carro</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/aprovacoes')} style={s.entrada}>
          <Text style={s.nome}>Aprovar inscrições{pendentes > 0 ? ` (${pendentes})` : ''}</Text>
          <Text style={s.secundario}>Motoristas à espera de aprovação</Text>
        </Pressable>

        <Text style={s.secao}>Avaliações dos motoristas</Text>
        {porMotorista.size === 0 && <Text style={s.secundario}>Ainda não há avaliações.</Text>}
        {[...porMotorista.values()].map((m) => {
          const media = m.estrelas.reduce((a, b) => a + b, 0) / m.estrelas.length;
          return (
            <View key={m.matricula} style={[s.notificacao, media < 4 && s.naoLida]}>
              <Text style={s.nome}>
                {m.nome} <Text style={s.secundario}>· {m.matricula}</Text>
              </Text>
              <Text style={s.texto}>
                ★ {media.toFixed(1).replace('.', ',')} em {m.estrelas.length} {m.estrelas.length === 1 ? 'viagem' : 'viagens'}
                {media < 4 ? ' · abaixo de 4, a rever' : ''}
              </Text>
              {m.notas.length > 0 && <Text style={s.secundario}>{[...new Set(m.notas)].slice(0, 6).join(' · ')}</Text>}
            </View>
          );
        })}

        <Text style={s.secao}>Notificações</Text>
        {notificacoes.length === 0 && <Text style={s.secundario}>Sem notificações. Os pedidos imediatos aparecem aqui.</Text>}
        {notificacoes.map((n) => (
          <View key={n.id} style={[s.notificacao, !n.lida && s.naoLida]}>
            <Text style={s.nome}>
              {n.titulo} <Text style={s.secundario}>· {formatarDia(n.criadaEm, agora)}, {formatarHora(n.criadaEm)}</Text>
            </Text>
            <Text style={s.texto}>{n.texto}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.two },
    entrada: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    secao: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
    nome: { color: c.text, fontSize: 16, fontWeight: '700' },
    texto: { color: c.text, fontSize: 14, marginTop: 2 },
    secundario: { color: c.textSecondary, fontSize: 14, fontWeight: '400' },
    notificacao: { borderRadius: Radius.card, padding: Spacing.three, borderWidth: 1, borderColor: c.backgroundSelected },
    naoLida: { borderColor: c.accent, borderLeftWidth: 4 },
  });
}
