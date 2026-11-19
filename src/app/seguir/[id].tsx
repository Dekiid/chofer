import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Mapa } from '@/components/mapa';
import { PercursoViagem } from '@/components/percurso-viagem';
import { Text } from '@/components/texto';
import { Painel } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { formatarHora } from '@/data/agenda';
import { lugares } from '@/data/lugares';
import { lerPartilha, type DadosPartilha } from '@/data/partilha';
import { ouvir, TEMPO_REAL_ATIVO } from '@/data/tempo-real';
import { t } from '@/i18n';

// Exemplo para ver a página sem servidor: /seguir/demo.
function exemplo(): DadosPartilha {
  const [destino, origem] = [lugares()[0], lugares()[1]];
  return {
    viagemId: 'demo',
    cliente: 'Flavio',
    motorista: 'Carlos M.',
    viatura: 'BMW Série 5',
    matricula: 'AFK 123 MC',
    origem,
    destino,
    estado: 'em_viagem',
    posicao: { latitude: (origem.latitude + destino.latitude) / 2, longitude: (origem.longitude + destino.longitude) / 2 },
    chegadaPrevista: new Date(Date.now() + 12 * 60000).toISOString(),
    atualizadaEm: new Date().toISOString(),
  };
}

/**
 * Página pública do link de partilha: a família ou um amigo segue a viagem sem ter a app.
 * Lê o resumo guardado pelo telemóvel do cliente e recebe a posição do carro em direto.
 */
export default function Seguir() {
  const cores = usePalette();
  const s = estilos(cores);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dados, setDados] = useState<DadosPartilha | null>(id === 'demo' ? exemplo() : null);
  const [estado, setEstado] = useState<'a_carregar' | 'ok' | 'sem_link'>(id === 'demo' ? 'ok' : 'a_carregar');

  // O resumo de 10 em 10 segundos (estado, chegada); a posição chega em direto pelo canal da viagem.
  useEffect(() => {
    if (id === 'demo') return;
    let ativo = true;
    const ler = () =>
      lerPartilha(id).then((d) => {
        if (!ativo) return;
        if (d) setDados((atual) => (atual?.posicao && d.posicao && atual.atualizadaEm > d.atualizadaEm ? { ...d, posicao: atual.posicao } : d));
        setEstado(d ? 'ok' : 'sem_link');
      });
    ler();
    const t = setInterval(ler, 10000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [id]);

  const viagemId = dados?.viagemId;
  useEffect(() => {
    if (!TEMPO_REAL_ATIVO || !viagemId) return;
    return ouvir((e) => {
      if (e.tipo === 'posicao' && e.id === viagemId) setDados((d) => (d ? { ...d, posicao: e.posicao, atualizadaEm: new Date().toISOString() } : d));
    });
  }, [viagemId]);

  if (!dados) {
    return (
      <SafeAreaView style={[s.ecra, s.centro]}>
        <Logo altura={32} />
        <Text style={s.titulo}>{estado === 'a_carregar' ? t('A abrir a viagem…') : t('Esta viagem já terminou ou o link não é válido.')}</Text>
        {!TEMPO_REAL_ATIVO && <Text style={s.secundario}>{t('Os links de partilha funcionam quando o servidor estiver ligado.')}</Text>}
      </SafeAreaView>
    );
  }

  const fim = dados.estado === 'concluida' || dados.estado === 'cancelada';
  const titulo = {
    a_caminho: t('{motorista} vai buscar {cliente}', { motorista: dados.motorista, cliente: dados.cliente || t('o cliente') }),
    chegou: t('{motorista} chegou à recolha', { motorista: dados.motorista }),
    em_viagem: t('{cliente} está a caminho de {destino}', { cliente: dados.cliente || t('O cliente'), destino: dados.destino.nome }),
    concluida: t('{cliente} chegou ao destino', { cliente: dados.cliente || t('O cliente') }),
    cancelada: t('A viagem foi cancelada'),
  }[dados.estado];
  const recolha = { ...dados.origem, nome: dados.origem.id === 'atual' ? dados.origem.zona : dados.origem.nome };

  return (
    <View style={s.ecra}>
      <Mapa carro={fim ? null : dados.posicao} origem={recolha} destino={dados.destino} seguirCarro={!fim && dados.posicao != null} margemInferior={330} />
      <SafeAreaView edges={['top']} style={s.topo} pointerEvents="none">
        <View style={s.marca}>
          <Logo altura={22} />
        </View>
      </SafeAreaView>
      <Painel>
        <View style={s.estado}>
          <View style={[s.ponto, { backgroundColor: fim ? cores.textSecondary : cores.go }]} />
          <Text style={s.titulo}>{titulo}</Text>
        </View>
        {!fim && dados.chegadaPrevista && (
          <Text style={s.secundario}>{t('Chegada prevista às {hora}', { hora: formatarHora(new Date(dados.chegadaPrevista)) })}</Text>
        )}
        <View style={s.caixa}>
          <View style={{ flex: 1 }}>
            <Text style={s.nome}>{dados.motorista}</Text>
            <Text style={s.secundario}>{dados.viatura}</Text>
          </View>
          <Text style={s.matricula}>{dados.matricula}</Text>
        </View>
        <PercursoViagem origem={recolha} paragens={[]} destino={dados.destino} etapa={dados.estado === 'em_viagem' ? 'destino' : 'recolha'} />
        <Text style={s.nota}>
          {t('Atualizado às {hora}. Esta página atualiza-se sozinha e deixa de funcionar depois da viagem.', { hora: formatarHora(new Date(dados.atualizadaEm)) })}
        </Text>
      </Painel>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    centro: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: Spacing.two },
    marca: { backgroundColor: c.background, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    estado: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    ponto: { width: 10, height: 10, borderRadius: 5 },
    titulo: { color: c.text, fontSize: 20, fontWeight: '800', flexShrink: 1, textAlign: 'left' },
    secundario: { color: c.textSecondary, fontSize: 14, marginTop: Spacing.one },
    caixa: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, marginVertical: Spacing.three },
    nome: { color: c.text, fontSize: 16, fontWeight: '700' },
    matricula: { color: c.text, fontSize: 14, fontWeight: '800', borderWidth: 1.5, borderColor: c.text, borderRadius: 6, paddingHorizontal: Spacing.two, paddingVertical: 2 },
    nota: { color: c.textSecondary, fontSize: 12, marginTop: Spacing.two },
  });
}
