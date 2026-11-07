-- Turma 32 site — a música de cada formando na descida da escada
-- Run once in the SQL Editor, after votacao.sql: the formandos enter /musica
-- the same way they enter the vote, with their WhatsApp
-- (convidados_formando.whatsapp and identificar_eleitor, both from there).
-- Running it again is safe.
--
-- Each formando picks the song they walk down the stairs to — a YouTube
-- video (the DJ can play any of them) — and the second it starts at. One song per formando; picking again replaces it.
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

-- ---------------------------------------------------------------------------
-- Descer em grupo: up to 3 formandos walk down together, to one song.
--
-- One formando creates the group and invites one or two classmates; each
-- invitee sees the invitation when they enter /musica and accepts or
-- refuses. Once everyone invited has accepted (and there are at least two),
-- the group is complete and any of them picks the group's song — while it
-- is, their own songs (musicas_formando) are set aside, not deleted: if the
-- group comes apart, each one's song is back.
--
-- A formando is in at most one group (the unique index below, on accepted
-- memberships), but may have invitations from several, and picks which to
-- accept. Invitations are never refused for them: the others stay waiting
-- (the creator sees they're in another group). They can also say they'll
-- walk down without a group (musicas_sem_grupo) — the invitations still
-- stand, the creators see it, and accepting one later is still possible.
-- The creator can invite more (3 in all), withdraw an invitation, or undo
-- the group; anyone else can leave it.
-- ---------------------------------------------------------------------------

create table if not exists public.musicas_grupos (
  id uuid primary key default gen_random_uuid(),
  criado_por text not null references public.convidados_formando (formando) on update cascade on delete cascade,
  -- The group's song, once it's complete and someone picked it (same
  -- columns as musicas_formando).
  plataforma text check (plataforma in ('youtube', 'spotify')),
  codigo text check (codigo ~ '^[A-Za-z0-9_-]{11}$' or codigo ~ '^[A-Za-z0-9]{22}$'),
  titulo text check (char_length(titulo) <= 300),
  inicio int not null default 0 check (inicio >= 0 and inicio < 36000),
  musica_em timestamptz,
  criado_em timestamptz not null default now(),
  check ((plataforma is null) = (codigo is null))
);

create table if not exists public.musicas_grupo_membros (
  grupo uuid not null references public.musicas_grupos (id) on delete cascade,
  formando text not null references public.convidados_formando (formando) on update cascade on delete cascade,
  status text not null default 'convidado' check (status in ('convidado', 'aceito', 'recusado')),
  atualizado_em timestamptz not null default now(),
  primary key (grupo, formando)
);

-- Who said they'll walk down without a group (see above).
create table if not exists public.musicas_sem_grupo (
  formando text primary key references public.convidados_formando (formando) on update cascade on delete cascade,
  em timestamptz not null default now()
);
alter table public.musicas_sem_grupo enable row level security;

-- One group per formando: two acceptances at the same moment can't both win.
create unique index if not exists musicas_um_grupo_por_formando
  on public.musicas_grupo_membros (formando) where status = 'aceito';

alter table public.musicas_grupos enable row level security;
alter table public.musicas_grupo_membros enable row level security;
-- Deliberately no policies, like musicas_formando: only the Edge Function.

-- Whether `p_convidado` can be invited by `p_formando` — raises the reason if not.
create or replace function public.musica_conferir_convite(p_formando text, p_convidado text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_convidado = p_formando then
    raise exception 'Você já está no grupo.';
  end if;
  if not exists (select 1 from convidados_formando where formando = p_convidado) then
    raise exception 'Escolha nomes da lista da turma.';
  end if;
  if exists (select 1 from musicas_grupo_membros where formando = p_convidado and status = 'aceito') then
    raise exception '% já está em outro grupo.', p_convidado;
  end if;
end;
$$;

-- `p_formando` creates a group and invites `p_convidados` (1 or 2 names).
create or replace function public.musica_criar_grupo(p_formando text, p_convidados text[])
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_grupo uuid;
  v_nome text;
  v_nomes text[] := array(select distinct unnest(p_convidados));
begin
  if exists (select 1 from musicas_grupo_membros where formando = p_formando and status = 'aceito') then
    raise exception 'Você já está num grupo. Saia dele antes de criar outro.';
  end if;
  if coalesce(array_length(v_nomes, 1), 0) < 1 then
    raise exception 'Escolha quem vai descer com você.';
  end if;
  if array_length(v_nomes, 1) > 2 then
    raise exception 'O grupo pode ter no máximo 3 pessoas, contando você.';
  end if;
  foreach v_nome in array v_nomes loop
    perform musica_conferir_convite(p_formando, v_nome);
  end loop;
  insert into musicas_grupos (criado_por) values (p_formando) returning id into v_grupo;
  begin
    insert into musicas_grupo_membros (grupo, formando, status) values (v_grupo, p_formando, 'aceito');
  exception when unique_violation then
    raise exception 'Você já está num grupo. Saia dele antes de criar outro.';
  end;
  insert into musicas_grupo_membros (grupo, formando) select v_grupo, unnest(v_nomes);
  delete from musicas_sem_grupo where formando = p_formando;
  return v_grupo;
end;
$$;

-- The creator invites one more (3 in all, not counting who refused).
create or replace function public.musica_convidar(p_formando text, p_convidado text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_grupo uuid;
begin
  select id into v_grupo from musicas_grupos where criado_por = p_formando for update;
  if v_grupo is null then
    raise exception 'Só quem criou o grupo pode chamar mais alguém.';
  end if;
  perform musica_conferir_convite(p_formando, p_convidado);
  if (select count(*) from musicas_grupo_membros where grupo = v_grupo and status <> 'recusado' and formando <> p_convidado) >= 3 then
    raise exception 'O grupo pode ter no máximo 3 pessoas, contando você.';
  end if;
  insert into musicas_grupo_membros (grupo, formando) values (v_grupo, p_convidado)
  on conflict (grupo, formando) do update set status = 'convidado', atualizado_em = now()
  where musicas_grupo_membros.status = 'recusado';
end;
$$;

-- An invitee answers. Their other invitations stay as they are.
create or replace function public.musica_responder(p_formando text, p_grupo uuid, p_aceitar boolean)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  perform 1 from musicas_grupos where id = p_grupo for update;
  if not found then
    raise exception 'Esse grupo foi desfeito.';
  end if;
  select status into v_status from musicas_grupo_membros where grupo = p_grupo and formando = p_formando;
  if v_status is distinct from 'convidado' then
    raise exception 'Esse convite não vale mais.';
  end if;
  if not p_aceitar then
    update musicas_grupo_membros set status = 'recusado', atualizado_em = now() where grupo = p_grupo and formando = p_formando;
    return;
  end if;
  begin
    update musicas_grupo_membros set status = 'aceito', atualizado_em = now() where grupo = p_grupo and formando = p_formando;
  exception when unique_violation then
    raise exception 'Você já está em outro grupo. Saia dele antes de aceitar.';
  end;
  delete from musicas_sem_grupo where formando = p_formando;
end;
$$;

-- The creator withdraws an invitation (or clears a refusal).
create or replace function public.musica_desconvidar(p_formando text, p_convidado text)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from musicas_grupo_membros m
  using musicas_grupos g
  where g.id = m.grupo and g.criado_por = p_formando and m.formando = p_convidado and m.status <> 'aceito';
end;
$$;

-- Leaving: the creator undoes the whole group; anyone else just leaves it.
create or replace function public.musica_sair_do_grupo(p_formando text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_grupo uuid;
  v_criador text;
begin
  select g.id, g.criado_por into v_grupo, v_criador
  from musicas_grupo_membros m join musicas_grupos g on g.id = m.grupo
  where m.formando = p_formando and m.status = 'aceito';
  if v_grupo is null then
    return;
  end if;
  if v_criador = p_formando then
    delete from musicas_grupos where id = v_grupo;
  else
    delete from musicas_grupo_membros where grupo = v_grupo and formando = p_formando;
  end if;
end;
$$;

revoke all on function public.musica_conferir_convite(text, text) from public, anon, authenticated;
revoke all on function public.musica_criar_grupo(text, text[]) from public, anon, authenticated;
revoke all on function public.musica_convidar(text, text) from public, anon, authenticated;
revoke all on function public.musica_responder(text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.musica_desconvidar(text, text) from public, anon, authenticated;
revoke all on function public.musica_sair_do_grupo(text) from public, anon, authenticated;
grant execute on function public.musica_conferir_convite(text, text) to service_role;
grant execute on function public.musica_criar_grupo(text, text[]) to service_role;
grant execute on function public.musica_convidar(text, text) to service_role;
grant execute on function public.musica_responder(text, uuid, boolean) to service_role;
grant execute on function public.musica_desconvidar(text, text) to service_role;
grant execute on function public.musica_sair_do_grupo(text) to service_role;

-- YouTube only (Spotify was accepted at first and dropped: its player on the
-- page only played a preview). Safe to run again.
alter table public.musicas_formando drop constraint if exists musicas_formando_plataforma_check;
alter table public.musicas_formando add constraint musicas_formando_plataforma_check check (plataforma = 'youtube');
alter table public.musicas_formando drop constraint if exists musicas_formando_codigo_check;
alter table public.musicas_formando add constraint musicas_formando_codigo_check check (codigo ~ '^[A-Za-z0-9_-]{11}$');
alter table public.musicas_grupos drop constraint if exists musicas_grupos_plataforma_check;
alter table public.musicas_grupos add constraint musicas_grupos_plataforma_check check (plataforma = 'youtube');
alter table public.musicas_grupos drop constraint if exists musicas_grupos_codigo_check;
alter table public.musicas_grupos add constraint musicas_grupos_codigo_check check (codigo ~ '^[A-Za-z0-9_-]{11}$');
