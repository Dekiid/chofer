-- Chauffeur: dados para o painel de gestão na web (pasta painel/).
-- Correr uma vez no Supabase: SQL Editor > New query > colar este ficheiro > Run. Pode correr-se outra vez.
--
-- A app envia para aqui as viagens, as inscrições de motoristas, as avaliações e os pedidos de ajuda.
-- O painel entra com email e palavra-passe de um administrador e vê tudo; aprova motoristas e responde à ajuda.
--
-- Protótipo: enquanto as contas da app não usarem SMS, a app escreve como "anon". Ninguém de fora lê
-- estas tabelas: só os administradores (pelo painel) e, nas inscrições, o próprio motorista pelo seu número.

-- 1. Administradores do painel: o email da conta criada em Authentication > Users > Add user.
create table if not exists public.administradores (
  email text primary key
);
alter table public.administradores enable row level security;
-- Troca pelo teu email e corre esta linha (podes juntar mais pessoas da equipa).
-- insert into public.administradores (email) values ('o-teu-email@exemplo.com') on conflict do nothing;

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (select 1 from public.administradores where email = (auth.jwt() ->> 'email'));
$fn$;
grant execute on function public.e_admin() to anon, authenticated;

-- 2. Viagens (cada telemóvel de cliente envia as suas; atualiza quando muda o estado).
create table if not exists public.viagens (
  id text primary key,
  cliente_telefone text,
  estado text not null,
  total_mzn integer not null default 0,
  viatura text,
  dados jsonb not null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists viagens_criada_em on public.viagens (criada_em desc);

-- 3. Inscrições de motoristas e dos seus carros.
create table if not exists public.inscricoes (
  id text primary key,
  telefone text not null,
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'rejeitada')),
  por_km_mzn integer not null,
  dados jsonb not null,
  enviada_em timestamptz not null default now(),
  decidida_em timestamptz
);

-- 4. Avaliações: o cliente avalia o motorista e o motorista avalia o cliente.
create table if not exists public.avaliacoes (
  id text primary key,
  tipo text not null check (tipo in ('motorista', 'cliente')),
  -- Número de quem foi avaliado.
  telefone text not null,
  estrelas smallint not null check (estrelas between 1 and 5),
  elogios text[] not null default '{}',
  comentario text not null default '',
  viagem_id text,
  em timestamptz not null default now()
);

-- 5. Pedidos de ajuda (objetos perdidos, cobranças, queixas).
create table if not exists public.pedidos_ajuda (
  id text primary key,
  cliente_telefone text,
  estado text not null default 'aberto' check (estado in ('aberto', 'resolvido')),
  dados jsonb not null,
  resposta text,
  reembolso_mzn integer,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);

alter table public.viagens enable row level security;
alter table public.inscricoes enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.pedidos_ajuda enable row level security;

-- Viagens: a app guarda pela função guardar_viagem (cria ou atualiza); só os administradores leem.
drop policy if exists "admin le" on public.viagens;
create policy "admin le" on public.viagens for select to authenticated using (public.e_admin());

create or replace function public.guardar_viagem(p_id text, p_cliente_telefone text, p_estado text, p_total_mzn integer, p_viatura text, p_dados jsonb)
returns void
language sql
security definer
set search_path = ''
as $fn$
  insert into public.viagens (id, cliente_telefone, estado, total_mzn, viatura, dados)
  values (p_id, p_cliente_telefone, p_estado, p_total_mzn, p_viatura, p_dados)
  on conflict (id) do update
    set estado = excluded.estado, total_mzn = excluded.total_mzn, dados = excluded.dados, atualizada_em = now()
    -- Protótipo: só o mesmo número pode atualizar a sua viagem.
    where public.viagens.cliente_telefone is not distinct from excluded.cliente_telefone;
$fn$;
grant execute on function public.guardar_viagem(text, text, text, integer, text, jsonb) to anon, authenticated;

-- Inscrições, avaliações e ajuda: a app só cria; só os administradores leem.

drop policy if exists "app escreve" on public.inscricoes;
drop policy if exists "admin le" on public.inscricoes;
drop policy if exists "admin decide" on public.inscricoes;
create policy "app escreve" on public.inscricoes for insert to anon, authenticated with check (estado = 'pendente');
create policy "admin le" on public.inscricoes for select to authenticated using (public.e_admin());
create policy "admin decide" on public.inscricoes for update to authenticated using (public.e_admin()) with check (public.e_admin());

drop policy if exists "app escreve" on public.avaliacoes;
drop policy if exists "admin le" on public.avaliacoes;
create policy "app escreve" on public.avaliacoes for insert to anon, authenticated with check (true);
create policy "admin le" on public.avaliacoes for select to authenticated using (public.e_admin());

drop policy if exists "app escreve" on public.pedidos_ajuda;
drop policy if exists "admin le" on public.pedidos_ajuda;
drop policy if exists "admin responde" on public.pedidos_ajuda;
create policy "app escreve" on public.pedidos_ajuda for insert to anon, authenticated with check (estado = 'aberto' and resposta is null);
create policy "admin le" on public.pedidos_ajuda for select to authenticated using (public.e_admin());
create policy "admin responde" on public.pedidos_ajuda for update to authenticated using (public.e_admin()) with check (public.e_admin());

-- O motorista vê como está a sua inscrição (pelo número), sem poder ver as dos outros.
create or replace function public.estado_inscricoes(p_telefone text)
returns table (id text, estado text, por_km_mzn integer)
language sql
stable
security definer
set search_path = ''
as $fn$
  select id, estado, por_km_mzn from public.inscricoes where telefone = p_telefone;
$fn$;
grant execute on function public.estado_inscricoes(text) to anon, authenticated;

-- O cliente vê a resposta aos seus pedidos de ajuda.
create or replace function public.respostas_ajuda(p_telefone text)
returns table (id text, estado text, resposta text, reembolso_mzn integer, respondido_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select id, estado, resposta, reembolso_mzn, respondido_em from public.pedidos_ajuda where cliente_telefone = p_telefone;
$fn$;
grant execute on function public.respostas_ajuda(text) to anon, authenticated;

-- Resumo do dono: as viagens dos carros que inscreveu, dos últimos 35 dias.
-- Protótipo: pede só o número. Quando as contas usarem SMS, passa a usar o número da sessão (auth.jwt()).
create or replace function public.viagens_dos_carros(p_telefone text)
returns table (id text, viatura_id text, estado text, total_mzn integer, dados jsonb, atualizada_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select v.id, i.id, v.estado, v.total_mzn, v.dados, v.atualizada_em
  from public.viagens v
  join public.inscricoes i on i.id = v.dados ->> 'viaturaId'
  where i.telefone = p_telefone and v.criada_em > now() - interval '35 days';
$fn$;
grant execute on function public.viagens_dos_carros(text) to anon, authenticated;
