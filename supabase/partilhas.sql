-- Chauffeur: viagem partilhada por link. Quem recebe o link vê o carro no mapa, o motorista e a chegada,
-- sem ter a app nem conta. Corre isto uma vez no SQL Editor do Supabase.
--
-- O telemóvel do cliente guarda aqui um resumo da viagem e atualiza-o enquanto ela dura.
-- A página do link lê o resumo pelo id (aleatório e difícil de adivinhar) e recebe a posição do carro em direto.
-- O link deixa de funcionar 2 horas depois da última atualização.
create table if not exists public.partilhas (
  id text primary key check (length(id) >= 16),
  -- Dono da partilha quando a conta usa SMS; vazio em testes (contas só no telemóvel).
  dono uuid default auth.uid() references auth.users (id) on delete cascade,
  dados jsonb not null,
  atualizada_em timestamptz not null default now()
);

alter table public.partilhas enable row level security;
-- Ninguém lê nem escreve a tabela diretamente: só pelas duas funções abaixo.

-- O cliente cria ou atualiza a partilha da sua viagem. Em testes, sem conta no Supabase, também pode (o id é aleatório).
create or replace function public.guardar_partilha(p_id text, p_dados jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.partilhas (id, dono, dados, atualizada_em)
  values (p_id, auth.uid(), p_dados, now())
  on conflict (id) do update
    set dados = excluded.dados, atualizada_em = now()
    where public.partilhas.dono is not distinct from auth.uid();
$$;

-- Quem tem o link lê a partilha, sem conta.
create or replace function public.ver_partilha(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select dados from public.partilhas
  where id = p_id and atualizada_em > now() - interval '2 hours';
$$;

revoke all on function public.guardar_partilha(text, jsonb) from public;
grant execute on function public.guardar_partilha(text, jsonb) to anon, authenticated;
revoke all on function public.ver_partilha(text) from public;
grant execute on function public.ver_partilha(text) to anon, authenticated;

-- Para quem já tinha corrido a versão anterior deste ficheiro.
alter table public.partilhas alter column dono drop not null;
