'use client';

import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { COMISSAO, daMzn, dataHora, mzn, paraMzn, supabase } from '@/lib/supabase';
import { definirPaisPainel, filtrarPais, PAISES, paisPainel, type Pais } from '@/lib/paises';
import { exemplo } from '@/lib/exemplo';

// Linhas das tabelas de supabase/painel.sql (e reservas.sql).
type Lugar = { nome: string };
export type Viagem = {
  id: string;
  cliente_telefone: string | null;
  estado: 'agendada' | 'em_curso' | 'concluida' | 'cancelada';
  total_mzn: number;
  viatura: string | null;
  criada_em: string;
  dados: { origem?: Lugar; destino?: Lugar; recolhaEm?: string; pagamento?: string; motorista?: { nome: string }; clienteNome?: string; km?: number };
};
export type Inscricao = {
  id: string;
  telefone: string;
  estado: 'pendente' | 'aprovada' | 'rejeitada';
  por_km_mzn: number;
  enviada_em: string;
  dados: { nome: string; marca: string; modelo: string; ano: string; matricula: string; tipo: string; lugares: number; documento: string; cartaConducao: string; validades?: Record<string, string>; motorista?: { nome: string; telefone: string }; convite?: string };
};
export type Avaliacao = { id: string; tipo: 'motorista' | 'cliente'; telefone: string; estrelas: number; elogios: string[]; comentario: string; em: string };
export type PedidoAjuda = {
  id: string;
  cliente_telefone: string | null;
  estado: 'aberto' | 'resolvido';
  resposta: string | null;
  reembolso_mzn: number | null;
  criado_em: string;
  dados: { tipo: string; texto: string; viagemResumo?: string; clienteNome?: string };
};
export type Reserva = {
  id: string;
  viatura_id: string;
  inicio: string;
  fim: string;
  tipo: string;
  destino: string | null;
  criada_em?: string;
  // O pedido que o cliente pagou (preço, carro, cliente). As reservas antigas ou os bloqueios não o têm.
  pedido: { precoMzn?: number; viaturaNome?: string; clienteNome?: string; clienteTelefone?: string; origem?: Lugar; pagamento?: string } | null;
};
// Pagamentos da DebitoPay (supabase/migrations/..._pagamentos.sql); só aparecem com agendas-painel.sql.
export type Pagamento = {
  id: string;
  estado: 'pendente' | 'pago' | 'falhou' | 'expirado';
  metodo: 'mpesa' | 'emola';
  valor_mzn: number;
  comissao_mzn: number;
  motorista_mzn: number;
  viatura_id: string;
  viagem: { tipo?: 'viagem' | 'carteira' | 'club'; id?: string };
  criado_em: string;
  pago_em: string | null;
};
export type Dados = { viagens: Viagem[]; inscricoes: Inscricao[]; avaliacoes: Avaliacao[]; ajuda: PedidoAjuda[]; reservas: Reserva[]; pagamentos: Pagamento[] | null };

const ABAS = ['Resumo', 'Agendas', 'Viagens', 'Motoristas', 'Avaliações', 'Ajuda'] as const;
type Aba = (typeof ABAS)[number];

const TIPOS_AJUDA: Record<string, string> = {
  objeto: 'Objeto esquecido',
  cobranca: 'Cobrança',
  motorista: 'Queixa sobre motorista ou carro',
  seguranca: 'Segurança',
  outro: 'Outro assunto',
};

export default function Painel() {
  const sb = supabase();
  const [sessao, setSessao] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [demo, setDemo] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);
  const [aba, setAba] = useState<Aba>('Resumo');
  // Moçambique e Angola ficam separados: cada país vê só as suas viagens, motoristas e valores (pedido do Flavio).
  const [pais, setPais] = useState<Pais>('MZ');
  useEffect(() => {
    try {
      const guardado = localStorage.getItem('painel.pais');
      if (guardado === 'MZ' || guardado === 'AO') setPais(guardado);
    } catch {}
  }, []);
  function escolherPais(p: Pais) {
    setPais(p);
    try {
      localStorage.setItem('painel.pais', p);
    } catch {}
  }
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!sb || !sessao) return setAdmin(null);
    sb.rpc('e_admin').then(({ data }) => setAdmin(data === true));
  }, [sb, sessao]);

  const carregar = useCallback(async () => {
    if (demo) return setDados(exemplo());
    if (!sb || !admin) return;
    // As reservas dos últimos 90 dias e as que estão por fazer: o valor recebido conta as duas.
    const desde = new Date(Date.now() - 90 * DIA).toISOString();
    const [v, i, a, j, r, p] = await Promise.all([
      sb.from('viagens').select('*').order('criada_em', { ascending: false }).limit(500),
      sb.from('inscricoes').select('*').order('enviada_em', { ascending: false }),
      sb.from('avaliacoes').select('*').order('em', { ascending: false }).limit(500),
      sb.from('pedidos_ajuda').select('*').order('criado_em', { ascending: false }),
      sb.from('reservas').select('id, viatura_id, inicio, fim, tipo, destino, criada_em, pedido').gte('fim', desde).order('inicio'),
      sb.from('pagamentos').select('id, estado, metodo, valor_mzn, comissao_mzn, motorista_mzn, viatura_id, viagem, criado_em, pago_em').gte('criado_em', desde).order('criado_em', { ascending: false }),
    ]);
    const falhou = [v, i, a, j, r].find((x) => x.error);
    const ficheiro = falhou === r ? 'supabase/reservas.sql' : 'supabase/painel.sql';
    setErro(falhou ? `Não foi possível ler os dados: ${falhou.error!.message}. Correste o ${ficheiro}?` : null);
    // Os pagamentos são opcionais: sem a tabela ou sem agendas-painel.sql, o separador Agendas avisa e usa o valor das reservas.
    setDados({ viagens: v.data ?? [], inscricoes: i.data ?? [], avaliacoes: a.data ?? [], ajuda: j.data ?? [], reservas: r.data ?? [], pagamentos: p.error ? null : (p.data ?? []) });
  }, [sb, admin, demo]);

  // Atualiza sozinho de 30 em 30 segundos.
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  if (!demo && (!sessao || admin === false)) {
    return <Entrar sessao={sessao} semAdmin={admin === false} onDemo={() => setDemo(true)} />;
  }

  definirPaisPainel(pais);
  const todos = dados;
  const dadosPais = todos && filtrarPais(todos, pais);
  const pendentes = dadosPais?.inscricoes.filter((x) => x.estado === 'pendente').length ?? 0;
  const abertos = dadosPais?.ajuda.filter((x) => x.estado === 'aberto').length ?? 0;
  const porFazer = dadosPais ? agendas(dadosPais).porFazer.length : 0;

  return (
    <>
      <header className="topo">
        <div className="marca">
          Chauffeur<span>.</span> <span className="sec">Painel de gestão</span>
        </div>
        <nav className="abas">
          {ABAS.map((x) => (
            <button key={x} className={`aba ${aba === x ? 'ativa' : ''}`} onClick={() => setAba(x)}>
              {x}
              {x === 'Motoristas' && pendentes > 0 && <span className="contador">{pendentes}</span>}
              {x === 'Ajuda' && abertos > 0 && <span className="contador">{abertos}</span>}
              {x === 'Agendas' && porFazer > 0 && <span className="contador verde">{porFazer}</span>}
            </button>
          ))}
        </nav>
        <div className="abas paises">
          {(Object.keys(PAISES) as Pais[]).map((p) => (
            <button key={p} className={`aba ${pais === p ? 'ativa' : ''}`} onClick={() => escolherPais(p)}>
              {PAISES[p].bandeira} {PAISES[p].nome}
            </button>
          ))}
        </div>
        <div className="linha">
          {demo && <span className="etiqueta laranja">Dados de exemplo</span>}
          <button className="botao claro" onClick={carregar}>
            Atualizar
          </button>
          <button className="botao claro" onClick={() => (demo ? setDemo(false) : sb?.auth.signOut())}>
            Sair
          </button>
        </div>
      </header>
      <main>
        {erro && <p className="erro">{erro}</p>}
        {pais === 'AO' && <p className="sec">Angola: valores em kwanzas (câmbio provisório de {PAISES.AO.porMetical} Kz por metical). Os pagamentos em Angola ainda são simulados.</p>}
        {!dadosPais ? (
          <p className="vazio">A carregar…</p>
        ) : aba === 'Resumo' ? (
          <Resumo d={dadosPais} />
        ) : aba === 'Viagens' ? (
          <Viagens d={dadosPais} />
        ) : aba === 'Motoristas' ? (
          <Motoristas d={dadosPais} demo={demo} mudar={setDados} recarregar={carregar} />
        ) : aba === 'Agendas' ? (
          <Agendas d={dadosPais} />
        ) : aba === 'Avaliações' ? (
          <Avaliacoes d={dadosPais} />
        ) : (
          <Ajuda d={dadosPais} demo={demo} mudar={setDados} recarregar={carregar} />
        )}
      </main>
    </>
  );
}

function Entrar({ sessao, semAdmin, onDemo }: { sessao: Session | null; semAdmin: boolean; onDemo: () => void }) {
  const sb = supabase();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  async function entrar() {
    if (!sb) return;
    setErro(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErro('Email ou palavra-passe errados.');
  }
  return (
    <div className="entrar">
      <div className="marca" style={{ fontSize: 28 }}>
        Chauffeur<span>.</span>
      </div>
      <h1>Painel de gestão</h1>
      {!sb && <p className="erro">Falta o .env.local com o endereço e a chave anon do Supabase (vê o README).</p>}
      {semAdmin && sessao ? (
        <>
          <p className="erro">A conta {sessao.user.email} não é administradora. Junta-a na tabela administradores (vê o README).</p>
          <button className="botao claro" onClick={() => sb?.auth.signOut()}>
            Sair
          </button>
        </>
      ) : (
        <>
          <input className="campo" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input className="campo" placeholder="Palavra-passe" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && entrar()} autoComplete="current-password" />
          {erro && <p className="erro">{erro}</p>}
          <button className="botao verde" onClick={entrar} disabled={!sb || !email || !senha}>
            Entrar
          </button>
        </>
      )}
      <button className="botao claro" onClick={onDemo}>
        Ver com dados de exemplo
      </button>
    </div>
  );
}

const DOCUMENTOS: Record<string, string> = { carta: 'Carta válida até', seguro: 'Seguro até', inspecao: 'Inspeção até' };
const DIA = 86_400_000;
const estrelas = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const media = (l: { estrelas: number }[]) => (l.length ? l.reduce((t, a) => t + a.estrelas, 0) / l.length : null);
const nota = (n: number | null) => (n == null ? '—' : n.toFixed(1).replace('.', ','));

function Resumo({ d }: { d: Dados }) {
  const agora = Date.now();
  const periodo = (dias: number) => {
    const desde = agora - dias * DIA;
    const v = d.viagens.filter((x) => new Date(x.criada_em).getTime() >= desde);
    const feitas = v.filter((x) => x.estado === 'concluida');
    const faturado = feitas.reduce((t, x) => t + x.total_mzn, 0);
    return { feitas: feitas.length, canceladas: v.filter((x) => x.estado === 'cancelada').length, faturado, comissao: faturado * COMISSAO };
  };
  const hoje = periodo(1);
  const semana = periodo(7);
  const mediaMotoristas = media(d.avaliacoes.filter((a) => a.tipo === 'motorista'));
  const ag = agendas(d);
  return (
    <>
      <h1>Resumo</h1>
      <h2>Últimas 24 horas</h2>
      <div className="grelha">
        <Numero nome="Viagens feitas" valor={String(hoje.feitas)} />
        <Numero nome="Faturado" valor={mzn(hoje.faturado)} />
        <Numero nome="Comissão (14%)" valor={mzn(hoje.comissao)} />
        <Numero nome="Canceladas" valor={String(hoje.canceladas)} />
      </div>
      <h2>Últimos 7 dias</h2>
      <div className="grelha">
        <Numero nome="Viagens feitas" valor={String(semana.feitas)} />
        <Numero nome="Faturado" valor={mzn(semana.faturado)} />
        <Numero nome="Comissão (14%)" valor={mzn(semana.comissao)} />
        <Numero nome="Canceladas" valor={String(semana.canceladas)} />
      </div>
      <h2>Agendas</h2>
      <div className="grelha">
        <Numero nome="Reservas por fazer" valor={String(ag.porFazer.length)} />
        <Numero nome="Carros agendados" valor={String(ag.carrosAgendados)} />
        <Numero nome="Recebido pelas reservas" valor={mzn(ag.total)} />
        <Numero nome="Comissão (14%)" valor={mzn(ag.comissao)} />
        <Numero nome="Para os donos" valor={mzn(ag.donos)} />
      </div>
      <h2>Agora</h2>
      <div className="grelha">
        <Numero nome="Viagens em curso" valor={String(d.viagens.filter((x) => x.estado === 'em_curso').length)} />
        <Numero nome="Inscrições à espera" valor={String(d.inscricoes.filter((x) => x.estado === 'pendente').length)} />
        <Numero nome="Pedidos de ajuda abertos" valor={String(d.ajuda.filter((x) => x.estado === 'aberto').length)} />
        <Numero nome="Motoristas aprovados" valor={String(d.inscricoes.filter((x) => x.estado === 'aprovada').length)} />
        <Numero nome="Nota média dos motoristas" valor={nota(mediaMotoristas)} />
      </div>
    </>
  );
}

function Numero({ nome, valor }: { nome: string; valor: string }) {
  return (
    <div className="cartao">
      <div className="sec">{nome}</div>
      <div className="numero">{valor}</div>
    </div>
  );
}

const ESTADOS_VIAGEM: Record<Viagem['estado'], [string, string]> = {
  agendada: ['Agendada', ''],
  em_curso: ['Em curso', 'laranja'],
  concluida: ['Concluída', 'verde'],
  cancelada: ['Cancelada', 'vermelha'],
};

function Viagens({ d }: { d: Dados }) {
  const [filtro, setFiltro] = useState<'todas' | Viagem['estado']>('todas');
  const lista = d.viagens.filter((x) => filtro === 'todas' || x.estado === filtro);
  return (
    <>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h1>Viagens</h1>
        <select className="campo" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todas">Todas</option>
          {Object.entries(ESTADOS_VIAGEM).map(([k, [nome]]) => (
            <option key={k} value={k}>
              {nome}
            </option>
          ))}
        </select>
      </div>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Carro e motorista</th>
              <th>Percurso</th>
              <th>Estado</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id}>
                <td>{dataHora(v.dados.recolhaEm ?? v.criada_em)}</td>
                <td>
                  {v.dados.clienteNome ?? '—'}
                  <div className="sec">{v.cliente_telefone}</div>
                </td>
                <td>
                  {v.viatura}
                  <div className="sec">{v.dados.motorista?.nome}</div>
                </td>
                <td>
                  {v.dados.origem?.nome} → {v.dados.destino?.nome}
                  {v.dados.km ? <div className="sec">{v.dados.km.toFixed(1).replace('.', ',')} km</div> : null}
                </td>
                <td>
                  <span className={`etiqueta ${ESTADOS_VIAGEM[v.estado]?.[1] ?? ''}`}>{ESTADOS_VIAGEM[v.estado]?.[0] ?? v.estado}</span>
                </td>
                <td>
                  {mzn(v.total_mzn)}
                  <div className="sec">{v.dados.pagamento}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="vazio">Sem viagens.</p>}
      </div>
    </>
  );
}

type Mudar = (f: (d: Dados | null) => Dados | null) => void;

function Motoristas({ d, demo, mudar, recarregar }: { d: Dados; demo: boolean; mudar: Mudar; recarregar: () => void }) {
  const [precos, setPrecos] = useState<Record<string, number>>({});
  const ordem = { pendente: 0, aprovada: 1, rejeitada: 2 };
  const lista = [...d.inscricoes].sort((a, b) => ordem[a.estado] - ordem[b.estado]);
  async function decidir(i: Inscricao, estado: 'aprovada' | 'rejeitada') {
    // O preço escreve-se na moeda do país (MT ou Kz) e guarda-se em meticais.
    const por_km_mzn = precos[i.id] != null ? Math.max(1, paraMzn(precos[i.id])) : i.por_km_mzn;
    if (demo) return mudar((x) => x && { ...x, inscricoes: x.inscricoes.map((y) => (y.id === i.id ? { ...y, estado, por_km_mzn } : y)) });
    const { error } = await supabase()!.from('inscricoes').update({ estado, por_km_mzn, decidida_em: new Date().toISOString() }).eq('id', i.id);
    if (error) alert(`Não foi possível guardar: ${error.message}`);
    recarregar();
  }
  const notas = (i: Inscricao) => d.avaliacoes.filter((a) => a.tipo === 'motorista' && a.telefone === (i.dados.motorista?.telefone ?? i.telefone));
  return (
    <>
      <h1>Motoristas e carros</h1>
      <p className="sec">A aprovação chega à app do motorista em menos de um minuto. As fotos do carro ainda ficam no telemóvel do motorista.</p>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Motorista</th>
              <th>Carro</th>
              <th>Documentos</th>
              <th>Nota</th>
              <th>Preço por km</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((i) => {
              const n = notas(i);
              return (
                <tr key={i.id}>
                  <td>
                    {i.dados.motorista ? `Dono: ${i.dados.nome}` : i.dados.nome}
                    <div className="sec">{i.telefone}</div>
                    {i.dados.motorista && (
                      <div>
                        Conduz: {i.dados.motorista.nome}
                        <div className="sec">{i.dados.motorista.telefone}</div>
                      </div>
                    )}
                    {i.dados.convite && <div className="sec">Convidado com {i.dados.convite}</div>}
                    <div className="sec">Enviada {dataHora(i.enviada_em)}</div>
                  </td>
                  <td>
                    {i.dados.marca} {i.dados.modelo} ({i.dados.ano})
                    <div className="sec">
                      {i.dados.matricula} · {i.dados.tipo} · {i.dados.lugares} lugares
                    </div>
                  </td>
                  <td className="sec">
                    BI {i.dados.documento}
                    <br />
                    Carta {i.dados.cartaConducao}
                    {i.dados.validades &&
                      Object.entries(i.dados.validades).map(([k, v]) => (
                        <div key={k}>
                          {DOCUMENTOS[k] ?? k}: {new Date(v).toLocaleDateString('pt-PT')}
                        </div>
                      ))}
                  </td>
                  <td>{n.length ? `★ ${nota(media(n))} (${n.length})` : '—'}</td>
                  <td>
                    {i.estado === 'pendente' ? (
                      <input
                        className="campo"
                        style={{ width: 90 }}
                        type="number"
                        min={1}
                        value={precos[i.id] ?? daMzn(i.por_km_mzn)}
                        onChange={(e) => setPrecos((p) => ({ ...p, [i.id]: Number(e.target.value) }))}
                      />
                    ) : (
                      mzn(i.por_km_mzn)
                    )}
                  </td>
                  <td>
                    {i.estado === 'pendente' ? (
                      <div className="linha">
                        <button className="botao verde" onClick={() => decidir(i, 'aprovada')}>
                          Aprovar
                        </button>
                        <button className="botao claro" onClick={() => decidir(i, 'rejeitada')}>
                          Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className={`etiqueta ${i.estado === 'aprovada' ? 'verde' : 'vermelha'}`}>{i.estado === 'aprovada' ? 'Aprovado' : 'Rejeitado'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p className="vazio">Ainda não há inscrições.</p>}
      </div>
    </>
  );
}

/** Números das agendas: as reservas pagas na marcação, quanto entrou, a comissão de 14% e o que fica para os donos. */
function agendas(d: Dados) {
  const agora = Date.now();
  const clientes = d.reservas.filter((r) => r.tipo !== 'bloqueio');
  const porFazer = clientes.filter((r) => new Date(r.fim).getTime() > agora);
  // As reservas agendadas pagam-se ao marcar; os pedidos para agora pagam-se no fim e entram nas viagens.
  const pagas = clientes.filter((r) => r.tipo === 'agendada');
  const valor = (r: Reserva) => r.pedido?.precoMzn ?? d.viagens.find((v) => v.id === r.id)?.total_mzn ?? 0;
  const total = pagas.reduce((t, r) => t + valor(r), 0);
  const comissao = Math.round(total * COMISSAO);
  return { clientes, porFazer, pagas, valor, total, comissao, donos: total - comissao, carrosAgendados: new Set(porFazer.map((r) => r.viatura_id)).size };
}

const TIPOS_PAGAMENTO: Record<string, string> = { viagem: 'Viagens e reservas', carteira: 'Carregamentos da carteira', club: 'Chauffeur Club' };

function Agendas({ d }: { d: Dados }) {
  const [ver, setVer] = useState<'por_fazer' | 'feitas'>('por_fazer');
  const ag = agendas(d);
  const agora = Date.now();
  const inscricao = (id: string) => d.inscricoes.find((i) => i.id === id);
  const nomeCarro = (id: string) => {
    const i = inscricao(id);
    if (i) return `${i.dados.marca} ${i.dados.modelo}`;
    return d.reservas.find((r) => r.viatura_id === id && r.pedido?.viaturaNome)?.pedido?.viaturaNome ?? id;
  };
  const dono = (id: string) => {
    const i = inscricao(id);
    return i ? `${i.dados.nome} · ${i.telefone}` : 'Frota de exemplo';
  };

  // Um resumo por carro: reservas por fazer, a próxima e o dinheiro.
  const carros = [...new Set(ag.clientes.map((r) => r.viatura_id))]
    .map((id) => {
      const doCarro = ag.clientes.filter((r) => r.viatura_id === id);
      const porFazer = doCarro.filter((r) => new Date(r.fim).getTime() > agora);
      const recebido = doCarro.filter((r) => r.tipo === 'agendada').reduce((t, r) => t + ag.valor(r), 0);
      return { id, porFazer, proxima: porFazer[0], recebido, comissao: Math.round(recebido * COMISSAO) };
    })
    .sort((a, b) => b.porFazer.length - a.porFazer.length || b.recebido - a.recebido);

  const lista = d.reservas
    .filter((r) => (ver === 'por_fazer' ? new Date(r.fim).getTime() > agora : new Date(r.fim).getTime() <= agora && r.tipo !== 'bloqueio'))
    .sort((a, b) => (ver === 'por_fazer' ? 1 : -1) * (new Date(a.inicio).getTime() - new Date(b.inicio).getTime()));

  // Pagamentos reais da DebitoPay, separados por tipo.
  const pagos = (d.pagamentos ?? []).filter((p) => p.estado === 'pago');
  const porTipo = Object.keys(TIPOS_PAGAMENTO).map((tipo) => {
    const l = pagos.filter((p) => (p.viagem?.tipo ?? 'viagem') === tipo);
    return { tipo, n: l.length, total: l.reduce((t, p) => t + Number(p.valor_mzn), 0), comissao: l.reduce((t, p) => t + Number(p.comissao_mzn), 0), donos: l.reduce((t, p) => t + Number(p.motorista_mzn), 0) };
  });
  const porConfirmar = (d.pagamentos ?? []).filter((p) => p.estado === 'pendente').length;
  const falhados = (d.pagamentos ?? []).filter((p) => p.estado === 'falhou' || p.estado === 'expirado').length;

  return (
    <>
      <h1>Agendas</h1>
      <p className="sec">As reservas agendadas pagam-se ao marcar, por isso o valor entra aqui logo. A comissão de 14% sai do valor do dono; o cliente não paga mais. Últimos 90 dias e tudo o que está por fazer.</p>
      <div className="grelha">
        <Numero nome="Reservas por fazer" valor={String(ag.porFazer.length)} />
        <Numero nome="Carros agendados" valor={String(ag.carrosAgendados)} />
        <Numero nome="Recebido pelas reservas" valor={mzn(ag.total)} />
        <Numero nome="Comissão (14%)" valor={mzn(ag.comissao)} />
        <Numero nome="Para os donos" valor={mzn(ag.donos)} />
      </div>

      <h2>Pagamentos confirmados pela DebitoPay</h2>
      {d.pagamentos === null ? (
        <p className="sec">Para ver aqui os pagamentos reais, corre no Supabase o ficheiro supabase/agendas-painel.sql (SQL Editor, colar, Run).</p>
      ) : (
        <>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Pagamentos</th>
                  <th>Total</th>
                  <th>Comissão</th>
                  <th>Para os donos</th>
                </tr>
              </thead>
              <tbody>
                {porTipo.map((x) => (
                  <tr key={x.tipo}>
                    <td>{TIPOS_PAGAMENTO[x.tipo]}</td>
                    <td>{x.n}</td>
                    <td>{mzn(x.total)}</td>
                    <td>{mzn(x.comissao)}</td>
                    <td>{x.tipo === 'viagem' ? mzn(x.donos) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sec">
            A carteira e o Club ficam inteiros para a plataforma. {porConfirmar > 0 && `À espera do PIN do cliente: ${porConfirmar}. `}
            {falhados > 0 && `Pagamentos que não passaram: ${falhados}.`}
          </p>
        </>
      )}

      <h2>Por carro</h2>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Carro e dono</th>
              <th>Por fazer</th>
              <th>Próxima</th>
              <th>Recebido</th>
              <th>Comissão</th>
              <th>Para o dono</th>
            </tr>
          </thead>
          <tbody>
            {carros.map((c) => (
              <tr key={c.id}>
                <td>
                  {nomeCarro(c.id)}
                  <div className="sec">{dono(c.id)}</div>
                </td>
                <td>{c.porFazer.length > 0 ? <span className="etiqueta verde">{c.porFazer.length}</span> : '—'}</td>
                <td>{c.proxima ? dataHora(c.proxima.inicio) : '—'}</td>
                <td>{mzn(c.recebido)}</td>
                <td>{mzn(c.comissao)}</td>
                <td>{mzn(c.recebido - c.comissao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {carros.length === 0 && <p className="vazio">Ainda não há carros agendados.</p>}
      </div>

      <div className="linha" style={{ justifyContent: 'space-between', marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Reservas</h2>
        <div className="linha">
          <button className={`aba ${ver === 'por_fazer' ? 'ativa' : ''}`} onClick={() => setVer('por_fazer')}>
            Por fazer
          </button>
          <button className={`aba ${ver === 'feitas' ? 'ativa' : ''}`} onClick={() => setVer('feitas')}>
            Feitas
          </button>
        </div>
      </div>
      <div className="rolar" style={{ marginTop: 12 }}>
        <table className="tabela">
          <thead>
            <tr>
              <th>Recolha</th>
              <th>Carro</th>
              <th>Cliente</th>
              <th>Percurso</th>
              <th>Valor</th>
              <th>Comissão</th>
              <th>Para o dono</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => {
              const v = r.tipo === 'agendada' ? ag.valor(r) : 0;
              return (
                <tr key={r.id}>
                  <td>
                    {dataHora(r.inicio)}
                    <div className="sec">até {dataHora(r.fim)}</div>
                  </td>
                  <td>
                    {nomeCarro(r.viatura_id)}
                    <div className="sec">{dono(r.viatura_id)}</div>
                  </td>
                  <td>
                    {r.pedido?.clienteNome ?? '—'}
                    <div className="sec">{r.pedido?.clienteTelefone}</div>
                  </td>
                  <td>
                    {r.tipo === 'bloqueio' ? <span className="etiqueta">Carro bloqueado pelo dono</span> : `${r.pedido?.origem?.nome ?? ''}${r.pedido?.origem ? ' → ' : ''}${r.destino ?? '—'}`}
                    {r.tipo === 'imediata' && <div className="sec">Pedido para agora: paga no fim da viagem</div>}
                  </td>
                  <td>
                    {v ? mzn(v) : '—'}
                    {r.pedido?.pagamento && <div className="sec">{r.pedido.pagamento}</div>}
                  </td>
                  <td>{v ? mzn(Math.round(v * COMISSAO)) : '—'}</td>
                  <td>{v ? mzn(v - Math.round(v * COMISSAO)) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p className="vazio">{ver === 'por_fazer' ? 'Sem reservas marcadas.' : 'Ainda não há reservas feitas.'}</p>}
      </div>
    </>
  );
}

function Avaliacoes({ d }: { d: Dados }) {
  const [tipo, setTipo] = useState<'motorista' | 'cliente'>('motorista');
  const lista = d.avaliacoes.filter((a) => a.tipo === tipo);
  const porPessoa = Object.entries(
    lista.reduce<Record<string, Avaliacao[]>>((acc, a) => ({ ...acc, [a.telefone]: [...(acc[a.telefone] ?? []), a] }), {}),
  ).sort((a, b) => (media(a[1]) ?? 0) - (media(b[1]) ?? 0));
  const nomeMotorista = (tel: string) => {
    const i = d.inscricoes.find((x) => (x.dados.motorista?.telefone ?? x.telefone) === tel);
    return i ? (i.dados.motorista?.nome ?? i.dados.nome) : tel;
  };
  return (
    <>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h1>Avaliações</h1>
        <div className="linha">
          <button className={`aba ${tipo === 'motorista' ? 'ativa' : ''}`} onClick={() => setTipo('motorista')}>
            Dos motoristas
          </button>
          <button className={`aba ${tipo === 'cliente' ? 'ativa' : ''}`} onClick={() => setTipo('cliente')}>
            Dos clientes
          </button>
        </div>
      </div>
      <p className="sec">Ordenado da nota mais baixa para a mais alta, para ver primeiro quem precisa de atenção.</p>
      <div className="grelha">
        {porPessoa.map(([tel, l]) => (
          <div key={tel} className="cartao">
            <div style={{ fontWeight: 700 }}>{tipo === 'motorista' ? nomeMotorista(tel) : tel}</div>
            <div className="numero">★ {nota(media(l))}</div>
            <div className="sec">{l.length} avaliações</div>
          </div>
        ))}
      </div>
      <h2>Comentários</h2>
      <div className="rolar">
        <table className="tabela">
          <tbody>
            {lista
              .filter((a) => a.comentario || a.elogios.length)
              .map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{estrelas(a.estrelas)}</td>
                  <td>
                    {a.comentario && <div>«{a.comentario}»</div>}
                    <div className="sec">{a.elogios.join(' · ')}</div>
                  </td>
                  <td className="sec">{tipo === 'motorista' ? nomeMotorista(a.telefone) : a.telefone}</td>
                  <td className="sec">{dataHora(a.em)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="vazio">Sem avaliações.</p>}
      </div>
    </>
  );
}

function Ajuda({ d, demo, mudar, recarregar }: { d: Dados; demo: boolean; mudar: Mudar; recarregar: () => void }) {
  const [respostas, setRespostas] = useState<Record<string, { texto: string; reembolso: string }>>({});
  async function responder(p: PedidoAjuda) {
    const r = respostas[p.id];
    if (!r?.texto.trim()) return;
    const linha = { estado: 'resolvido' as const, resposta: r.texto.trim(), reembolso_mzn: paraMzn(Number(r.reembolso)) || null, respondido_em: new Date().toISOString() };
    if (demo) return mudar((x) => x && { ...x, ajuda: x.ajuda.map((y) => (y.id === p.id ? { ...y, ...linha } : y)) });
    const { error } = await supabase()!.from('pedidos_ajuda').update(linha).eq('id', p.id);
    if (error) alert(`Não foi possível guardar: ${error.message}`);
    recarregar();
  }
  const lista = [...d.ajuda].sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'aberto' ? -1 : 1));
  return (
    <>
      <h1>Pedidos de ajuda</h1>
      <p className="sec">A resposta e o reembolso chegam à app do cliente em menos de um minuto. Em testes, o reembolso não move dinheiro.</p>
      {lista.length === 0 && <p className="vazio">Sem pedidos de ajuda.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {lista.map((p) => (
          <div key={p.id} className="cartao">
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <strong>{TIPOS_AJUDA[p.dados.tipo] ?? p.dados.tipo}</strong>
              <span className={`etiqueta ${p.estado === 'aberto' ? 'laranja' : 'verde'}`}>{p.estado === 'aberto' ? 'Aberto' : 'Resolvido'}</span>
            </div>
            <p style={{ margin: '8px 0' }}>{p.dados.texto}</p>
            <div className="sec">
              {p.dados.clienteNome} · {p.cliente_telefone} · {dataHora(p.criado_em)}
              {p.dados.viagemResumo && <> · {p.dados.viagemResumo}</>}
            </div>
            {p.estado === 'resolvido' ? (
              <p className="sec" style={{ marginTop: 8 }}>
                Resposta: {p.resposta}
                {p.reembolso_mzn ? ` · Reembolso ${mzn(p.reembolso_mzn)}` : ''}
              </p>
            ) : (
              <div className="linha" style={{ marginTop: 12 }}>
                <input
                  className="campo"
                  style={{ flex: 1, minWidth: 220 }}
                  placeholder="Resposta ao cliente"
                  value={respostas[p.id]?.texto ?? ''}
                  onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: { texto: e.target.value, reembolso: r[p.id]?.reembolso ?? '' } }))}
                />
                <input
                  className="campo"
                  style={{ width: 130 }}
                  type="number"
                  min={0}
                  placeholder={`Reembolso ${PAISES[paisPainel()].simbolo}`}
                  value={respostas[p.id]?.reembolso ?? ''}
                  onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: { texto: r[p.id]?.texto ?? '', reembolso: e.target.value } }))}
                />
                <button className="botao verde" onClick={() => responder(p)} disabled={!respostas[p.id]?.texto.trim()}>
                  Responder
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
