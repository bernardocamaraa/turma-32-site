-- Turma 32 site — Supabase schema
-- Run this once in your project's SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  formando text not null,
  nome text not null,
  whatsapp text not null,
  pessoas integer not null check (pessoas > 0),
  acompanhantes text[] not null default '{}',
  criado_em timestamptz not null default now()
);

-- Migration for a project created before "acompanhantes" existed:
-- alter table public.rsvps add column if not exists acompanhantes text[] not null default '{}';

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mensagem text not null,
  criado_em timestamptz not null default now()
);

-- Single-row settings table. Today it only holds whether the party album is
-- open to uploads — the committee flips it by hand on the day of the baile
-- (see the "Liberar álbum" button in Área da comissão) instead of the site
-- guessing from the visitor's own clock against a hardcoded date/time.
create table if not exists public.configuracoes (
  chave text primary key,
  valor boolean not null default false
);

insert into public.configuracoes (chave, valor)
values ('album_aberto', false)
on conflict (chave) do nothing;

-- Migration for a project created before "configuracoes" existed:
-- create table if not exists public.configuracoes (chave text primary key, valor boolean not null default false);
-- insert into public.configuracoes (chave, valor) values ('album_aberto', false) on conflict (chave) do nothing;
-- alter table public.configuracoes enable row level security;
-- create policy "anyone can read configuracoes" on public.configuracoes for select to anon using (true);

-- Photos guests upload to the live party album. `caminho` is the path of the
-- file inside the `fotos-album` Storage bucket — the public URL is built
-- from it on the client (see lib/supabase.ts).
create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  caminho text not null,
  legenda text,
  criado_em timestamptz not null default now()
);

-- Storage bucket the photos live in. Public so <img> tags can load them with
-- a plain URL — no signed links or extra round trips needed just to view
-- the album. `file_size_limit` and `allowed_mime_types` are a first line of
-- defense against someone uploading something huge or non-image straight to
-- the API; the RLS policy below (album must be open) is the second.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-album', 'fotos-album', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

-- Migration for a project created before "fotos" existed — run this whole
-- block once in the SQL Editor (it includes the two policies further below,
-- copied here so this migration is self-contained):
--
-- create table if not exists public.fotos (id uuid primary key default gen_random_uuid(), caminho text not null, legenda text, criado_em timestamptz not null default now());
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('fotos-album', 'fotos-album', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']) on conflict (id) do nothing;
-- alter table public.fotos enable row level security;
-- create policy "anyone can read fotos" on public.fotos for select to anon using (true);
-- create policy "anon can add fotos while album is open" on public.fotos for insert to anon with check (coalesce((select valor from public.configuracoes where chave = 'album_aberto'), false) = true);
-- create policy "anyone can view fotos-album files" on storage.objects for select to anon using (bucket_id = 'fotos-album');
-- create policy "anon can upload to fotos-album while album is open" on storage.objects for insert to anon with check (bucket_id = 'fotos-album' and coalesce((select valor from public.configuracoes where chave = 'album_aberto'), false) = true);

alter table public.rsvps enable row level security;
alter table public.mensagens enable row level security;
alter table public.configuracoes enable row level security;
alter table public.fotos enable row level security;

-- Every visitor's browser needs to know if the album is open, so this one is
-- readable by anon — it's not sensitive, just a flag. It stays write-only
-- through the committee-data Edge Function (service role key, gated by the
-- access code); there is deliberately no anon INSERT/UPDATE policy here.
create policy "anyone can read configuracoes" on public.configuracoes
  for select to anon
  using (true);

-- Guests submit the RSVP form and the "fale com a comissão" form anonymously
-- (no login on this site), so INSERT must be open to the anon key.
create policy "anon can submit rsvps" on public.rsvps
  for insert to anon
  with check (true);

create policy "anon can submit mensagens" on public.mensagens
  for insert to anon
  with check (true);

-- Deliberately no SELECT policy for anon/authenticated: the anon key ships in
-- the browser bundle, so if these tables were readable with it, anyone could
-- read every guest's name, WhatsApp number and message without ever entering
-- the committee's access code. Reads only happen through the `committee-data`
-- Edge Function, which holds the service role key server-side (bypassing RLS)
-- and checks the shared access code before returning anything.

-- Photos are the opposite of rsvps/mensagens: the whole point is that every
-- visitor sees them, so SELECT is public. Anyone can also INSERT a row (no
-- login on this site) — but only while the committee has the album open;
-- the same check is duplicated in the Storage policy below so a photo row
-- can't exist without its file, and vice versa. There is no anon UPDATE or
-- DELETE policy: removing a photo only happens through committee-data
-- (service role key), gated by the access code, so a guest can't delete
-- someone else's upload straight through the API.
create policy "anyone can read fotos" on public.fotos
  for select to anon
  using (true);

create policy "anon can add fotos while album is open" on public.fotos
  for insert to anon
  with check (
    coalesce((select valor from public.configuracoes where chave = 'album_aberto'), false) = true
  );

-- Storage policies mirror the table policies above: public read (also true
-- via the bucket's own "public" flag, but explicit here for the JS client),
-- anon upload only while the album is open, no anon update/delete.
create policy "anyone can view fotos-album files" on storage.objects
  for select to anon
  using (bucket_id = 'fotos-album');

create policy "anon can upload to fotos-album while album is open" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'fotos-album'
    and coalesce((select valor from public.configuracoes where chave = 'album_aberto'), false) = true
  );
