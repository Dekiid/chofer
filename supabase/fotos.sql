-- Fotos no Supabase Storage: as das inscrições dos motoristas (carro e documentos) e as selfies antes de ficar online.
-- Correr no SQL Editor do Supabase depois do painel.sql (usa public.e_admin()). Pode correr-se mais do que uma vez.
-- Os baldes são privados: a app envia, só os administradores do painel veem. Até 5 MB por foto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('inscricoes', 'inscricoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('selfies', 'selfies', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "app envia fotos" on storage.objects;
drop policy if exists "admin ve fotos" on storage.objects;

-- Protótipo: as inscrições também entram sem conta (como a tabela inscricoes). Só se pode criar, não ler nem trocar.
create policy "app envia fotos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id in ('inscricoes', 'selfies'));

create policy "admin ve fotos" on storage.objects
  for select to authenticated
  using (bucket_id in ('inscricoes', 'selfies') and public.e_admin());
