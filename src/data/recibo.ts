import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatarDia, formatarHora } from '@/data/agenda';
import { formatarMzn } from '@/data/categorias';
import { totalPago, type Faturacao, type ViagemFeita } from '@/state/conta';
import { PAGAMENTOS } from '@/state/pedido';
import { t } from '@/i18n';
import { nomeLugar } from '@/data/lugares';

export const eReserva = (v: ViagemFeita) => v.tipo === 'aluguer' || v.tipo === 'casamento';
/** "Aluguer", "Casamento com decoração" ou "Casamento sem decoração". */
export const descricaoReserva = (v: ViagemFeita) => (v.tipo === 'aluguer' ? t('Aluguer') : v.decoracao === 'com' ? t('Casamento com decoração') : t('Casamento sem decoração'));

export const nomePagamento = (v: ViagemFeita) => {
  const nome = PAGAMENTOS.find((p) => p.id === v.pagamento)?.nome;
  return nome ? t(nome) : v.pagamento;
};
export const numeroRecibo = (v: ViagemFeita) => `CH-${v.criadaEm.getFullYear()}-${v.id.replace(/\D/g, '').slice(-6).padStart(6, '0')}`;

/** Linhas do recibo, pela ordem: o que o cliente pagou e porquê. */
export function linhasRecibo(v: ViagemFeita): { nome: string; valor: number }[] {
  const dias = v.dias ?? 1;
  const linhas = eReserva(v)
    ? [{ nome: `${descricaoReserva(v)} · ${dias} × ${formatarMzn(v.precoMzn / dias)}`, valor: v.precoMzn }]
    : [{ nome: t('Viagem · {km} km', { km: v.km.toFixed(1).replace('.', ',') }), valor: v.precoMzn - v.taxaImediatoMzn }];
  if (v.taxaImediatoMzn) linhas.push({ nome: t('Taxa de pedido imediato'), valor: v.taxaImediatoMzn });
  const club = v.descontoClubMzn ?? 0;
  const promo = v.descontoMzn - club;
  if (promo) linhas.push({ nome: v.promo ? t('Desconto ({codigo})', { codigo: v.promo }) : t('Desconto'), valor: -promo });
  if (club) linhas.push({ nome: t('Chauffeur Club'), valor: -club });
  if (v.gorjetaMzn) linhas.push({ nome: t('Gorjeta para o motorista'), valor: v.gorjetaMzn });
  return linhas;
}

/** Como foi pago o total: carteira, partes dos amigos e o resto pelo método escolhido. Vazio quando foi tudo por um método. */
export function linhasPagamento(v: ViagemFeita): { nome: string; valor: number }[] {
  if (v.estado === 'cancelada' || (!v.carteiraMzn && !v.divisao?.length)) return [];
  const linhas: { nome: string; valor: number }[] = [];
  if (v.carteiraMzn) linhas.push({ nome: t('Carteira Chauffeur'), valor: v.carteiraMzn });
  for (const p of v.divisao ?? []) linhas.push({ nome: p.paga ? t('Parte de {nome}', { nome: p.nome }) : t('Parte de {nome} (por pagar)', { nome: p.nome }), valor: p.valorMzn });
  const resto = totalPago(v) - linhas.reduce((t, l) => t + l.valor, 0);
  if (resto > 0) linhas.push({ nome: nomePagamento(v), valor: resto });
  return linhas;
}

/** Para a frase «pago por …»: o método, a carteira, ou os dois. */
export function pagoPor(v: ViagemFeita): string {
  const linhas = linhasPagamento(v);
  if (linhas.length === 0) return nomePagamento(v);
  const metodo = linhas.some((l) => l.nome === nomePagamento(v));
  return v.carteiraMzn && metodo ? t('{a} e {b}', { a: t('Carteira Chauffeur'), b: nomePagamento(v) }) : v.carteiraMzn ? t('Carteira Chauffeur') : nomePagamento(v);
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function html(v: ViagemFeita, faturacao: Faturacao | null): string {
  const agora = new Date();
  const percurso = (eReserva(v) ? [v.origem] : [v.origem, ...v.paragens, v.destino]).map((l) => `<li>${escapar(nomeLugar(l))}</li>`).join('');
  const linhas = linhasRecibo(v)
    .map((l) => `<tr><td>${escapar(l.nome)}</td><td class="v">${l.valor < 0 ? '−' : ''}${formatarMzn(Math.abs(l.valor))}</td></tr>`)
    .join('');
  const pagamento = linhasPagamento(v)
    .map((l) => `<tr><td class="cinza">${escapar(l.nome)}</td><td class="v cinza">${formatarMzn(l.valor)}</td></tr>`)
    .join('');
  const cliente = faturacao
    ? `<p class="cinza">${escapar(t('Cliente'))}: ${escapar(faturacao.nome)} · NUIT ${escapar(faturacao.nuit)}${faturacao.morada ? ` · ${escapar(faturacao.morada)}` : ''}</p>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#000;padding:32px;max-width:560px;margin:auto}
    .marca{font-size:28px;font-weight:800;letter-spacing:-.5px}.marca span{color:#22C55E}
    h1{font-size:18px;margin:24px 0 4px}.cinza{color:#5E6360;font-size:13px}
    ul{padding-left:18px;margin:8px 0 16px}table{width:100%;border-collapse:collapse;margin-top:12px}
    td{padding:8px 0;border-bottom:1px solid #EEF1EF;font-size:14px}.v{text-align:right}
    .total td{font-weight:800;font-size:18px;border-bottom:none;padding-top:14px}
  </style></head><body>
    <div class="marca">chauffeur<span>.</span></div>
    <h1>${escapar(t('Recibo {numero}', { numero: numeroRecibo(v) }))}</h1>
    <div class="cinza">${escapar(formatarDia(v.recolhaEm, agora))}, ${formatarHora(v.recolhaEm)} · ${escapar(v.viatura)} · ${escapar(v.motorista.nome)} (${escapar(v.motorista.matricula)})</div>
    ${cliente}
    <ul>${percurso}</ul>
    <table>${linhas}<tr class="total"><td>${escapar(t('Total pago'))}</td><td class="v">${formatarMzn(totalPago(v))}</td></tr>${pagamento}</table>
    <p class="cinza">${escapar(t('Pago por {pagamento}. A gorjeta vai toda para o motorista.', { pagamento: pagoPor(v) }))}</p>
  </body></html>`;
}

/** Gera o PDF do recibo e abre a folha de partilha (guardar, WhatsApp, e-mail). Na web abre a impressão. */
export async function partilharRecibo(v: ViagemFeita, faturacao: Faturacao | null = null) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: html(v, faturacao) });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: html(v, faturacao) });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('Recibo Chauffeur') });
}
