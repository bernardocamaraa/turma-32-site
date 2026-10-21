-- Turma 32 site — Supabase schema
-- Run this once in your project's SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- The site no longer collects confirmations: the guest list is handled in the
-- venue's own portal, where each formando logs in and registers their guests.
-- Keeping a second list here would just create two sources of truth.
-- If your project already ran an older version of this file, drop the table
-- (only after checking it has nothing you want to keep):
-- drop table if exists public.rsvps;

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

-- Guests send the "fale com a comissão" form anonymously (no login on this
-- site), so INSERT must be open to the anon key.
create policy "anon can submit mensagens" on public.mensagens
  for insert to anon
  with check (true);

-- Deliberately no SELECT policy for anon/authenticated: the anon key ships in
-- the browser bundle, so if this table were readable with it, anyone could
-- read every message ever sent without entering the committee's access code. Reads only happen through the `committee-data`
-- Edge Function, which holds the service role key server-side (bypassing RLS)
-- and checks the shared access code before returning anything.

-- Photos are the opposite of mensagens: the whole point is that every
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

-- ---------------------------------------------------------------------------
-- Mapa de mesas
--
-- Each formando picks where their group sits on the venue's table map
-- (src/lib/mesas.ts draws it). The committee sets how many people each
-- formando brings — copied from the venue's portal, which stays the one
-- guest list — and the formando only distributes those seats.
--
-- Nothing here is readable or writable with the anon key: the map is behind
-- the class code, so every read and write goes through the `mesas` Edge
-- Function (service role key), the same pattern as committee-data.
-- ---------------------------------------------------------------------------

-- One row per table on the map. `reservada_para` marks the tables formandos
-- can't pick themselves (professores, comissão) — only the committee code
-- can seat someone there.
create table if not exists public.mesas (
  id text primary key,
  capacidade int not null default 10 check (capacidade > 0),
  reservada_para text check (reservada_para in ('professores', 'comissao'))
);

insert into public.mesas (id, reservada_para) values
  ('E1', null), ('E2', null), ('E3', null), ('E4', null),
  ('E5', null), ('E6', null), ('E7', null), ('E8', null),
  ('E9', null), ('E10', null), ('E11', null), ('E12', null),
  ('E13', null), ('E14', null),
  ('R1', 'comissao'), ('R2', 'comissao'),
  ('D1', null), ('D2', null), ('D3', null), ('D4', null),
  ('P', 'professores')
on conflict (id) do nothing;

-- How many people each formando brings, the formando included. Starts at 0:
-- the committee fills it in from the venue's portal. Names must match
-- src/lib/formandos.ts exactly — the Edge Function looks formandos up here.
create table if not exists public.convidados_formando (
  formando text primary key,
  total int not null default 0 check (total >= 0 and total <= 60)
);

insert into public.convidados_formando (formando) values
  ('Anna Carolina Russo'), ('Anna Clara Ribeiro'), ('Arthur Caetano'), ('Arthur Oliveira'),
  ('Bernardo Câmara'), ('Bernardo Ignácio'), ('Caio Bezerra'), ('Carolina Warrak'),
  ('Enzo Louro'), ('Geovanna Russo'), ('Guilherme Warrak'), ('Isabella Guimarães'),
  ('Isabella Monteiro'), ('João Pedro Jardim'), ('Laís Boldrim'), ('Laura Viana'),
  ('Lívia Whitaker'), ('Lorenzo Nunes'), ('Lucas Loyola'), ('Lucas Varejão'),
  ('Luiza Goes'), ('Maian Costa'), ('Maria Clara Bispo'), ('Maria Clara França'),
  ('Maria Eduarda Barroso'), ('Maria Luiza Pires'), ('Matheus Veiga'), ('Pietra Machado'),
  ('Raira Gabriela'), ('Sophia Afonso'), ('Suellen Bazillio'), ('Susana Liu')
on conflict (formando) do nothing;

-- How many of a formando's seats are at a given table. A formando can be
-- split across tables (e.g. 6 here, 4 next door) — and a table is usually
-- shared by several formandos with small groups.
create table if not exists public.reservas_mesa (
  formando text not null references public.convidados_formando (formando) on delete cascade,
  mesa text not null references public.mesas (id) on delete cascade,
  lugares int not null check (lugares > 0),
  atualizado_em timestamptz not null default now(),
  primary key (formando, mesa)
);

-- Lets the committee freeze the map (e.g. once it's sent to the venue).
insert into public.configuracoes (chave, valor)
values ('mesas_abertas', true)
on conflict (chave) do nothing;

alter table public.mesas enable row level security;
alter table public.convidados_formando enable row level security;
alter table public.reservas_mesa enable row level security;
-- Deliberately no policies on these three: anon can't read or write them.

-- Sets how many of `p_formando`'s seats are at `p_mesa` (0 removes them).
-- Capacity has to be checked and written atomically: two formandos clicking
-- the last free seats at the same moment would both pass a check done in
-- the browser or in two separate queries. Locking the table's row first
-- makes concurrent calls for the same table wait their turn; the formando's
-- row is locked second so the same formando can't overbook from two tabs.
create or replace function public.definir_lugares(p_formando text, p_mesa text, p_lugares int, p_comissao boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacidade int;
  v_reservada text;
  v_total int;
  v_ocupados int;
  v_meus_outros int;
begin
  if p_lugares is null or p_lugares < 0 then
    raise exception 'Quantidade de lugares inválida.';
  end if;

  if not p_comissao and not coalesce((select valor from configuracoes where chave = 'mesas_abertas'), false) then
    raise exception 'O mapa de mesas está fechado pela comissão.';
  end if;

  select capacidade, reservada_para into v_capacidade, v_reservada from mesas where id = p_mesa for update;
  if not found then
    raise exception 'Mesa não encontrada.';
  end if;
  if v_reservada is not null and not p_comissao then
    raise exception 'Essa mesa é reservada (%) e só a comissão pode marcar lugares nela.',
      case v_reservada when 'professores' then 'professores' else 'comissão' end;
  end if;

  select total into v_total from convidados_formando where formando = p_formando for update;
  if not found then
    raise exception 'Formando não encontrado.';
  end if;

  select coalesce(sum(lugares), 0) into v_ocupados from reservas_mesa where mesa = p_mesa and formando <> p_formando;
  if v_ocupados + p_lugares > v_capacidade then
    raise exception 'Essa mesa só tem % lugar(es) livre(s).', v_capacidade - v_ocupados;
  end if;

  select coalesce(sum(lugares), 0) into v_meus_outros from reservas_mesa where formando = p_formando and mesa <> p_mesa;
  if v_meus_outros + p_lugares > v_total then
    raise exception 'Você só tem % lugar(es) para distribuir.', greatest(v_total - v_meus_outros, 0);
  end if;

  if p_lugares = 0 then
    delete from reservas_mesa where formando = p_formando and mesa = p_mesa;
  else
    insert into reservas_mesa (formando, mesa, lugares) values (p_formando, p_mesa, p_lugares)
    on conflict (formando, mesa) do update set lugares = excluded.lugares, atualizado_em = now();
  end if;
end;
$$;

-- Committee-only: how many people a formando brings. Refuses to go below the
-- seats already marked on the map, so the map never shows someone with more
-- seats than guests — the formando (or committee) frees seats first.
create or replace function public.definir_convidados(p_formando text, p_total int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marcados int;
begin
  if p_total is null or p_total < 0 or p_total > 60 then
    raise exception 'Número de convidados inválido.';
  end if;
  perform 1 from convidados_formando where formando = p_formando for update;
  if not found then
    raise exception 'Formando não encontrado.';
  end if;
  select coalesce(sum(lugares), 0) into v_marcados from reservas_mesa where formando = p_formando;
  if p_total < v_marcados then
    raise exception '% já tem % lugar(es) marcado(s) no mapa. Tire lugares do mapa antes de diminuir.', p_formando, v_marcados;
  end if;
  update convidados_formando set total = p_total where formando = p_formando;
end;
$$;

-- Only the Edge Function (service role) may call these.
revoke all on function public.definir_lugares(text, text, int, boolean) from public, anon, authenticated;
revoke all on function public.definir_convidados(text, int) from public, anon, authenticated;
grant execute on function public.definir_lugares(text, text, int, boolean) to service_role;
grant execute on function public.definir_convidados(text, int) to service_role;
