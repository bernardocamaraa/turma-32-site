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

alter table public.rsvps enable row level security;
alter table public.mensagens enable row level security;

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
