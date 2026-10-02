-- Carteira com dinheiro real (Flavio, 2026-10-02): o saldo que se pode levantar vive no servidor, não no telemóvel.
-- Entra: carregamentos pagos pela DebitoPay. Sai: a parte das viagens paga com a carteira e os levantamentos para o M-Pesa / e-Mola.
-- Os créditos que a app dá sozinha (reembolsos de cancelamento, convites) ficam só no telemóvel e não se levantam.
-- Pode correr-se outra vez sem estragar nada. Nas funções usa-se $fn$ (o $$ perde-se ao copiar).

-- Quem fez cada pagamento (só com sessão por SMS); serve para pôr os carregamentos na carteira certa.
alter table public.pagamentos add column if not exists user_id uuid references auth.users (id);

create table if not exists public.carteira_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  -- Positivo entra, negativo sai.
  valor_mzn numeric(12, 2) not null check (valor_mzn <> 0),
  tipo text not null check (tipo in ('carregamento', 'viagem', 'levantamento')),
  -- Um movimento por origem: o mesmo carregamento, viagem ou levantamento nunca conta duas vezes.
  origem text not null unique,
  -- Um levantamento fica 'pendente' até a DebitoPay responder; um que 'falhou' deixa de contar.
  estado text not null default 'feito' check (estado in ('feito', 'pendente', 'falhou')),
  metodo text check (metodo in ('mpesa', 'emola')),
  telefone text,
  referencia text,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists carteira_movimentos_user_idx on public.carteira_movimentos (user_id, criado_em desc);

-- Cada cliente vê só os seus movimentos; escrever, só as Edge Functions (service role).
alter table public.carteira_movimentos enable row level security;
drop policy if exists "dono le" on public.carteira_movimentos;
create policy "dono le" on public.carteira_movimentos for select to authenticated using (user_id = auth.uid());

-- Saldo que se pode usar ou levantar: os levantamentos pendentes já estão descontados.
create or replace function public.carteira_saldo(u uuid) returns numeric
language sql stable security definer set search_path = public as $fn$
  select coalesce(sum(valor_mzn), 0) from public.carteira_movimentos where user_id = u and estado <> 'falhou';
$fn$;

-- Tira da carteira sem nunca a deixar negativa. Um cliente de cada vez (trinco por conta), para dois pedidos ao mesmo tempo
-- não levantarem o mesmo dinheiro. Com «tudo_ou_nada», recusa se não houver saldo (levantamentos);
-- sem ele, tira o que houver até ao valor (viagens). Devolve o que tirou; repetir a mesma origem não tira outra vez.
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
  select -valor_mzn into ja from public.carteira_movimentos where origem = origem_mov;
  if found then return ja; end if;
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

-- Um carregamento pago entra na carteira, venha a confirmação do webhook, da consulta ou da resposta imediata do M-Pesa.
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
