import type { Dados } from '@/app/page';

// Dados de exemplo para ver o painel sem servidor ("Ver com dados de exemplo").
export function exemplo(): Dados {
  const h = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();
  const lugar = (nome: string) => ({ nome });
  const f = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();
  return {
    viagens: [
      { id: 'v1', cliente_telefone: '+258841112233', estado: 'em_curso', total_mzn: 630, viatura: 'BMW Série 5', criada_em: h(0.2), dados: { origem: lugar('Baixa, Maputo'), destino: lugar('Aeroporto Internacional de Maputo'), pagamento: 'M-Pesa', motorista: { nome: 'Carlos M.' }, clienteNome: 'Flavio', km: 7 } },
      { id: 'v2', cliente_telefone: '+258847654321', estado: 'concluida', total_mzn: 1460, viatura: 'Mercedes-Benz Classe E', criada_em: h(3), dados: { origem: lugar('Baía Mall'), destino: lugar('Matola Shopping'), pagamento: 'e-Mola', motorista: { nome: 'Abel S.' }, clienteNome: 'Ana', km: 16.2 } },
      { id: 'v3', cliente_telefone: '+258821234567', estado: 'concluida', total_mzn: 700, viatura: 'Range Rover Sport', criada_em: h(26), dados: { origem: lugar('Hotel Polana Serena'), destino: lugar('Aeroporto Internacional de Maputo'), pagamento: 'M-Pesa', motorista: { nome: 'Carlos M.' }, clienteNome: 'Maria', km: 7.4 } },
      { id: 'v4', cliente_telefone: '+258841112233', estado: 'cancelada', total_mzn: 100, viatura: 'VW Fusca', criada_em: h(30), dados: { origem: lugar('Fortaleza de Maputo'), destino: lugar('Avenida Marginal'), pagamento: 'M-Pesa', motorista: { nome: 'Rui T.' }, clienteNome: 'Flavio', km: 6.1 } },
      { id: 'v5', cliente_telefone: '+258847654321', estado: 'agendada', total_mzn: 2200, viatura: 'Mercedes-Benz Classe S', criada_em: h(5), dados: { origem: lugar('Sommerschield'), destino: lugar('Ponta do Ouro'), recolhaEm: new Date(Date.now() + 2 * 86_400_000).toISOString(), pagamento: 'M-Pesa', motorista: { nome: 'Abel S.' }, clienteNome: 'Ana', km: 110 } },
      { id: 'v-ao1', cliente_telefone: '+244923456789', estado: 'concluida', total_mzn: 1450, viatura: 'BMW Série 5', criada_em: h(4), dados: { origem: lugar('Marginal de Luanda'), destino: lugar('Belas Shopping'), pagamento: 'Multicaixa Express', motorista: { nome: 'Mário K.' }, clienteNome: 'Ana Neto', km: 16.1 } },
      { id: 'v-ao2', cliente_telefone: '+244931112233', estado: 'agendada', total_mzn: 900, viatura: 'Mercedes-Benz Classe E', criada_em: h(6), dados: { origem: lugar('Hotel Epic Sana'), destino: lugar('Aeroporto 4 de Fevereiro'), recolhaEm: new Date(Date.now() + 86_400_000).toISOString(), pagamento: 'Unitel Money', motorista: { nome: 'Mário K.' }, clienteNome: 'Paulo', km: 6 } },
    ],
    inscricoes: [
      { id: 'i1', telefone: '+258845550001', estado: 'pendente', por_km_mzn: 95, enviada_em: h(1), dados: { nome: 'João Matsinhe', marca: 'Toyota', modelo: 'Land Cruiser', ano: '2022', matricula: 'AHB 456 MC', tipo: 'SUV', lugares: 7, documento: '110100123456B', cartaConducao: 'MC-998877', validades: { carta: '2028-05-01', seguro: '2026-12-31', inspecao: '2027-03-15' }, motorista: { nome: 'Abel Sitoe', telefone: '+258847654321' } } },
      { id: 'i2', telefone: '+258840000000', estado: 'aprovada', por_km_mzn: 90, enviada_em: h(200), dados: { nome: 'Carlos M.', marca: 'BMW', modelo: 'Série 5', ano: '2021', matricula: 'AFK 123 MC', tipo: 'Executivo', lugares: 4, documento: '110100654321A', cartaConducao: 'MC-112233' } },
      { id: 'i-ao1', telefone: '+244912345678', estado: 'pendente', por_km_mzn: 90, enviada_em: h(2), dados: { nome: 'Mário Kiala', marca: 'BMW', modelo: 'Série 5', ano: '2022', matricula: 'LD-12-34-AB', tipo: 'Executivo', lugares: 4, documento: '004567890LA041', cartaConducao: 'LD-556677', validades: { carta: '2029-01-01', seguro: '2027-01-31', inspecao: '2027-06-30' } } },
    ],
    avaliacoes: [
      { id: 'a1', tipo: 'motorista', telefone: '+258840000000', estrelas: 5, elogios: ['Pontual', 'Carro limpo'], comentario: 'Muito profissional, chegou antes da hora.', em: h(3) },
      { id: 'a2', tipo: 'motorista', telefone: '+258840000000', estrelas: 4, elogios: ['Condução segura'], comentario: '', em: h(26) },
      { id: 'a3', tipo: 'cliente', telefone: '+258847654321', estrelas: 5, elogios: ['Pontual', 'Educado'], comentario: '', em: h(3) },
    ],
    ajuda: [
      { id: 'j1', cliente_telefone: '+258847654321', estado: 'aberto', resposta: null, reembolso_mzn: null, criado_em: h(2), dados: { tipo: 'objeto', texto: 'Esqueci-me dos óculos de sol no banco de trás.', viagemResumo: 'Baía Mall → Matola Shopping', clienteNome: 'Ana' } },
      { id: 'j-ao1', cliente_telefone: '+244923456789', estado: 'aberto', resposta: null, reembolso_mzn: null, criado_em: h(1), dados: { tipo: 'cobranca', texto: 'Paguei duas vezes pelo Multicaixa Express.', viagemResumo: 'Marginal de Luanda → Belas Shopping', clienteNome: 'Ana Neto' } },
    ],
    reservas: [
      { id: 'v5', viatura_id: 'mercedes-classe-s', inicio: f(48), fim: f(50), tipo: 'agendada', destino: 'Ponta do Ouro', criada_em: h(5), pedido: { precoMzn: 2200, viaturaNome: 'Mercedes-Benz Classe S', clienteNome: 'Ana', clienteTelefone: '+258847654321', origem: lugar('Sommerschield'), pagamento: 'M-Pesa' } },
      { id: 'r2', viatura_id: 'i2', inicio: f(20), fim: f(21.5), tipo: 'agendada', destino: 'Aeroporto Internacional de Maputo', criada_em: h(2), pedido: { precoMzn: 900, viaturaNome: 'BMW Série 5', clienteNome: 'Flavio', clienteTelefone: '+258841112233', origem: lugar('Baixa, Maputo'), pagamento: 'M-Pesa' } },
      { id: 'r3', viatura_id: 'i2', inicio: f(0.8), fim: f(2), tipo: 'agendada', destino: 'Costa do Sol', criada_em: h(30), pedido: { precoMzn: 650, viaturaNome: 'BMW Série 5', clienteNome: 'Maria', clienteTelefone: '+258821234567', origem: lugar('Hotel Polana Serena'), pagamento: 'e-Mola' } },
      { id: 'r4', viatura_id: 'i2', inicio: f(70), fim: f(74), tipo: 'bloqueio', destino: null, pedido: null },
      { id: 'r5', viatura_id: 'mercedes-classe-s', inicio: h(48), fim: h(46), tipo: 'agendada', destino: 'Matola', criada_em: h(72), pedido: { precoMzn: 1800, viaturaNome: 'Mercedes-Benz Classe S', clienteNome: 'Rui', clienteTelefone: '+258849998877', origem: lugar('Polana'), pagamento: 'M-Pesa' } },
    ],
    pagamentos: [
      { id: 'p1', estado: 'pago', metodo: 'mpesa', valor_mzn: 2200, comissao_mzn: 308, motorista_mzn: 1892, viatura_id: 'mercedes-classe-s', viagem: { tipo: 'viagem', id: 'v5' }, criado_em: h(5), pago_em: h(5) },
      { id: 'p2', estado: 'pago', metodo: 'mpesa', valor_mzn: 900, comissao_mzn: 126, motorista_mzn: 774, viatura_id: 'i2', viagem: { tipo: 'viagem', id: 'r2' }, criado_em: h(2), pago_em: h(2) },
      { id: 'p3', estado: 'pago', metodo: 'emola', valor_mzn: 990, comissao_mzn: 990, motorista_mzn: 0, viatura_id: 'club', viagem: { tipo: 'club' }, criado_em: h(8), pago_em: h(8) },
      { id: 'p4', estado: 'falhou', metodo: 'mpesa', valor_mzn: 1000, comissao_mzn: 1000, motorista_mzn: 0, viatura_id: 'carteira', viagem: { tipo: 'carteira' }, criado_em: h(1), pago_em: null },
    ],
  };
}
