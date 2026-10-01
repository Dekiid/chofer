import type { Dados } from '@/app/page';

// Dados de exemplo para ver o painel sem servidor ("Ver com dados de exemplo").
export function exemplo(): Dados {
  const h = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();
  const lugar = (nome: string) => ({ nome });
  return {
    viagens: [
      { id: 'v1', cliente_telefone: '+258841112233', estado: 'em_curso', total_mzn: 630, viatura: 'BMW Série 5', criada_em: h(0.2), dados: { origem: lugar('Baixa, Maputo'), destino: lugar('Aeroporto Internacional de Maputo'), pagamento: 'M-Pesa', motorista: { nome: 'Carlos M.' }, clienteNome: 'Flavio', km: 7 } },
      { id: 'v2', cliente_telefone: '+258847654321', estado: 'concluida', total_mzn: 1460, viatura: 'Mercedes-Benz Classe E', criada_em: h(3), dados: { origem: lugar('Baía Mall'), destino: lugar('Matola Shopping'), pagamento: 'e-Mola', motorista: { nome: 'Abel S.' }, clienteNome: 'Ana', km: 16.2 } },
      { id: 'v3', cliente_telefone: '+258821234567', estado: 'concluida', total_mzn: 700, viatura: 'Range Rover Sport', criada_em: h(26), dados: { origem: lugar('Hotel Polana Serena'), destino: lugar('Aeroporto Internacional de Maputo'), pagamento: 'M-Pesa', motorista: { nome: 'Carlos M.' }, clienteNome: 'Maria', km: 7.4 } },
      { id: 'v4', cliente_telefone: '+258841112233', estado: 'cancelada', total_mzn: 100, viatura: 'VW Fusca', criada_em: h(30), dados: { origem: lugar('Fortaleza de Maputo'), destino: lugar('Avenida Marginal'), pagamento: 'M-Pesa', motorista: { nome: 'Rui T.' }, clienteNome: 'Flavio', km: 6.1 } },
      { id: 'v5', cliente_telefone: '+258847654321', estado: 'agendada', total_mzn: 2200, viatura: 'Mercedes-Benz Classe S', criada_em: h(5), dados: { origem: lugar('Sommerschield'), destino: lugar('Ponta do Ouro'), recolhaEm: new Date(Date.now() + 2 * 86_400_000).toISOString(), pagamento: 'M-Pesa', motorista: { nome: 'Abel S.' }, clienteNome: 'Ana', km: 110 } },
    ],
    inscricoes: [
      { id: 'i1', telefone: '+258845550001', estado: 'pendente', por_km_mzn: 95, enviada_em: h(1), dados: { nome: 'João Matsinhe', marca: 'Toyota', modelo: 'Land Cruiser', ano: '2022', matricula: 'AHB 456 MC', tipo: 'SUV', lugares: 7, documento: '110100123456B', cartaConducao: 'MC-998877', validades: { carta: '2028-05-01', seguro: '2026-12-31', inspecao: '2027-03-15' }, motorista: { nome: 'Abel Sitoe', telefone: '+258847654321' } } },
      { id: 'i2', telefone: '+258840000000', estado: 'aprovada', por_km_mzn: 90, enviada_em: h(200), dados: { nome: 'Carlos M.', marca: 'BMW', modelo: 'Série 5', ano: '2021', matricula: 'AFK 123 MC', tipo: 'Executivo', lugares: 4, documento: '110100654321A', cartaConducao: 'MC-112233' } },
    ],
    avaliacoes: [
      { id: 'a1', tipo: 'motorista', telefone: '+258840000000', estrelas: 5, elogios: ['Pontual', 'Carro limpo'], comentario: 'Muito profissional, chegou antes da hora.', em: h(3) },
      { id: 'a2', tipo: 'motorista', telefone: '+258840000000', estrelas: 4, elogios: ['Condução segura'], comentario: '', em: h(26) },
      { id: 'a3', tipo: 'cliente', telefone: '+258847654321', estrelas: 5, elogios: ['Pontual', 'Educado'], comentario: '', em: h(3) },
    ],
    ajuda: [
      { id: 'j1', cliente_telefone: '+258847654321', estado: 'aberto', resposta: null, reembolso_mzn: null, criado_em: h(2), dados: { tipo: 'objeto', texto: 'Esqueci-me dos óculos de sol no banco de trás.', viagemResumo: 'Baía Mall → Matola Shopping', clienteNome: 'Ana' } },
    ],
    reservas: [{ id: 'v5', viatura_id: 'mercedes-s', inicio: new Date(Date.now() + 2 * 86_400_000).toISOString(), fim: new Date(Date.now() + 2 * 86_400_000 + 7_200_000).toISOString(), tipo: 'agendada', destino: 'Ponta do Ouro' }],
  };
}
