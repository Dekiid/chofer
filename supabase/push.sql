-- Tokens push dos motoristas do Chauffeur (um por carro).
-- Correr uma vez no Supabase: SQL Editor > New query > colar este ficheiro > Run.
-- Pode correr-se outra vez sem estragar nada.

create table if not exists public.push_motoristas (
  viatura_id text primary key,
  telefone text,
  -- Token do Expo (ExponentPushToken[...]).
  token text,
  atualizado_em timestamptz not null default now()
);

-- PROTÓTIPO, SÓ PARA TESTES: qualquer pessoa com a app pode ler e escrever os tokens.
-- Antes do lançamento é obrigatório fechar isto: o envio passa para uma Supabase Edge Function,
-- a app deixa de poder ler a tabela e cada motorista só pode gravar o token do seu carro (pela conta).
alter table public.push_motoristas enable row level security;
drop policy if exists "prototipo ler" on public.push_motoristas;
drop policy if exists "prototipo criar" on public.push_motoristas;
drop policy if exists "prototipo atualizar" on public.push_motoristas;
create policy "prototipo ler" on public.push_motoristas for select to anon, authenticated using (true);
create policy "prototipo criar" on public.push_motoristas for insert to anon, authenticated with check (true);
create policy "prototipo atualizar" on public.push_motoristas for update to anon, authenticated using (true) with check (true);
