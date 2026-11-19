import { router } from 'expo-router';

import type { Ponto } from '@/components/mapa-tipos';
import { formatarMzn, nomeViatura } from '@/data/categorias';
import { minutosOcupado, somarMin } from '@/data/agenda';
import { MOTORISTA_EXEMPLO } from '@/data/motorista';
import { gerarCodigoRecolha } from '@/data/seguranca';
import { calcularPreco, taxaImediato } from '@/data/viagem';
import { useAgenda } from '@/state/agenda';
import { useConta } from '@/state/conta';
import { PAGAMENTOS, usePedido } from '@/state/pedido';
import { t } from '@/i18n';

const ponto = (p: Ponto): Ponto => ({ latitude: p.latitude, longitude: p.longitude });

/**
 * Pedido para agora, como na Uber: não se paga antes, porque o motorista ainda pode recusar.
 * O carro fica ocupado na agenda, a viagem vai para o histórico por pagar, e o cliente paga no fim.
 * Devolve a mensagem de erro, ou null quando o pedido seguiu.
 */
export function usePedirAgora(): () => Promise<string | null> {
  const pedido = usePedido();
  const agenda = useAgenda();
  const conta = useConta();

  return async () => {
    const { destino, viatura, rota } = pedido;
    if (!destino || !rota) return t('Falta o destino.');
    const id = `v-${Date.now()}`;
    const inicio = new Date();
    const resultado = await agenda.reservar({
      id,
      viaturaId: viatura.id,
      inicio,
      fim: somarMin(inicio, minutosOcupado(rota.minutos, viatura.chegadaMin)),
      tipo: 'imediata',
      destino: destino.nome,
      pontoInicio: ponto(pedido.origem),
      pontoFim: ponto(destino),
    });
    if (!resultado.ok) return resultado.motivo === 'ocupado' ? t('Este carro acabou de ficar ocupado. Escolhe outro ou agenda para mais tarde.') : t('Não foi possível fazer o pedido ({detalhe}).', { detalhe: resultado.detalhe ?? '' });
    const preco = calcularPreco(viatura, rota.km, true);
    conta.registarViagem({
      id,
      passageiro: pedido.passageiro ?? undefined,
      preferencias: conta.preferencias,
      voo: pedido.voo ?? undefined,
      recolhaEm: inicio,
      origem: pedido.origem,
      paragens: pedido.paragens,
      destino,
      viatura: nomeViatura(viatura),
      viaturaId: viatura.id,
      motorista: viatura.motorista ?? MOTORISTA_EXEMPLO,
      km: rota.km,
      minutos: rota.minutos,
      precoMzn: preco,
      taxaImediatoMzn: taxaImediato(viatura, rota.km),
      descontoMzn: 0,
      gorjetaMzn: 0,
      pagamento: pedido.pagamento,
      codigoRecolha: gerarCodigoRecolha(),
      estado: 'em_curso',
      porPagar: true,
      favorito: conta.eFavorito(viatura.motorista?.telefone),
    });
    const metodo = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome ?? '';
    agenda.notificar(
      t('Pedido imediato'),
      t('{viatura} para {destino}, {valor} a pagar no fim por {pagamento}, com taxa de pedido imediato.', { viatura: nomeViatura(viatura), destino: destino.nome, valor: formatarMzn(preco), pagamento: t(metodo) }),
    );
    router.push('/viagem');
    return null;
  };
}
