-- Chauffeur: o cliente apaga a própria conta dentro da app (a Apple e a Google exigem isto).
-- Corre isto uma vez no SQL Editor do Supabase.
-- A função corre com permissões de dono, mas só apaga a conta de quem a chama (auth.uid()).
create or replace function public.apagar_conta()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.apagar_conta() from public, anon;
grant execute on function public.apagar_conta() to authenticated;
