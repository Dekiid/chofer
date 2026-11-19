-- Angola: pagamentos por referência Multicaixa pela ProxyPay (pagáveis no Multicaixa Express ou no ATM).
-- Os valores continuam em meticais (valor_mzn); em Angola guarda-se também o valor em kwanzas que o cliente pagou.

alter table public.pagamentos drop constraint if exists pagamentos_metodo_check;
alter table public.pagamentos add constraint pagamentos_metodo_check check (metodo in ('mpesa', 'emola', 'multicaixa'));

alter table public.pagamentos add column if not exists pais text not null default 'MZ';
alter table public.pagamentos add column if not exists moeda text not null default 'MZN';
alter table public.pagamentos add column if not exists valor_local numeric(14, 2);
alter table public.pagamentos add column if not exists proxypay_referencia text unique;
alter table public.pagamentos add column if not exists proxypay_pagamento_id bigint unique;

alter table public.pagamentos_eventos add column if not exists proxypay_pagamento_id bigint;
