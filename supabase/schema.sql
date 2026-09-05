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

alter table public.rsvps enable row level security;
alter table public.mensagens enable row level security;
alter table public.configuracoes enable row level security;

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
