import type { Dados, Reserva } from '@/app/page';

// Países da app. O país de cada linha vem do indicativo do número (+258 Moçambique, +244 Angola),
// como na app. Os valores estão guardados em meticais; em Angola mostram-se em kwanzas.
export type Pais = 'MZ' | 'AO';

export const PAISES: Record<Pais, { nome: string; bandeira: string; simbolo: string; porMetical: number }> = {
  MZ: { nome: 'Moçambique', bandeira: '🇲🇿', simbolo: 'MT', porMetical: 1 },
  // Câmbio provisório, o mesmo da app (src/data/paises.ts).
  AO: { nome: 'Angola', bandeira: '🇦🇴', simbolo: 'Kz', porMetical: 14 },
};

let atual: Pais = 'MZ';
export const paisPainel = () => atual;
export const definirPaisPainel = (p: Pais) => {
  atual = p;
};

export const paisDoTelefone = (tel: string | null | undefined): Pais => (tel?.replace(/\s/g, '').startsWith('+244') ? 'AO' : 'MZ');

/** Só as linhas do país escolhido. Pagamentos DebitoPay são todos de Moçambique (Angola ainda é simulada). */
export function filtrarPais(d: Dados, pais: Pais): Dados {
  const e = (tel: string | null | undefined) => paisDoTelefone(tel) === pais;
  // Uma reserva é do país do cliente; um bloqueio é do país do dono do carro (a frota de exemplo é de Moçambique).
  const daReserva = (r: Reserva) =>
    r.pedido?.clienteTelefone ? e(r.pedido.clienteTelefone) : e(d.inscricoes.find((i) => i.id === r.viatura_id)?.telefone ?? '+258');
  return {
    viagens: d.viagens.filter((v) => e(v.cliente_telefone)),
    inscricoes: d.inscricoes.filter((i) => e(i.telefone)),
    avaliacoes: d.avaliacoes.filter((a) => e(a.telefone)),
    ajuda: d.ajuda.filter((p) => e(p.cliente_telefone)),
    reservas: d.reservas.filter(daReserva),
    pagamentos: d.pagamentos && (pais === 'MZ' ? d.pagamentos : []),
  };
}
