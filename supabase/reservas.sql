-- Agenda dos carros do Chauffeur.
-- Correr uma vez no Supabase: SQL Editor > New query > colar este ficheiro > Run.
-- Pode correr-se outra vez sem estragar nada.

-- Permite misturar "o mesmo carro" (=) e "intervalos que se tocam" (&&) na mesma regra.
create extension if not exists btree_gist;

create table if not exists public.reservas (
  id text primary key,
  viatura_id text not null,
  -- Hora da recolha.
  inicio timestamptz not null,
  -- Fim da viagem (ou do aluguer).
  fim timestamptz not null,
  -- Fim mais a preparação mínima. A folga com o tempo de condução até à reserva seguinte é a app que a calcula.
  livre_em timestamptz not null,
  tipo text not null check (tipo in ('agendada', 'imediata', 'bloqueio')),
  destino text,
  ponto_inicio jsonb,
  ponto_fim jsonb,
  -- O pedido completo, para a app do motorista mostrar a reserva mesmo que estivesse fechada quando o cliente pagou.
  pedido jsonb,
  criada_em timestamptz not null default now(),
  constraint fim_depois_do_inicio check (fim > inicio and livre_em >= fim),
  -- A regra que impede sobreposições: o mesmo carro não pode ter duas reservas com intervalos que se tocam.
  -- Se dois clientes pagarem ao mesmo tempo, o segundo recebe o erro 23P01 e a app pede-lhe outra hora.
  constraint sem_sobreposicao exclude using gist (viatura_id with =, tstzrange(inicio, livre_em) with &&)
);

create index if not exists reservas_livre_em on public.reservas (livre_em);

-- Protótipo: qualquer pessoa com a app pode ver, criar e apagar reservas.
-- Antes de abrir ao público, isto passa a depender da conta (cliente vê as suas, motorista as do seu carro).
alter table public.reservas enable row level security;
drop policy if exists "prototipo ler" on public.reservas;
drop policy if exists "prototipo criar" on public.reservas;
drop policy if exists "prototipo apagar" on public.reservas;
create policy "prototipo ler" on public.reservas for select to anon, authenticated using (true);
create policy "prototipo criar" on public.reservas for insert to anon, authenticated with check (true);
create policy "prototipo apagar" on public.reservas for delete to anon, authenticated using (true);

-- As reservas novas chegam logo aos outros telemóveis (Realtime).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas'
  ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
end $$;
