import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/texto';
import { BotaoPrincipal, BotaoVoltar } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { usePalette } from '@/constants/use-palette';
import { COMISSAO, formatarMzn } from '@/data/categorias';
import { lerGuardado } from '@/data/guardar';
import { formatarTelefone } from '@/data/motorista';
import { lerViagensDosCarros } from '@/data/servidor-painel';
import type { PedidoMotorista } from '@/data/tempo-real';
import { t } from '@/i18n';
import { formatarNota, useAvaliacoes } from '@/state/avaliacoes';
import { estadoDocumentos, telefoneCondutor, useInscricoes, type Inscricao } from '@/state/inscricoes';
import { ganhoMotorista } from '@/state/modo-motorista';
import { useSessao } from '@/state/sessao';

const DIA = 86_400_000;

/** Uma viagem feita por um carro do dono, com o que o dono recebe. */
type ViagemCarro = { id: string; viaturaId: string; em: Date; ganhoMzn: number; km: number };

/** Segunda-feira desta semana, às 00:00. */
function inicioDaSemana(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

/**
 * Resumo do dono: cada carro que inscreveu, quem o conduz, quanto ganhou hoje e na semana, a nota e os documentos.
 * As viagens vêm do servidor (de todos os telemóveis) e, em testes, também das guardadas neste telemóvel.
 */
export default function Frota() {
  const cores = usePalette();
  const s = estilos(cores);
  const { perfil } = useSessao();
  const { inscricoes } = useInscricoes();
  const avaliacoes = useAvaliacoes();
  const carros = inscricoes.filter((i) => i.telefone === perfil?.telefone);
  const [viagens, setViagens] = useState<ViagemCarro[]>([]);

  const ids = carros.map((c) => c.id).join(',');
  const condutores = [...new Set(carros.map(telefoneCondutor))].join(',');
  useEffect(() => {
    if (!perfil?.telefone) return;
    let ativo = true;
    const meus = new Set(ids.split(','));
    (async () => {
      const lista = new Map<string, ViagemCarro>();
      // Neste telemóvel: as viagens que cada motorista dos meus carros terminou aqui.
      for (const tel of condutores.split(',').filter(Boolean)) {
        const feitas = (await lerGuardado<{ pedido: PedidoMotorista; concluidaEm: Date }[]>(`chauffeur.motorista.${tel}.feitas`)) ?? [];
        for (const f of feitas)
          if (meus.has(f.pedido.viaturaId))
            lista.set(f.pedido.id, { id: f.pedido.id, viaturaId: f.pedido.viaturaId, em: new Date(f.concluidaEm), ganhoMzn: ganhoMotorista(f.pedido), km: f.pedido.km });
      }
      // No servidor: as viagens concluídas de todos os telemóveis.
      for (const v of await lerViagensDosCarros(perfil.telefone)) {
        if (v.estado !== 'concluida' || lista.has(v.id)) continue;
        const preco = (v.dados.precoMzn ?? v.total_mzn) - (v.dados.descontoMzn ?? 0);
        lista.set(v.id, { id: v.id, viaturaId: v.viatura_id, em: new Date(v.atualizada_em), ganhoMzn: Math.round(preco * (1 - COMISSAO)) + (v.dados.gorjetaMzn ?? 0), km: v.dados.km ?? 0 });
      }
      if (ativo) setViagens([...lista.values()]);
    })();
    return () => {
      ativo = false;
    };
  }, [perfil?.telefone, ids, condutores]);

  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const semana = inicioDaSemana(agora);
  const soma = (l: ViagemCarro[], desde: number) => {
    const x = l.filter((v) => v.em.getTime() >= desde);
    return { n: x.length, mzn: x.reduce((t, v) => t + v.ganhoMzn, 0), km: x.reduce((t, v) => t + v.km, 0) };
  };
  const totalHoje = soma(viagens, hoje);
  const totalSemana = soma(viagens, semana);
  const aprovados = carros.filter((c) => c.estado === 'aprovada').length;

  return (
    <SafeAreaView style={s.ecra} edges={['top', 'bottom']}>
      <View style={s.cabecalho}>
        <BotaoVoltar onPress={() => router.back()} />
        <Text style={s.titulo}>{t('Os meus carros')}</Text>
      </View>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.cartao}>
          <Text style={s.secundario}>{t('Esta semana, todos os carros')}</Text>
          <Text style={s.total}>{formatarMzn(totalSemana.mzn)}</Text>
          <Text style={s.secundario}>
            {totalSemana.n === 1 ? t('{n} viagem', { n: totalSemana.n }) : t('{n} viagens', { n: totalSemana.n })} · {t('hoje {valor}', { valor: formatarMzn(totalHoje.mzn) })} ·{' '}
            {aprovados === 1 ? t('{n} carro ativo', { n: aprovados }) : t('{n} carros ativos', { n: aprovados })}
          </Text>
        </View>

        {carros.map((c) => (
          <Carro
            key={c.id}
            c={c}
            s={s}
            hoje={soma(viagens.filter((v) => v.viaturaId === c.id), hoje)}
            semana={soma(viagens.filter((v) => v.viaturaId === c.id), semana)}
            nota={avaliacoes.mediaMotorista(telefoneCondutor(c))}
            euConduzo={telefoneCondutor(c) === perfil?.telefone}
          />
        ))}

        <BotaoPrincipal texto={t('Inscrever outro carro')} onPress={() => router.push('/inscricao')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Carro({
  c,
  s,
  hoje,
  semana,
  nota,
  euConduzo,
}: {
  c: Inscricao;
  s: ReturnType<typeof estilos>;
  hoje: { n: number; mzn: number };
  semana: { n: number; mzn: number; km: number };
  nota: { media: number; n: number } | null;
  euConduzo: boolean;
}) {
  const documentos = estadoDocumentos(c.validades);
  const mal = documentos.filter((d) => d.estado === 'expirado' || d.estado === 'em_falta');
  const aExpirar = documentos.filter((d) => d.estado === 'a_expirar');
  const estado = { pendente: [t('À espera de aprovação'), '#B45309'], aprovada: [t('Aprovado'), '#15803D'], rejeitada: [t('Não aprovado'), '#DC2626'] }[c.estado];
  return (
    <View style={s.cartao}>
      <View style={s.linha}>
        <View style={{ flex: 1 }}>
          <Text style={s.nome}>
            {c.marca} {c.modelo}
          </Text>
          <Text style={s.secundario}>
            {c.matricula} · {formatarMzn(c.porKmMzn)}/km
          </Text>
        </View>
        <Text style={[s.estado, { color: estado[1] }]}>{estado[0]}</Text>
      </View>

      <View style={s.linha}>
        <Text style={[s.secundario, { flex: 1 }]}>
          {euConduzo ? t('Conduzido por ti') : t('Conduzido por {nome}', { nome: c.motorista?.nome ?? '' })}
          {nota ? ` · ★ ${formatarNota(nota.media)} (${nota.n})` : ` · ${t('ainda sem avaliações')}`}
        </Text>
        {!euConduzo && c.motorista && (
          <Pressable onPress={() => Linking.openURL(`tel:${c.motorista!.telefone}`)} hitSlop={8} accessibilityLabel={t('Ligar a {nome}', { nome: c.motorista.nome })}>
            <Text style={s.ligacao}>{t('Ligar')}</Text>
          </Pressable>
        )}
      </View>
      {!euConduzo && c.motorista && <Text style={s.secundario}>{formatarTelefone(c.motorista.telefone)}</Text>}

      <View style={s.numeros}>
        <View style={s.numero}>
          <Text style={s.secundario}>{t('Hoje')}</Text>
          <Text style={s.valor}>{formatarMzn(hoje.mzn)}</Text>
          <Text style={s.secundario}>{hoje.n === 1 ? t('{n} viagem', { n: hoje.n }) : t('{n} viagens', { n: hoje.n })}</Text>
        </View>
        <View style={s.numero}>
          <Text style={s.secundario}>{t('Esta semana')}</Text>
          <Text style={s.valor}>{formatarMzn(semana.mzn)}</Text>
          <Text style={s.secundario}>
            {semana.n === 1 ? t('{n} viagem', { n: semana.n }) : t('{n} viagens', { n: semana.n })} · {semana.km.toFixed(0)} km
          </Text>
        </View>
      </View>

      <Text style={[s.secundario, mal.length > 0 ? { color: '#DC2626', fontWeight: '700' } : aExpirar.length > 0 ? { color: '#B45309', fontWeight: '700' } : null]}>
        {mal.length > 0
          ? t('Documentos: {docs} fora de validade. O carro não pode ficar online.', { docs: mal.map((d) => t(d.nome)).join(', ') })
          : aExpirar.length > 0
            ? t('Documentos: {docs} a expirar em breve.', { docs: aExpirar.map((d) => t(d.nome)).join(', ') })
            : t('Documentos em dia.')}
      </Text>
    </View>
  );
}

function estilos(c: Palette) {
  return StyleSheet.create({
    ecra: { flex: 1, backgroundColor: c.background },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
    titulo: { color: c.text, fontSize: 20, fontWeight: '700' },
    conteudo: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
    cartao: { backgroundColor: c.backgroundElement, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
    total: { color: c.text, fontSize: 34, fontWeight: '800' },
    linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    nome: { color: c.text, fontSize: 17, fontWeight: '800' },
    estado: { fontSize: 13, fontWeight: '800' },
    secundario: { color: c.textSecondary, fontSize: 13 },
    nota: { color: c.textSecondary, fontSize: 12, fontStyle: 'italic' },
    ligacao: { color: c.text, fontWeight: '800', textDecorationLine: 'underline' },
    numeros: { flexDirection: 'row', gap: Spacing.two },
    numero: { flex: 1, backgroundColor: c.background, borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
    valor: { color: c.text, fontSize: 20, fontWeight: '800' },
  });
}
