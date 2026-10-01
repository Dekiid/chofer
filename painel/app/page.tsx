'use client';

import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { COMISSAO, dataHora, mzn, supabase } from '@/lib/supabase';
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
export type Reserva = { id: string; viatura_id: string; inicio: string; fim: string; tipo: string; destino: string | null };
export type Dados = { viagens: Viagem[]; inscricoes: Inscricao[]; avaliacoes: Avaliacao[]; ajuda: PedidoAjuda[]; reservas: Reserva[] };

const ABAS = ['Resumo', 'Viagens', 'Motoristas', 'Reservas', 'Avaliações', 'Ajuda'] as const;
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
    const [v, i, a, j, r] = await Promise.all([
      sb.from('viagens').select('*').order('criada_em', { ascending: false }).limit(500),
      sb.from('inscricoes').select('*').order('enviada_em', { ascending: false }),
      sb.from('avaliacoes').select('*').order('em', { ascending: false }).limit(500),
      sb.from('pedidos_ajuda').select('*').order('criado_em', { ascending: false }),
      sb.from('reservas').select('id, viatura_id, inicio, fim, tipo, destino').gte('fim', new Date().toISOString()).order('inicio'),
    ]);
    const falhou = [v, i, a, j, r].find((x) => x.error);
    const ficheiro = falhou === r ? 'supabase/reservas.sql' : 'supabase/painel.sql';
    setErro(falhou ? `Não foi possível ler os dados: ${falhou.error!.message}. Correste o ${ficheiro}?` : null);
    setDados({ viagens: v.data ?? [], inscricoes: i.data ?? [], avaliacoes: a.data ?? [], ajuda: j.data ?? [], reservas: r.data ?? [] });
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

  const pendentes = dados?.inscricoes.filter((x) => x.estado === 'pendente').length ?? 0;
  const abertos = dados?.ajuda.filter((x) => x.estado === 'aberto').length ?? 0;

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
            </button>
          ))}
        </nav>
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
        {!dados ? (
          <p className="vazio">A carregar…</p>
        ) : aba === 'Resumo' ? (
          <Resumo d={dados} />
        ) : aba === 'Viagens' ? (
          <Viagens d={dados} />
        ) : aba === 'Motoristas' ? (
          <Motoristas d={dados} demo={demo} mudar={setDados} recarregar={carregar} />
        ) : aba === 'Reservas' ? (
          <Reservas d={dados} />
        ) : aba === 'Avaliações' ? (
          <Avaliacoes d={dados} />
        ) : (
          <Ajuda d={dados} demo={demo} mudar={setDados} recarregar={carregar} />
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
      <h2>Agora</h2>
      <div className="grelha">
        <Numero nome="Viagens em curso" valor={String(d.viagens.filter((x) => x.estado === 'em_curso').length)} />
        <Numero nome="Reservas por fazer" valor={String(d.reservas.filter((x) => x.tipo !== 'bloqueio').length)} />
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
    const por_km_mzn = precos[i.id] ?? i.por_km_mzn;
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
                        value={precos[i.id] ?? i.por_km_mzn}
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

function Reservas({ d }: { d: Dados }) {
  return (
    <>
      <h1>Reservas por fazer</h1>
      <div className="rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Recolha</th>
              <th>Fim</th>
              <th>Carro</th>
              <th>Destino</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {d.reservas.map((r) => (
              <tr key={r.id}>
                <td>{dataHora(r.inicio)}</td>
                <td>{dataHora(r.fim)}</td>
                <td>{r.viatura_id}</td>
                <td>{r.destino ?? '—'}</td>
                <td>
                  <span className="etiqueta">{r.tipo === 'bloqueio' ? 'Carro bloqueado' : r.tipo === 'imediata' ? 'Para agora' : 'Agendada'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.reservas.length === 0 && <p className="vazio">Sem reservas marcadas.</p>}
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
    const linha = { estado: 'resolvido' as const, resposta: r.texto.trim(), reembolso_mzn: Number(r.reembolso) || null, respondido_em: new Date().toISOString() };
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
                  placeholder="Reembolso MT"
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
