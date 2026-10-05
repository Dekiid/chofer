-- Esconde os tokens push: a app deixa de conseguir ler ou mexer na tabela push_motoristas.
-- Correr SÓ depois de publicar a função enviar-aviso e pôr EXPO_PUBLIC_AVISOS_SERVIDOR=1 no .env.local.
-- O motorista grava o token do seu carro pela função guardar_push; quem envia os avisos é a função
-- enviar-aviso (com a chave de serviço). Pode correr-se outra vez sem estragar nada.
create or replace function public.guardar_push(p_viatura text, p_telefone text, p_token text)
returns void
language sql
security definer
set search_path = public
as $fn$
  insert into public.push_motoristas (viatura_id, telefone, token, atualizado_em)
  values (left(p_viatura, 80), left(p_telefone, 30), left(p_token, 200), now())
  on conflict (viatura_id) do update
    set telefone = excluded.telefone, token = excluded.token, atualizado_em = excluded.atualizado_em;
$fn$;
revoke all on function public.guardar_push(text, text, text) from public;
grant execute on function public.guardar_push(text, text, text) to anon, authenticated;

drop policy if exists "prototipo ler" on public.push_motoristas;
drop policy if exists "prototipo criar" on public.push_motoristas;
drop policy if exists "prototipo atualizar" on public.push_motoristas;
revoke all on public.push_motoristas from anon, authenticated;
