-- Chauffeur: a base de dados toda, para um projeto Supabase só do Chauffeur (Flavio, 2026-11-18).
-- Correr uma vez num projeto novo: SQL Editor > New query > colar este ficheiro > Run. Pode correr-se outra vez.
-- Substitui painel.sql, partilhas.sql, reservas.sql, push.sql, push-fechar.sql, fotos.sql, agendas-painel.sql,
-- apagar-conta.sql e as migrações de supabase/migrations (esses ficam só para o projeto antigo).
-- Nas funções usa-se $fn$ (o $$ perde-se ao copiar).
--
-- Regra geral: só escreve quem tem sessão (token) do Supabase Auth.
--   • Conta real: entrou por SMS (ou Apple/Google + número confirmado por SMS).
--   • Conta de teste: as contas de demonstração e o "Continuar sem SMS" entram como sessão anónima
--     (Authentication > Sign In / Providers > "Allow anonymous sign-ins" tem de estar ligado).
-- Sem sessão (só a chave pública), a app não lê nem escreve nada, a não ser a página de uma viagem partilhada.

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Quem é quem
-- ─────────────────────────────────────────────────────────────────────────────

-- Administradores do painel: o email da conta criada em Authentication > Users > Add user.
create table if not exists public.administradores (
  email text primary key
);
alter table public.administradores enable row level security;
-- Troca pelo teu email e corre esta linha (podes juntar mais pessoas da equipa).
-- insert into public.administradores (email) values ('o-teu-email@exemplo.com') on conflict do nothing;

create or replace function public.e_admin()
returns boolean
language sql stable security definer set search_path = ''
as $fn$
  select exists (select 1 from public.administradores where email = (auth.jwt() ->> 'email'));
$fn$;

-- O número confirmado por SMS de quem chama, com indicativo (+25884…), ou null (sem sessão ou conta de teste).
create or replace function public.meu_telefone()
returns text
language sql stable set search_path = ''
as $fn$
  select nullif('+' || ltrim(coalesce(auth.jwt() ->> 'phone', ''), '+'), '+');
$fn$;

-- Conta real: tem sessão e não é anónima (conta de teste).
create or replace function public.conta_real()
returns boolean
language sql stable set search_path = ''
as $fn$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$fn$;

revoke all on function public.e_admin(), public.meu_telefone(), public.conta_real() from public;
grant execute on function public.e_admin(), public.meu_telefone(), public.conta_real() to anon, authenticated;

-- Mantém atualizado_em certo em cada mudança.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql set search_path = ''
as $fn$
begin
  new.atualizado_em := now();
  return new;
end;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Contas: o perfil de cada cliente e os seus dados (locais, favoritos, preferências…)
-- ─────────────────────────────────────────────────────────────────────────────

-- Uma linha por conta real. O número vem sempre do login (confirmado por SMS), nunca da app.
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  telefone text unique,
  nome text,
  apelido text,
  -- Email para recibos (não é o email do login).
  email_recibos text,
  pais text not null default 'MZ' check (pais in ('MZ', 'AO')),
  idioma text,
  -- Versão dos termos aceite (VERSAO_TERMOS na app).
  termos_versao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.perfis enable row level security;
drop trigger if exists perfis_atualizado_em on public.perfis;
create trigger perfis_atualizado_em before update on public.perfis for each row execute function public.tocar_atualizado_em();

-- Cada um lê o seu; os administradores leem todos. Escrever, só pela função guardar_perfil.
drop policy if exists "dono le" on public.perfis;
drop policy if exists "admin le" on public.perfis;
create policy "dono le" on public.perfis for select to authenticated using (id = auth.uid());
create policy "admin le" on public.perfis for select to authenticated using (public.e_admin());
revoke insert, update, delete on public.perfis from anon, authenticated;

create or replace function public.guardar_perfil(p_nome text, p_apelido text, p_email text, p_termos text, p_idioma text)
returns void
language plpgsql security definer set search_path = ''
as $fn$
declare
  tel text := public.meu_telefone();
begin
  if not public.conta_real() then return; end if;
  insert into public.perfis (id, telefone, nome, apelido, email_recibos, pais, idioma, termos_versao)
  values (
    auth.uid(), tel, left(p_nome, 60), left(p_apelido, 60), left(p_email, 120),
    case when tel like '+244%' then 'AO' else 'MZ' end, left(p_idioma, 5), left(p_termos, 20)
  )
  on conflict (id) do update set
    telefone = excluded.telefone,
    nome = coalesce(excluded.nome, public.perfis.nome),
    apelido = coalesce(excluded.apelido, public.perfis.apelido),
    email_recibos = coalesce(excluded.email_recibos, public.perfis.email_recibos),
    pais = excluded.pais,
    idioma = coalesce(excluded.idioma, public.perfis.idioma),
    termos_versao = coalesce(excluded.termos_versao, public.perfis.termos_versao);
end;
$fn$;
revoke all on function public.guardar_perfil(text, text, text, text, text) from public, anon;
grant execute on function public.guardar_perfil(text, text, text, text, text) to authenticated;

-- Os dados da conta que a app guardava só no telemóvel: uma linha por conta e por chave
-- (locais, favoritos, preferencias, contactos, partilha, empresa, faturacao, viagens, motorista.turnos, motorista.casa).
-- Assim não se perdem ao trocar de telemóvel. Só contas reais; cada um só vê e muda os seus.
create table if not exists public.dados_conta (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z][a-z0-9.-]{0,40}$'),
  valor jsonb not null check (pg_column_size(valor) <= 262144),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);
alter table public.dados_conta enable row level security;
drop trigger if exists dados_conta_atualizado_em on public.dados_conta;
create trigger dados_conta_atualizado_em before update on public.dados_conta for each row execute function public.tocar_atualizado_em();

drop policy if exists "dono" on public.dados_conta;
create policy "dono" on public.dados_conta for all to authenticated
  using (user_id = auth.uid() and public.conta_real())
  with check (user_id = auth.uid() and public.conta_real());

-- O cliente apaga a própria conta dentro da app (a Apple e a Google exigem isto).
-- Apaga o login; o perfil, os dados e as partilhas vão com ele. Pagamentos e movimentos da carteira ficam, sem dono.
create or replace function public.apagar_conta()
returns void
language sql security definer set search_path = ''
as $fn$
  delete from auth.users where id = auth.uid();
$fn$;
revoke all on function public.apagar_conta() from public, anon;
grant execute on function public.apagar_conta() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Painel: viagens, inscrições de motoristas, avaliações e pedidos de ajuda
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.viagens (
  id text primary key,
  cliente_id uuid default auth.uid() references auth.users (id) on delete set null,
  cliente_telefone text,
  estado text not null,
  total_mzn integer not null default 0,
  viatura text,
  dados jsonb not null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists viagens_criada_em on public.viagens (criada_em desc);
create index if not exists viagens_cliente on public.viagens (cliente_id);

create table if not exists public.inscricoes (
  id text primary key,
  dono_id uuid default auth.uid() references auth.users (id) on delete set null,
  telefone text not null,
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'rejeitada')),
  por_km_mzn integer not null,
  dados jsonb not null,
  enviada_em timestamptz not null default now(),
  decidida_em timestamptz
);
create index if not exists inscricoes_telefone on public.inscricoes (telefone);

create table if not exists public.avaliacoes (
  id text primary key,
  autor_id uuid default auth.uid() references auth.users (id) on delete set null,
  tipo text not null check (tipo in ('motorista', 'cliente')),
  -- Número de quem foi avaliado.
  telefone text not null,
  estrelas smallint not null check (estrelas between 1 and 5),
  elogios text[] not null default '{}',
  comentario text not null default '',
  viagem_id text,
  em timestamptz not null default now()
);

create table if not exists public.pedidos_ajuda (
  id text primary key,
  cliente_id uuid default auth.uid() references auth.users (id) on delete set null,
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

-- Viagens: a app guarda pela função guardar_viagem; o cliente lê as suas, os administradores todas.
drop policy if exists "admin le" on public.viagens;
drop policy if exists "dono le" on public.viagens;
create policy "admin le" on public.viagens for select to authenticated using (public.e_admin());
create policy "dono le" on public.viagens for select to authenticated using (cliente_id = auth.uid());

create or replace function public.guardar_viagem(p_id text, p_cliente_telefone text, p_estado text, p_total_mzn integer, p_viatura text, p_dados jsonb)
returns void
language sql security definer set search_path = ''
as $fn$
  insert into public.viagens (id, cliente_id, cliente_telefone, estado, total_mzn, viatura, dados)
  select p_id, auth.uid(), coalesce(public.meu_telefone(), p_cliente_telefone), p_estado, p_total_mzn, p_viatura, p_dados
  where auth.uid() is not null
  on conflict (id) do update
    set estado = excluded.estado, total_mzn = excluded.total_mzn, dados = excluded.dados, atualizada_em = now()
    -- Só quem criou a viagem a pode atualizar.
    where public.viagens.cliente_id = auth.uid();
$fn$;
revoke all on function public.guardar_viagem(text, text, text, integer, text, jsonb) from public, anon;
grant execute on function public.guardar_viagem(text, text, text, integer, text, jsonb) to authenticated;

-- Inscrições, avaliações e ajuda: quem tem sessão cria (fica como autor); os administradores leem e decidem.
drop policy if exists "app escreve" on public.inscricoes;
drop policy if exists "admin le" on public.inscricoes;
drop policy if exists "dono le" on public.inscricoes;
drop policy if exists "admin decide" on public.inscricoes;
create policy "app escreve" on public.inscricoes for insert to authenticated with check (estado = 'pendente' and dono_id = auth.uid());
create policy "admin le" on public.inscricoes for select to authenticated using (public.e_admin());
create policy "dono le" on public.inscricoes for select to authenticated using (dono_id = auth.uid());
create policy "admin decide" on public.inscricoes for update to authenticated using (public.e_admin()) with check (public.e_admin());

drop policy if exists "app escreve" on public.avaliacoes;
drop policy if exists "admin le" on public.avaliacoes;
create policy "app escreve" on public.avaliacoes for insert to authenticated with check (autor_id = auth.uid());
create policy "admin le" on public.avaliacoes for select to authenticated using (public.e_admin());

drop policy if exists "app escreve" on public.pedidos_ajuda;
drop policy if exists "admin le" on public.pedidos_ajuda;
drop policy if exists "admin responde" on public.pedidos_ajuda;
create policy "app escreve" on public.pedidos_ajuda for insert to authenticated
  with check (estado = 'aberto' and resposta is null and cliente_id = auth.uid());
create policy "admin le" on public.pedidos_ajuda for select to authenticated using (public.e_admin());
create policy "admin responde" on public.pedidos_ajuda for update to authenticated using (public.e_admin()) with check (public.e_admin());

-- As três leituras pelo número. Numa conta real usa sempre o número do login (o que vem de fora é ignorado);
-- numa conta de teste usa o número que a app manda.
create or replace function public.estado_inscricoes(p_telefone text)
returns table (id text, estado text, por_km_mzn integer)
language sql stable security definer set search_path = ''
as $fn$
  select id, estado, por_km_mzn from public.inscricoes
  where auth.uid() is not null and telefone = coalesce(public.meu_telefone(), p_telefone);
$fn$;

create or replace function public.respostas_ajuda(p_telefone text)
returns table (id text, estado text, resposta text, reembolso_mzn integer, respondido_em timestamptz)
language sql stable security definer set search_path = ''
as $fn$
  select id, estado, resposta, reembolso_mzn, respondido_em from public.pedidos_ajuda
  where auth.uid() is not null and cliente_telefone = coalesce(public.meu_telefone(), p_telefone);
$fn$;

-- Resumo do dono: as viagens dos carros que inscreveu, dos últimos 35 dias.
create or replace function public.viagens_dos_carros(p_telefone text)
returns table (id text, viatura_id text, estado text, total_mzn integer, dados jsonb, atualizada_em timestamptz)
language sql stable security definer set search_path = ''
as $fn$
  select v.id, i.id, v.estado, v.total_mzn, v.dados, v.atualizada_em
  from public.viagens v
  join public.inscricoes i on i.id = v.dados ->> 'viaturaId'
  where auth.uid() is not null and i.telefone = coalesce(public.meu_telefone(), p_telefone)
    and v.criada_em > now() - interval '35 days';
$fn$;

revoke all on function public.estado_inscricoes(text), public.respostas_ajuda(text), public.viagens_dos_carros(text) from public, anon;
grant execute on function public.estado_inscricoes(text), public.respostas_ajuda(text), public.viagens_dos_carros(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Viagem partilhada por link (quem recebe o link não precisa de conta)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.partilhas (
  id text primary key check (length(id) >= 16),
  dono uuid default auth.uid() references auth.users (id) on delete cascade,
  dados jsonb not null,
  atualizada_em timestamptz not null default now()
);
alter table public.partilhas enable row level security;
-- Ninguém lê nem escreve a tabela diretamente: só pelas duas funções abaixo.

create or replace function public.guardar_partilha(p_id text, p_dados jsonb)
returns void
language sql security definer set search_path = ''
as $fn$
  insert into public.partilhas (id, dono, dados, atualizada_em)
  select p_id, auth.uid(), p_dados, now()
  where auth.uid() is not null
  on conflict (id) do update
    set dados = excluded.dados, atualizada_em = now()
    where public.partilhas.dono = auth.uid();
$fn$;

-- O link deixa de funcionar 2 horas depois da última atualização.
create or replace function public.ver_partilha(p_id text)
returns jsonb
language sql stable security definer set search_path = ''
as $fn$
  select dados from public.partilhas
  where id = p_id and atualizada_em > now() - interval '2 hours';
$fn$;

revoke all on function public.guardar_partilha(text, jsonb) from public, anon;
grant execute on function public.guardar_partilha(text, jsonb) to authenticated;
revoke all on function public.ver_partilha(text) from public;
grant execute on function public.ver_partilha(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Agenda dos carros (sem sobreposições)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.reservas (
  id text primary key,
  -- Quem fez a reserva (cliente) ou o bloqueio (motorista).
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  viatura_id text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  -- Fim mais a preparação mínima.
  livre_em timestamptz not null,
  tipo text not null check (tipo in ('agendada', 'imediata', 'bloqueio')),
  destino text,
  ponto_inicio jsonb,
  ponto_fim jsonb,
  -- O pedido completo, para a app do motorista mostrar a reserva.
  pedido jsonb,
  criada_em timestamptz not null default now(),
  constraint fim_depois_do_inicio check (fim > inicio and livre_em >= fim),
  -- O mesmo carro não pode ter duas reservas com intervalos que se tocam (erro 23P01).
  constraint sem_sobreposicao exclude using gist (viatura_id with =, tstzrange(inicio, livre_em) with &&)
);
create index if not exists reservas_livre_em on public.reservas (livre_em);

-- Quem tem sessão vê a agenda (para saber que horas estão livres) e reserva em seu nome;
-- só quem criou (ou um administrador) cancela.
alter table public.reservas enable row level security;
drop policy if exists "prototipo ler" on public.reservas;
drop policy if exists "prototipo criar" on public.reservas;
drop policy if exists "prototipo apagar" on public.reservas;
drop policy if exists "sessao le" on public.reservas;
drop policy if exists "sessao cria" on public.reservas;
drop policy if exists "quem criou apaga" on public.reservas;
create policy "sessao le" on public.reservas for select to authenticated using (true);
create policy "sessao cria" on public.reservas for insert to authenticated with check (criado_por = auth.uid());
create policy "quem criou apaga" on public.reservas for delete to authenticated using (criado_por = auth.uid() or public.e_admin());

do $fn$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas'
  ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Avisos push dos motoristas (os tokens ficam escondidos; quem envia é a função enviar-aviso)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.push_motoristas (
  viatura_id text primary key,
  telefone text,
  token text,
  atualizado_em timestamptz not null default now()
);
alter table public.push_motoristas enable row level security;
revoke all on public.push_motoristas from anon, authenticated;

create or replace function public.guardar_push(p_viatura text, p_telefone text, p_token text)
returns void
language sql security definer set search_path = ''
as $fn$
  insert into public.push_motoristas (viatura_id, telefone, token, atualizado_em)
  select left(p_viatura, 80), left(coalesce(public.meu_telefone(), p_telefone), 30), left(p_token, 200), now()
  where auth.uid() is not null
  on conflict (viatura_id) do update
    set telefone = excluded.telefone, token = excluded.token, atualizado_em = excluded.atualizado_em;
$fn$;
revoke all on function public.guardar_push(text, text, text) from public, anon;
grant execute on function public.guardar_push(text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Fotos (inscrições e selfies) no Storage: privadas, só os administradores veem
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('inscricoes', 'inscricoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('selfies', 'selfies', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "app envia fotos" on storage.objects;
drop policy if exists "admin ve fotos" on storage.objects;
create policy "app envia fotos" on storage.objects for insert to authenticated
  with check (bucket_id in ('inscricoes', 'selfies'));
create policy "admin ve fotos" on storage.objects for select to authenticated
  using (bucket_id in ('inscricoes', 'selfies') and public.e_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Pagamentos (DebitoPay em Moçambique, ProxyPay em Angola) e carteira
--    Só as Edge Functions (chave de serviço) escrevem; a app nunca toca nestas tabelas.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  estado text not null default 'pendente' check (estado in ('pendente', 'pago', 'falhou', 'expirado')),
  metodo text not null constraint pagamentos_metodo_check check (metodo in ('mpesa', 'emola', 'multicaixa')),
  telefone text not null,
  valor_mzn numeric(12, 2) not null check (valor_mzn > 0),
  -- A comissão da plataforma (14%) e o que fica para o motorista.
  comissao_mzn numeric(12, 2) not null,
  motorista_mzn numeric(12, 2) not null,
  viatura_id text not null,
  viagem jsonb not null default '{}'::jsonb,
  debitopay_payment_id text unique,
  referencia text,
  erro text,
  pais text not null default 'MZ',
  moeda text not null default 'MZN',
  valor_local numeric(14, 2),
  proxypay_referencia text unique,
  proxypay_pagamento_id bigint unique,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index if not exists pagamentos_estado_idx on public.pagamentos (estado, criado_em desc);
alter table public.pagamentos enable row level security;
drop policy if exists "admin le" on public.pagamentos;
create policy "admin le" on public.pagamentos for select to authenticated using (public.e_admin());

create table if not exists public.pagamentos_eventos (
  id bigint generated always as identity primary key,
  pagamento_id uuid references public.pagamentos (id),
  debitopay_payment_id text,
  proxypay_pagamento_id bigint,
  evento text not null,
  dados jsonb not null,
  recebido_em timestamptz not null default now()
);
alter table public.pagamentos_eventos enable row level security;

-- Carteira com dinheiro real: só contas reais. Positivo entra, negativo sai.
create table if not exists public.carteira_movimentos (
  id uuid primary key default gen_random_uuid(),
  -- Fica sem dono (null) se a conta for apagada, para as contas da empresa baterem certo.
  user_id uuid references auth.users (id) on delete set null,
  valor_mzn numeric(12, 2) not null check (valor_mzn <> 0),
  tipo text not null check (tipo in ('carregamento', 'viagem', 'levantamento')),
  origem text not null unique,
  estado text not null default 'feito' check (estado in ('feito', 'pendente', 'falhou')),
  metodo text check (metodo in ('mpesa', 'emola')),
  telefone text,
  referencia text,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists carteira_movimentos_user_idx on public.carteira_movimentos (user_id, criado_em desc);
alter table public.carteira_movimentos enable row level security;
drop policy if exists "dono le" on public.carteira_movimentos;
create policy "dono le" on public.carteira_movimentos for select to authenticated using (user_id = auth.uid());

create or replace function public.carteira_saldo(u uuid) returns numeric
language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(valor_mzn), 0) from public.carteira_movimentos where user_id = u and estado <> 'falhou';
$fn$;

-- Tira da carteira sem nunca a deixar negativa (um pedido de cada vez por conta).
create or replace function public.carteira_tirar(u uuid, valor numeric, tipo_mov text, origem_mov text, estado_mov text, tudo_ou_nada boolean, metodo_mov text default null, telefone_mov text default null)
returns numeric
language plpgsql security definer set search_path = public as $fn$
declare
  saldo numeric;
  tirar numeric;
  ja numeric;
begin
  if valor <= 0 then raise exception 'valor_invalido'; end if;
  perform pg_advisory_xact_lock(hashtext(u::text));
  ja := (select -m.valor_mzn from public.carteira_movimentos m where m.origem = origem_mov);
  if ja is not null then return ja; end if;
  saldo := public.carteira_saldo(u);
  if tudo_ou_nada and saldo < valor then raise exception 'saldo_insuficiente'; end if;
  tirar := least(valor, greatest(saldo, 0));
  if tirar <= 0 then return 0; end if;
  insert into public.carteira_movimentos (user_id, valor_mzn, tipo, origem, estado, metodo, telefone)
  values (u, -tirar, tipo_mov, origem_mov, estado_mov, metodo_mov, telefone_mov);
  return tirar;
end;
$fn$;

revoke all on function public.carteira_saldo(uuid) from public, anon, authenticated;
revoke all on function public.carteira_tirar(uuid, numeric, text, text, text, boolean, text, text) from public, anon, authenticated;

-- Um carregamento pago entra na carteira.
create or replace function public.carteira_carregamento_pago() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.estado = 'pago' and new.user_id is not null and new.viagem ->> 'tipo' = 'carteira' then
    insert into public.carteira_movimentos (user_id, valor_mzn, tipo, origem, metodo, telefone, referencia)
    values (new.user_id, new.valor_mzn, 'carregamento', 'pagamento:' || new.id, new.metodo, new.telefone, new.referencia)
    on conflict (origem) do nothing;
  end if;
  return new;
end;
$fn$;

drop trigger if exists carteira_carregamento_pago on public.pagamentos;
create trigger carteira_carregamento_pago after insert or update of estado on public.pagamentos
  for each row execute function public.carteira_carregamento_pago();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. O que a app pode tocar diretamente (as regras acima decidem que linhas)
-- ─────────────────────────────────────────────────────────────────────────────

grant select on public.perfis, public.viagens, public.pagamentos, public.carteira_movimentos to authenticated;
grant select, insert, update, delete on public.dados_conta to authenticated;
grant select, insert, update on public.inscricoes, public.pedidos_ajuda to authenticated;
grant select, insert on public.avaliacoes to authenticated;
grant select, insert, delete on public.reservas to authenticated;
