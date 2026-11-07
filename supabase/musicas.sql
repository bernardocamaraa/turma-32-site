-- Turma 32 site — a música de cada formando na descida da escada
-- Run once in the SQL Editor, after votacao.sql: the formandos enter /musica
-- the same way they enter the vote, with their WhatsApp
-- (convidados_formando.whatsapp and identificar_eleitor, both from there).
-- Running it again is safe.
--
-- Each formando picks the song they walk down the stairs to — a YouTube
-- video (preferred: the DJ can play any of them) or a Spotify track — and
-- the second it starts at. One song per formando; picking again replaces it.
-- The committee sees everyone's in the "Músicas" tab and hands the list to
-- the DJ.

create table if not exists public.musicas_formando (
  formando text primary key references public.convidados_formando (formando) on update cascade on delete cascade,
  plataforma text not null check (plataforma in ('youtube', 'spotify')),
  -- The video's id (11 characters) or the Spotify track's (22).
  codigo text not null check (codigo ~ '^[A-Za-z0-9_-]{11}$' or codigo ~ '^[A-Za-z0-9]{22}$'),
  -- Looked up by the Edge Function when the song is picked (YouTube/Spotify
  -- oEmbed); null if that failed — the link still says which song it is.
  titulo text check (char_length(titulo) <= 300),
  -- Where the song starts, in seconds from its beginning.
  inicio int not null default 0 check (inicio >= 0 and inicio < 36000),
  atualizado_em timestamptz not null default now()
);

alter table public.musicas_formando enable row level security;
-- Deliberately no policies: the anon key can't read or write it. Only the
-- `musicas` Edge Function can, after checking the WhatsApp or the committee
-- code — a formando never sees a classmate's song (it's a surprise on the
-- night).

-- Lets the committee freeze the choices (e.g. once the list goes to the DJ).
-- Open from the start, so the class can choose as soon as the link is out.
insert into public.configuracoes (chave, valor)
values ('musicas_abertas', true)
on conflict (chave) do nothing;
