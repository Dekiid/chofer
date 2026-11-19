-- Pagamentos das viagens pela DebitoPay (M-Pesa e e-Mola).
-- O cliente paga antes; o motorista só é chamado quando o estado passa a 'pago'.

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  estado text not null default 'pendente' check (estado in ('pendente', 'pago', 'falhou', 'expirado')),
  metodo text not null check (metodo in ('mpesa', 'emola')),
  telefone text not null,
  valor_mzn numeric(12, 2) not null check (valor_mzn > 0),
  -- A comissão da plataforma (14%) e o que fica para o motorista, registados por viagem.
  comissao_mzn numeric(12, 2) not null,
  motorista_mzn numeric(12, 2) not null,
  viatura_id text not null,
  -- Resumo da viagem (recolha, destino, hora), para o motorista saber para onde ir.
  viagem jsonb not null default '{}'::jsonb,
  debitopay_payment_id text unique,
  referencia text,
  erro text,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists pagamentos_estado_idx on public.pagamentos (estado, criado_em desc);

-- Só as Edge Functions (com a service role) leem e escrevem; a app nunca toca na tabela diretamente.
alter table public.pagamentos enable row level security;

-- Cada evento do webhook fica guardado, para reconciliação e para ignorar repetições.
create table if not exists public.pagamentos_eventos (
  id bigint generated always as identity primary key,
  pagamento_id uuid references public.pagamentos (id),
  debitopay_payment_id text,
  evento text not null,
  dados jsonb not null,
  recebido_em timestamptz not null default now()
);

alter table public.pagamentos_eventos enable row level security;
