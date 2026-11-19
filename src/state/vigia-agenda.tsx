import { useEffect, useMemo, useState } from 'react';

import { formatarDia, formatarHora } from '@/data/agenda';
import { agendarNoTelemovel, cancelarNoTelemovel } from '@/data/avisos-telemovel';
import { useGuardado } from '@/data/guardar';
import { nomeLugar } from '@/data/lugares';
import { t } from '@/i18n';
import { useAgenda } from '@/state/agenda';
import { useConta } from '@/state/conta';
import { telefoneCondutor, useInscricoes } from '@/state/inscricoes';
import { useModoMotorista } from '@/state/modo-motorista';
import { usePedido } from '@/state/pedido';
import { useSessao } from '@/state/sessao';

// O dono (ou o motorista indicado) é avisado quando um cliente agenda o seu carro,
// um dia antes e uma hora antes da recolha (pedido do Flavio, 2026-10-01).
const DIA = 86_400_000;
const HORA = 3_600_000;
// Um lembrete visto pela app já depois desta folga não aparece: o aviso do sistema já tinha chegado com a app fechada.
const FOLGA = 15 * 60_000;
const INICIO = '__inicio';

export type ReservaMinha = { id: string; viaturaId: string; viaturaNome: string; recolhaEm: number; origem: string; destino: string };

/** Os carros desta conta: os que inscreveu, os que conduz e o que escolheu no modo motorista. */
export function useMeusCarros(): string[] {
  const { perfil } = useSessao();
  const { inscricoes } = useInscricoes();
  const m = useModoMotorista();
  const tel = perfil?.telefone;
  return useMemo(() => {
    if (!tel) return [];
    const ids = inscricoes.filter((i) => i.telefone === tel || telefoneCondutor(i) === tel).map((i) => i.id);
    if (m.viatura && !ids.includes(m.viatura.id)) ids.push(m.viatura.id);
    return ids;
  }, [tel, inscricoes, m.viatura]);
}

/** As reservas por fazer dos carros desta conta. */
export function useReservasMinhas(): ReservaMinha[] {
  const { perfil } = useSessao();
  const { reservas } = useAgenda();
  const { viaturas } = usePedido();
  const m = useModoMotorista();
  const meusCarros = useMeusCarros();
  const tel = perfil?.telefone;
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    if (!tel) return [];
    const meus = new Set(meusCarros);
    const nome = (id: string) => {
      const v = viaturas.find((x) => x.id === id);
      return v ? `${v.marca} ${v.modelo}` : id;
    };
    const lista = new Map<string, ReservaMinha>();
    for (const r of reservas) {
      // As reservas de exemplo (sem servidor) não são de nenhum cliente.
      if (r.tipo !== 'agendada' || r.id.startsWith('ex-') || !meus.has(r.viaturaId) || r.inicio.getTime() < agora) continue;
      lista.set(r.id, {
        id: r.id,
        viaturaId: r.viaturaId,
        viaturaNome: r.pedido?.viaturaNome ?? nome(r.viaturaId),
        recolhaEm: r.inicio.getTime(),
        origem: r.pedido ? nomeLugar(r.pedido.origem) : '',
        destino: r.pedido ? nomeLugar(r.pedido.destino) : (r.destino ?? ''),
      });
    }
    // Reservas que chegaram em direto ao modo motorista (também as simuladas da demonstração).
    for (const p of m.agendadas) {
      if (!p.recolhaEm || lista.has(p.id) || new Date(p.recolhaEm).getTime() < agora) continue;
      lista.set(p.id, { id: p.id, viaturaId: p.viaturaId, viaturaNome: p.viaturaNome, recolhaEm: new Date(p.recolhaEm).getTime(), origem: nomeLugar(p.origem), destino: nomeLugar(p.destino) });
    }
    return [...lista.values()].sort((a, b) => a.recolhaEm - b.recolhaEm);
  }, [tel, meusCarros, reservas, viaturas, m.agendadas, agora]);
}

/** O que falta para a recolha, para mostrar ao lado da reserva. */
export function etiquetaLembrete(recolhaEm: number, agora = Date.now()): { texto: string; urgente: boolean } | null {
  const falta = recolhaEm - agora;
  if (falta <= 0) return null;
  if (falta <= HORA) return { texto: t('Daqui a {n} min', { n: Math.max(1, Math.round(falta / 60_000)) }), urgente: true };
  if (falta <= DIA) return { texto: t('Daqui a {n} h', { n: Math.round(falta / HORA) }), urgente: false };
  return null;
}

const textoReserva = (r: ReservaMinha) =>
  `${r.viaturaNome} · ${formatarDia(new Date(r.recolhaEm), new Date())}, ${formatarHora(new Date(r.recolhaEm))}${r.origem ? ` · ${r.origem}` : ''}${r.destino ? ` → ${r.destino}` : ''}`;

/** Fica no fundo da app: avisa as reservas novas e agenda os lembretes de um dia e de uma hora antes. */
export function VigiaAgenda() {
  const { perfil } = useSessao();
  const conta = useConta();
  const minhas = useReservasMinhas();
  // O que já foi avisado, por conta: «id» para a reserva nova, «id:dia» e «id:hora» para os lembretes.
  const [avisadas, setAvisadas, pronto] = useGuardado<string[]>(perfil?.telefone ? `chauffeur.agenda-avisos.${perfil.telefone}` : null, []);
  const [conhecidas, setConhecidas] = useState<string[]>([]);

  useEffect(() => {
    if (!pronto || !perfil?.telefone) return;
    const agora = Date.now();
    const novos: string[] = [];
    // A primeira vez nesta conta, as reservas que já existiam não aparecem como novas.
    const primeiraVez = !avisadas.includes(INICIO);
    if (primeiraVez) novos.push(INICIO);
    for (const r of minhas) {
      if (!avisadas.includes(r.id)) {
        novos.push(r.id);
        if (!primeiraVez) conta.avisar(t('O teu carro foi agendado'), textoReserva(r));
      }
      for (const [chave, antes, titulo] of [
        ['dia', DIA, t('Reserva amanhã')],
        ['hora', HORA, t('Reserva daqui a 1 hora')],
      ] as const) {
        const quando = r.recolhaEm - antes;
        const id = `${r.id}:${chave}`;
        if (avisadas.includes(id)) continue;
        if (quando > agora) {
          // Com a app fechada, avisa o sistema do telemóvel à hora certa.
          agendarNoTelemovel(`agenda-${id}`, quando, titulo, t('Prepara o carro para cumprir a reserva: {reserva}', { reserva: textoReserva(r) }));
          continue;
        }
        novos.push(id);
        // Uma reserva feita há menos de um dia não precisa do lembrete de «amanhã»: o aviso da reserva nova chega.
        if (!primeiraVez && agora - quando < FOLGA && !(chave === 'dia' && novos.includes(r.id))) {
          conta.avisar(titulo, t('Prepara o carro para cumprir a reserva: {reserva}', { reserva: textoReserva(r) }));
        }
      }
    }
    if (novos.length) setAvisadas((l) => [...l, ...novos].slice(-300));
    // Reservas que desapareceram (canceladas): tira os lembretes agendados.
    const ids = minhas.map((r) => r.id);
    const saiu = conhecidas.filter((id) => !ids.includes(id));
    if (saiu.length) cancelarNoTelemovel(saiu.flatMap((id) => [`agenda-${id}:dia`, `agenda-${id}:hora`]));
    if (saiu.length || ids.some((id) => !conhecidas.includes(id))) setConhecidas(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minhas, pronto, perfil?.telefone]);

  return null;
}
