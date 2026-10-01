import { useInscricoes } from '@/state/inscricoes';
import { podeConduzir, useSessao } from '@/state/sessao';

/** Se esta conta pode usar o modo motorista, e em que ponto está a inscrição de quem ainda não pode. */
export function useMotoristaAprovado(): { pode: boolean; inscricao: 'nenhuma' | 'pendente' | 'rejeitada' | 'aprovada' } {
  const { perfil } = useSessao();
  const { inscricoes } = useInscricoes();
  const minha = inscricoes.find((i) => i.telefone === perfil?.telefone);
  return { pode: podeConduzir(perfil, inscricoes), inscricao: minha?.estado ?? 'nenhuma' };
}
