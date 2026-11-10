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

-- ---------------------------------------------------------------------------
-- No repeated songs: two formandos (or groups) can't walk down to the same
-- song — the same song by the same artist, whatever the video (the clip, a
-- lyrics or audio upload, a live one…). Each pick keeps the artist and the
-- song's name (`artista`, `musica`): from YouTube's own "Música" section of
-- the video when it has one, else from the title ("Artista - Música"), else
-- the channel as the artist (musica_identificar). The link itself isn't
-- compared. A formando is told someone already has the song, never who;
-- the committee is told whose. Safe to run again.
-- ---------------------------------------------------------------------------

alter table public.musicas_formando add column if not exists artista text check (char_length(artista) <= 200);
alter table public.musicas_formando add column if not exists musica text check (char_length(musica) <= 300);
alter table public.musicas_grupos add column if not exists artista text check (char_length(artista) <= 200);
alter table public.musicas_grupos add column if not exists musica text check (char_length(musica) <= 300);

-- A first version of this rule compared the videos and the words of their
-- titles; these were its functions.
drop function if exists public.musica_salvar(text, uuid, text, text, int, boolean);
drop function if exists public.musicas_iguais();
drop function if exists public.musica_dona(text, text, text, uuid, timestamptz);
drop function if exists public.musicas_tocando();
drop function if exists public.musica_mesma(text, text, text, text);
drop function if exists public.musica_chave(text);

-- A name as it's compared: lowercase, no accents, without what's in brackets
-- ("(Official Video)", "[Lyrics]"), the featured artists ("feat. …"), and
-- words like "oficial", "lyrics", "audio", "ao vivo"; "&" and "and" as "e".
create or replace function public.musica_normal(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    lower(translate(coalesce(p_nome, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[([][^)\]]*[)\]]', ' ', 'g'),
    '(\mfeat\M|\mfeaturing\M|\mft\.|\mpart\.|\mparticipacao especial\M).*$', ''),
    '&|\mand\M', ' e ', 'g'),
    '\m(official|oficial|video|videoclipe|clipe|clip|lyrics?|letra|legendad[oa]|traducao|audio|visualizer|hd|4k|vevo|mv|remaster(ed)?|live|ao vivo|topic)\M', ' ', 'g'),
    '[^a-z0-9]+', ' ', 'g'),
    ' {2,}', ' ', 'g'));
$$;

-- The artist and the song's name of a video. `p_artista`/`p_musica`: what
-- YouTube's "Música" section says, when it has one — used as they are.
-- Else the title split at its first " - " (or "–", "—", "|"): "Coldplay -
-- Viva La Vida (Official Video)" → Coldplay, Viva La Vida. Else the channel
-- (without "VEVO", " - Topic") as the artist and the title as the song.
-- What's in brackets is left out of the names.
create or replace function public.musica_identificar(p_titulo text, p_canal text, p_artista text, p_musica text)
returns table (artista text, musica text)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_titulo text := btrim(regexp_replace(regexp_replace(coalesce(p_titulo, ''), '[([][^)\]]*[)\]]', ' ', 'g'), '\s{2,}', ' ', 'g'));
  v_partes text[];
begin
  if nullif(btrim(p_artista), '') is not null and nullif(btrim(p_musica), '') is not null then
    return query select left(btrim(p_artista), 200), left(btrim(p_musica), 300);
    return;
  end if;
  v_partes := regexp_match(v_titulo, '^(.+?)\s+[-–—|]\s+(.+)$');
  if v_partes is not null then
    return query select left(btrim(v_partes[1]), 200), left(btrim(v_partes[2]), 300);
    return;
  end if;
  return query select
    left(nullif(btrim(regexp_replace(regexp_replace(coalesce(p_canal, ''), '\s*-\s*topic$', '', 'i'), 'vevo$', '', 'i')), ''), 200),
    left(nullif(v_titulo, ''), 300);
end;
$$;

-- Whether one name is inside the other: all its words are in the other's
-- ("lady gaga" in "lady gaga bradley cooper").
create or replace function public.musica_dentro(a text, b text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select string_to_array(a, ' ') <@ string_to_array(b, ' ') or string_to_array(b, ' ') <@ string_to_array(a, ' ');
$$;

-- Whether two picks are the same song: the same name, by an artist that's
-- the same or one named inside the other ("Lady Gaga" and "Lady Gaga,
-- Bradley Cooper"). Also the other way round, for a title written "Música -
-- Artista". A pick without an artist only matches nothing.
create or replace function public.musica_igual(a_artista text, a_musica text, b_artista text, b_musica text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  aa text := musica_normal(a_artista);
  am text := musica_normal(a_musica);
  ba text := musica_normal(b_artista);
  bm text := musica_normal(b_musica);
begin
  if aa = '' or am = '' or ba = '' or bm = '' then
    return false;
  end if;
  return
    -- The same song, by artists where one is named inside the other.
    (am = bm and musica_dentro(aa, ba))
    -- One of them written "Música - Artista": "Viva La Vida - Coldplay"
    -- read as artist "Viva La Vida", song "Coldplay".
    or (am = ba and musica_dentro(aa, bm))
    or (aa = bm and musica_dentro(am, ba));
end;
$$;

-- The songs that will play on the night: each complete group's, and the own
-- song of everyone not in a complete group. `dono`, ready for a sentence:
-- "de Bia", or "do grupo de Duda e Enzo".
create or replace function public.musicas_tocam()
returns table (formando text, grupo uuid, dono text, artista text, musica text, em timestamptz)
language sql
stable
set search_path = public
as $$
  with completos as (
    select g.id from musicas_grupos g
    where (select count(*) from musicas_grupo_membros m where m.grupo = g.id and m.status = 'aceito') >= 2
      and not exists (select 1 from musicas_grupo_membros m where m.grupo = g.id and m.status = 'convidado')
  )
  select f.formando, null::uuid, 'de ' || f.formando, f.artista, f.musica, f.atualizado_em
  from musicas_formando f
  where not exists (
    select 1 from musicas_grupo_membros m join completos c on c.id = m.grupo
    where m.formando = f.formando and m.status = 'aceito'
  )
  union all
  select null, g.id,
    'do grupo de ' || regexp_replace(
      (select string_agg(m.formando, ', ' order by m.formando) from musicas_grupo_membros m where m.grupo = g.id and m.status = 'aceito'),
      ', ([^,]*)$', ' e \1'),
    g.artista, g.musica, g.musica_em
  from musicas_grupos g join completos c on c.id = g.id
  where g.codigo is not null;
$$;

-- Who already walks down to the same song — "de Bia", "do grupo de Duda e
-- Enzo" — or null. Leaves out p_formando's own song and p_grupo's. With
-- p_antes, only songs saved before it: of two equal songs, the one picked
-- later is the repeat.
create or replace function public.musica_ja_tem(p_artista text, p_musica text, p_formando text, p_grupo uuid, p_antes timestamptz default null)
returns text
language sql
stable
set search_path = public
as $$
  select t.dono
  from musicas_tocam() t
  where coalesce(t.formando <> p_formando, true)
    and coalesce(t.grupo <> p_grupo, true)
    and (p_antes is null or t.em < p_antes)
    and musica_igual(p_artista, p_musica, t.artista, t.musica)
  order by t.em
  limit 1;
$$;

-- For a pasted video, before saving: the artist and song the site reads in
-- it, and whether it's still free (nobody else walks down to it). Never who.
create or replace function public.musica_conferir(p_titulo text, p_canal text, p_artista text, p_musica text, p_formando text, p_grupo uuid)
returns table (artista text, musica text, livre boolean)
language sql
stable
set search_path = public
as $$
  select i.artista, i.musica, musica_ja_tem(i.artista, i.musica, p_formando, p_grupo) is null
  from musica_identificar(p_titulo, p_canal, p_artista, p_musica) i;
$$;

-- For the committee's list: every pair of entries (a formando's name, or a
-- group's id) walking down to the same song.
create or replace function public.musicas_repetidas()
returns table (a text, b text)
language sql
stable
set search_path = public
as $$
  with t as (select coalesce(formando, grupo::text) as chave, artista, musica from musicas_tocam())
  select x.chave, y.chave from t x join t y on x.chave <> y.chave and musica_igual(x.artista, x.musica, y.artista, y.musica);
$$;

-- Saves a song — a formando's own (p_grupo null) or a group's — with its
-- artist and name, unless someone else already has it. One save at a time
-- (the lock), so two people picking the same song at the same moment can't
-- both get it.
create or replace function public.musica_gravar(
  p_formando text, p_grupo uuid, p_codigo text, p_titulo text, p_canal text, p_artista text, p_musica text, p_inicio int, p_comissao boolean
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_artista text;
  v_musica text;
  v_dono text;
begin
  perform pg_advisory_xact_lock(hashtext('musicas_escolha'));
  select i.artista, i.musica into v_artista, v_musica from musica_identificar(p_titulo, p_canal, p_artista, p_musica) i;
  v_dono := musica_ja_tem(v_artista, v_musica, p_formando, p_grupo);
  if v_dono is not null then
    if p_comissao then
      raise exception 'Essa música já é %. Tire de lá antes, ou escolha outra.', v_dono;
    end if;
    raise exception 'Alguém já escolheu essa música, e ela não pode se repetir. Escolha outra.';
  end if;
  if p_grupo is not null then
    update musicas_grupos
    set plataforma = 'youtube', codigo = p_codigo, titulo = p_titulo, artista = v_artista, musica = v_musica, inicio = p_inicio, musica_em = now()
    where id = p_grupo;
  else
    begin
      insert into musicas_formando (formando, plataforma, codigo, titulo, artista, musica, inicio, atualizado_em)
      values (p_formando, 'youtube', p_codigo, p_titulo, v_artista, v_musica, p_inicio, now())
      on conflict (formando) do update
      set plataforma = excluded.plataforma, codigo = excluded.codigo, titulo = excluded.titulo, artista = excluded.artista,
          musica = excluded.musica, inicio = excluded.inicio, atualizado_em = excluded.atualizado_em;
    exception when foreign_key_violation then
      raise exception 'Esse nome não está na lista da turma.';
    end;
  end if;
end;
$$;

-- Songs picked before the names were kept: read them from the titles.
update public.musicas_formando f set artista = i.artista, musica = i.musica
from (select formando, (musica_identificar(titulo, null, null, null)).* from public.musicas_formando where musica is null) i
where i.formando = f.formando;
update public.musicas_grupos g set artista = i.artista, musica = i.musica
from (select id, (musica_identificar(titulo, null, null, null)).* from public.musicas_grupos where musica is null and codigo is not null) i
where i.id = g.id;

revoke all on function public.musica_normal(text) from public, anon, authenticated;
revoke all on function public.musica_identificar(text, text, text, text) from public, anon, authenticated;
revoke all on function public.musica_dentro(text, text) from public, anon, authenticated;
revoke all on function public.musica_igual(text, text, text, text) from public, anon, authenticated;
revoke all on function public.musicas_tocam() from public, anon, authenticated;
revoke all on function public.musica_ja_tem(text, text, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.musica_conferir(text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.musicas_repetidas() from public, anon, authenticated;
revoke all on function public.musica_gravar(text, uuid, text, text, text, text, text, int, boolean) from public, anon, authenticated;
grant execute on function public.musica_normal(text) to service_role;
grant execute on function public.musica_identificar(text, text, text, text) to service_role;
grant execute on function public.musica_dentro(text, text) to service_role;
grant execute on function public.musica_igual(text, text, text, text) to service_role;
grant execute on function public.musicas_tocam() to service_role;
grant execute on function public.musica_ja_tem(text, text, text, uuid, timestamptz) to service_role;
grant execute on function public.musica_conferir(text, text, text, text, text, uuid) to service_role;
grant execute on function public.musicas_repetidas() to service_role;
grant execute on function public.musica_gravar(text, uuid, text, text, text, text, text, int, boolean) to service_role;
