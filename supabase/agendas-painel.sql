-- Chauffeur: o painel de gestão passa a ler os pagamentos da DebitoPay (separador Agendas).
-- Correr uma vez no Supabase depois de painel.sql e da tabela pagamentos: SQL Editor > New query > colar > Run.
-- Pode correr-se outra vez sem estragar nada.

-- Os administradores do painel leem os pagamentos (só leitura). A app continua sem acesso: escreve só pelas Edge Functions.
do $fn$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'pagamentos') then
    drop policy if exists "admin le" on public.pagamentos;
    create policy "admin le" on public.pagamentos for select to authenticated using (public.e_admin());
  end if;
end $fn$;
