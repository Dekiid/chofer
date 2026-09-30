import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatarDia, formatarHora } from '@/data/agenda';
import { COMISSAO, formatarMzn } from '@/data/categorias';
import { totalPago, type ViagemFeita } from '@/state/conta';
import { PAGAMENTOS } from '@/state/pedido';

export const eReserva = (v: ViagemFeita) => v.tipo === 'aluguer' || v.tipo === 'casamento';
/** "Aluguer", "Casamento com decoração" ou "Casamento sem decoração". */
export const descricaoReserva = (v: ViagemFeita) => (v.tipo === 'aluguer' ? 'Aluguer' : `Casamento ${v.decoracao === 'com' ? 'com' : 'sem'} decoração`);

export const nomePagamento = (v: ViagemFeita) => PAGAMENTOS.find((p) => p.id === v.pagamento)?.nome ?? v.pagamento;
export const numeroRecibo = (v: ViagemFeita) => `CH-${v.criadaEm.getFullYear()}-${v.id.replace(/\D/g, '').slice(-6).padStart(6, '0')}`;

/** Linhas do recibo, pela ordem: o que o cliente pagou e porquê. */
export function linhasRecibo(v: ViagemFeita): { nome: string; valor: number }[] {
  const dias = v.dias ?? 1;
  const linhas = eReserva(v)
    ? [{ nome: `${descricaoReserva(v)} · ${dias} × ${formatarMzn(v.precoMzn / dias)}`, valor: v.precoMzn }]
    : [{ nome: `Viagem · ${v.km.toFixed(1).replace('.', ',')} km`, valor: v.precoMzn - v.taxaImediatoMzn }];
  if (v.taxaImediatoMzn) linhas.push({ nome: 'Taxa de pedido imediato', valor: v.taxaImediatoMzn });
  if (v.descontoMzn) linhas.push({ nome: `Desconto${v.promo ? ` (${v.promo})` : ''}`, valor: -v.descontoMzn });
  if (v.gorjetaMzn) linhas.push({ nome: 'Gorjeta para o motorista', valor: v.gorjetaMzn });
  return linhas;
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function html(v: ViagemFeita): string {
  const agora = new Date();
  const percurso = (eReserva(v) ? [v.origem] : [v.origem, ...v.paragens, v.destino]).map((l) => `<li>${escapar(l.nome)}</li>`).join('');
  const linhas = linhasRecibo(v)
    .map((l) => `<tr><td>${escapar(l.nome)}</td><td class="v">${l.valor < 0 ? '−' : ''}${formatarMzn(Math.abs(l.valor))}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#000;padding:32px;max-width:560px;margin:auto}
    .marca{font-size:28px;font-weight:800;letter-spacing:-.5px}.marca span{color:#22C55E}
    h1{font-size:18px;margin:24px 0 4px}.cinza{color:#5E6360;font-size:13px}
    ul{padding-left:18px;margin:8px 0 16px}table{width:100%;border-collapse:collapse;margin-top:12px}
    td{padding:8px 0;border-bottom:1px solid #EEF1EF;font-size:14px}.v{text-align:right}
    .total td{font-weight:800;font-size:18px;border-bottom:none;padding-top:14px}
  </style></head><body>
    <div class="marca">chauffeur<span>.</span></div>
    <h1>Recibo ${numeroRecibo(v)}</h1>
    <div class="cinza">${escapar(formatarDia(v.recolhaEm, agora))}, ${formatarHora(v.recolhaEm)} · ${escapar(v.viatura)} · ${escapar(v.motorista.nome)} (${escapar(v.motorista.matricula)})</div>
    <ul>${percurso}</ul>
    <table>${linhas}<tr class="total"><td>Total pago</td><td class="v">${formatarMzn(totalPago(v))}</td></tr></table>
    <p class="cinza">Pago por ${escapar(nomePagamento(v))}. A Chauffeur fica com ${Math.round(COMISSAO * 100)}% do valor da viagem; a gorjeta vai toda para o motorista.</p>
  </body></html>`;
}

/** Gera o PDF do recibo e abre a folha de partilha (guardar, WhatsApp, e-mail). Na web abre a impressão. */
export async function partilharRecibo(v: ViagemFeita) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: html(v) });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: html(v) });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Recibo Chauffeur' });
}
