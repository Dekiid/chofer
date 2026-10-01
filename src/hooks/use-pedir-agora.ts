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
    if (!destino || !rota) return 'Falta o destino.';
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
    if (!resultado.ok) return resultado.motivo === 'ocupado' ? 'Este carro acabou de ficar ocupado. Escolhe outro ou agenda para mais tarde.' : `Não foi possível fazer o pedido (${resultado.detalhe}).`;
    const preco = calcularPreco(viatura, rota.km, true);
    conta.registarViagem({
      id,
      recolhaEm: inicio,
      origem: pedido.origem,
      paragens: pedido.paragens,
      destino,
      viatura: nomeViatura(viatura),
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
    });
    const metodo = PAGAMENTOS.find((p) => p.id === pedido.pagamento)?.nome;
    agenda.notificar('Pedido imediato', `${nomeViatura(viatura)} para ${destino.nome}, ${formatarMzn(preco)} a pagar no fim por ${metodo}, com taxa de pedido imediato.`);
    router.push('/viagem');
    return null;
  };
}
