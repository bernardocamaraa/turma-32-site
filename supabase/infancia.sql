-- Turma 32 site — fotos de criança
-- Run once in the SQL Editor, after mesas.sql (the formandos come from
-- convidados_formando).
--
-- The formandos send a childhood photo to the committee on WhatsApp; the
-- committee puts each one on the site under that formando's name (/infancia),
-- and whoever makes the video downloads them all in one zip.
--
-- The files themselves are the record — there is no table, so a photo can't
-- be listed without existing, or the other way round. Each one sits in the
-- `fotos-infancia` bucket at <formando slug>/<random id>.<ext> (the slug rule
-- of middleware.ts), and the `infancia` Edge Function lists them with
-- fotos_infancia_arquivos() below.
--
-- The bucket is private because these are photos of the class as children:
-- nothing in it is readable or writable with the anon key. The function
-- checks the committee code and only then hands out signed links (to see and
-- download) and signed upload URLs (the browser sends the file straight to
-- Storage, so a big photo never goes through the function).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-infancia', 'fotos-infancia', false, 26214400, array['image/*'])
on conflict (id) do nothing;
-- Deliberately no storage.objects policies for this bucket.

create or replace function public.fotos_infancia_arquivos()
returns table (caminho text, tamanho bigint, criado_em timestamptz)
language sql
stable
set search_path = ''
as $$
  select o.name, (o.metadata ->> 'size')::bigint, o.created_at
  from storage.objects o
  where o.bucket_id = 'fotos-infancia'
  order by o.created_at;
$$;

-- Only the Edge Function (service role) may call it.
revoke all on function public.fotos_infancia_arquivos() from public, anon, authenticated;
grant execute on function public.fotos_infancia_arquivos() to service_role;
