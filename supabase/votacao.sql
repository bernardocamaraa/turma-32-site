-- Turma 32 site — votação
-- Run once in the SQL Editor, after mesas.sql (it uses convidados_formando,
-- the list of formandos).
--
-- The vote is its own thing, apart from the table map, with a single link
-- for the whole class (/votacao). A formando enters by typing their
-- WhatsApp number, and the number says who they are
-- (convidados_formando.whatsapp): the committee fills the numbers in. A
-- number that isn't on the list picks a name that has no number yet, and
-- gets tied to it (identificar_eleitor below). The number isn't verified
-- (that would take a paid SMS service), so it works like a Google Form
-- without login: it stops double votes and one person voting as two, and
-- with the numbers filled in nobody can vote as a classmate without knowing
-- the classmate's number. The committee sees and edits every number in the
-- vote's committee page. The number also lets the committee message each
-- formando directly from the table map.
--
-- The committee creates questions, open right away or ready to open later
-- (`pronta`). A question's options are either the formandos themselves
-- ("o mais engraçado") or a list written by the committee ("qual música de
-- entrada?"). A formando sends all open
-- questions in one ballot, and can't pick the same option (the same person)
-- in two of them (votar_cedula at the end of this file). Since that's only
-- checkable within one ballot, a question sharing a name with one already
-- voted on doesn't open (abrir_perguntas).
--
-- The ballot is secret by construction, not by policy: who voted on a
-- question (votacao_participacao) and how many votes each option got
-- (votacao_contagem) are stored apart, and no row anywhere links a person to
-- a choice — not even for the committee or whoever opens the database. The
-- flip side: a vote can't be changed once cast, since nothing remembers it.
--
-- Nothing here is readable or writable with the anon key: every read and
-- write goes through the `votacao` Edge Function, like the table map.

-- The formando's WhatsApp number, digits only with the country code
-- (5521999999999). Filled in by the committee, or by the formando the first
-- time they enter the vote. One number per formando. (An earlier version gave each formando a personal voting link
-- in a `link_votacao` column; projects that ran it still have that column,
-- unused — it can be dropped whenever convenient.)
alter table public.convidados_formando add column if not exists whatsapp text unique
  check (whatsapp ~ '^[0-9]{12,13}$');

create table if not exists public.votacao_perguntas (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null check (char_length(btrim(pergunta)) between 3 and 200),
  tipo text not null check (tipo in ('formandos', 'opcoes')),
  opcoes text[] not null default '{}',
  -- Not closed: accepting votes, once opened (`pronta` below). The committee
  -- closes it, or releasing the result does.
  aberta boolean not null default true,
  -- Whether formandos see the tally. Until then only the committee does.
  resultado_liberado boolean not null default false,
  criado_em timestamptz not null default now(),
  check (tipo = 'formandos' or cardinality(opcoes) between 2 and 20)
);

-- Who has already voted on each question — never what they chose.
create table if not exists public.votacao_participacao (
  pergunta_id uuid not null references public.votacao_perguntas (id) on delete cascade,
  formando text not null references public.convidados_formando (formando) on delete cascade,
  primary key (pergunta_id, formando)
);

-- The tally: how many votes each option has. No row says who cast them.
create table if not exists public.votacao_contagem (
  pergunta_id uuid not null references public.votacao_perguntas (id) on delete cascade,
  opcao text not null,
  votos int not null default 0 check (votos >= 0),
  primary key (pergunta_id, opcao)
);

-- How many options a formando picks on the question: just one (the
-- default), or any number from one up to this ("escolha até 3 nomes").
alter table public.votacao_perguntas add column if not exists maximo int not null default 1
  check (maximo between 1 and 20);

-- Written ahead and not opened yet: the class doesn't see it and it takes no
-- votes until the committee opens it. Opening is final, like closing.
-- Questions from before this column were opened when created, hence the
-- default.
alter table public.votacao_perguntas add column if not exists pronta boolean not null default false;

-- What the class sees of a released result, as the committee chooses: only
-- the most voted, revealed on the page; the full count is the committee's
-- alone. `resultado_primeiros`: how many of the most voted show (a tie at
-- the last place brings every tied option in), or null for as many as each
-- formando picks (`maximo`). `resultado_votos`: whether each one's count
-- shows too. `resultado_totais`: whether the valid and blank votes show.
-- The Edge Function sends the class only what shows, so nothing hidden can
-- be read from the page either.
alter table public.votacao_perguntas add column if not exists resultado_primeiros int
  check (resultado_primeiros between 1 and 20);
alter table public.votacao_perguntas add column if not exists resultado_votos boolean not null default false;
alter table public.votacao_perguntas add column if not exists resultado_totais boolean not null default true;

alter table public.votacao_perguntas enable row level security;
alter table public.votacao_participacao enable row level security;
alter table public.votacao_contagem enable row level security;
-- Deliberately no policies on these three: anon can't read or write them.

-- Casts one formando's vote on one question: one option, up to the
-- question's `maximo` different ones, or a blank vote (`p_opcoes` null).
-- Marking them as having voted and adding one to each option happen in the
-- same transaction, so a vote can't be counted without being marked (or the
-- other way round), and the primary key on votacao_participacao is what
-- stops a second vote — even from two tabs at the same moment.
create or replace function public.votar_opcoes(p_formando text, p_pergunta uuid, p_opcoes text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
  v_opcoes text[];
  v_aberta boolean;
  v_pronta boolean;
  v_maximo int;
  v_opcao text;
begin
  -- `for share` makes a committee closing the question at this very moment
  -- wait for this vote to finish (or this vote see it closed).
  select tipo, opcoes, aberta, pronta, maximo into v_tipo, v_opcoes, v_aberta, v_pronta, v_maximo
  from votacao_perguntas where id = p_pergunta for share;
  if not found then
    raise exception 'Essa votação não existe mais.';
  end if;
  if v_pronta then
    raise exception 'Essa votação ainda não foi aberta.';
  end if;
  if not v_aberta then
    raise exception 'Essa votação já foi encerrada.';
  end if;
  if not exists (select 1 from convidados_formando where formando = p_formando) then
    raise exception 'Formando não encontrado.';
  end if;

  if p_opcoes is not null then
    if cardinality(p_opcoes) = 0 then
      raise exception 'Escolha uma opção em cada pergunta.';
    end if;
    if cardinality(p_opcoes) > v_maximo then
      raise exception 'Nessa pergunta dá para escolher no máximo %.', v_maximo;
    end if;
    if array_position(p_opcoes, null) is not null then
      raise exception 'Escolha uma das opções da lista.';
    end if;
    if (select count(distinct o) from unnest(p_opcoes) o) <> cardinality(p_opcoes) then
      raise exception 'Escolha opções diferentes na mesma pergunta.';
    end if;

    foreach v_opcao in array p_opcoes loop
      if v_tipo = 'formandos' then
        if not exists (select 1 from convidados_formando where formando = v_opcao) then
          raise exception 'Escolha um formando da lista.';
        end if;
        if v_opcao = p_formando then
          raise exception 'Não dá para votar em você mesmo.';
        end if;
      elsif not (v_opcao = any (v_opcoes)) then
        raise exception 'Escolha uma das opções da lista.';
      end if;
    end loop;
  end if;

  insert into votacao_participacao (pergunta_id, formando) values (p_pergunta, p_formando)
  on conflict do nothing;
  if not found then
    raise exception 'Você já votou nessa pergunta.';
  end if;

  -- A blank vote is counted under '' — never an option, since options are
  -- trimmed and can't be empty — so the tally can show it apart.
  insert into votacao_contagem (pergunta_id, opcao, votos)
  select p_pergunta, o, 1 from unnest(coalesce(p_opcoes, array[''])) o
  on conflict (pergunta_id, opcao) do update set votos = votacao_contagem.votos + 1;
end;
$$;

-- The single-option form, kept for anything that still calls it.
create or replace function public.votar(p_formando text, p_pergunta uuid, p_opcao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform votar_opcoes(p_formando, p_pergunta, array[p_opcao]);
end;
$$;

-- Only the Edge Function (service role) may call them.
revoke all on function public.votar_opcoes(text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.votar_opcoes(text, uuid, text[]) to service_role;
revoke all on function public.votar(text, uuid, text) from public, anon, authenticated;
grant execute on function public.votar(text, uuid, text) to service_role;

-- For a number that isn't on the list yet: ties `p_whatsapp` to
-- `p_formando`, if that name has no number. (The Edge Function looks the
-- number up first, so a number already on the list never gets here.)
-- Locking the formando's row makes two people claiming the same name at the
-- same moment take turns; the unique constraint stops one number from
-- claiming two names.
create or replace function public.identificar_eleitor(p_formando text, p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual text;
begin
  if p_whatsapp is null or p_whatsapp !~ '^[0-9]{12,13}$' then
    raise exception 'Digite o seu WhatsApp com DDD.';
  end if;
  select whatsapp into v_atual from convidados_formando where formando = p_formando for update;
  if not found then
    raise exception 'Escolha o seu nome na lista.';
  end if;
  if v_atual is null then
    begin
      update convidados_formando set whatsapp = p_whatsapp where formando = p_formando;
    exception when unique_violation then
      raise exception 'Esse número já foi usado com outro nome. Confira o nome que você escolheu.';
    end;
  elsif v_atual <> p_whatsapp then
    raise exception 'Esse nome já entrou com outro número. Se é você, fale com a comissão.';
  end if;
end;
$$;

revoke all on function public.identificar_eleitor(text, text) from public, anon, authenticated;
grant execute on function public.identificar_eleitor(text, text) to service_role;

-- (An earlier version let the committee link questions in a `grupo`
-- column, with the no-repeat rule below only inside a group; projects that
-- ran it still have that column, unused — the rule now covers every
-- question.)

-- A name as the no-repeat rule compares it: accents, capitals and extra
-- spaces aside, so "Laís Boldrim" in one question and "lais  boldrim" in
-- another are the same person. The committee types an "opcoes" question's
-- names by hand, one question at a time, so they may not come out
-- identical. (chaveDoNome in src/lib/votacao.ts does the same on the page.)
create or replace function public.chave_opcao(p_opcao text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(btrim(regexp_replace(regexp_replace(normalize(p_opcao, nfd), '[\u0300-\u036f]', '', 'g'), '\s+', ' ', 'g')));
$$;

revoke all on function public.chave_opcao(text) from public, anon, authenticated;
grant execute on function public.chave_opcao(text) to service_role;

-- Casts a formando's whole ballot at once: `p_votos` is {question id:
-- [options]} (or a single option as a string, or null for a blank vote)
-- with a choice for every open question they haven't voted on yet.
-- All or nothing, in one transaction, so no question can be skipped. It's
-- also the only moment the choices can be compared with each other —
-- nothing stores them afterwards — so the same name twice is refused
-- here. A question opened after someone already sent their ballot couldn't
-- be compared with what they chose then: that's why abrir_perguntas below
-- won't open one that shares a name with a question already voted on.
create or replace function public.votar_cedula(p_formando text, p_votos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_faltam text;
  v_repetida record;
  v_voto record;
begin
  if p_votos is null or jsonb_typeof(p_votos) <> 'object'
     or exists (select 1 from jsonb_each(p_votos) e where jsonb_typeof(e.value) not in ('string', 'array', 'null'))
     or exists (
       select 1 from jsonb_each(p_votos) e,
         jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]' end) x
       where jsonb_typeof(x) <> 'string'
     ) then
    raise exception 'Escolha uma opção em cada pergunta.';
  end if;
  if exists (select 1 from jsonb_object_keys(p_votos) k where not exists (select 1 from votacao_perguntas p where p.id::text = k)) then
    raise exception 'Uma das votações não existe mais. Recarregue a página.';
  end if;

  -- Shared with every other ballot, exclusive with abrir_perguntas: a
  -- question can't open while a ballot is going in and slip out of it —
  -- the ballot either counts before the opening is checked, or waits and
  -- then has to include the new question.
  perform pg_advisory_xact_lock_shared(hashtext('votacao_abrir'));

  select string_agg('"' || p.pergunta || '"', ', ' order by p.criado_em) into v_faltam
  from votacao_perguntas p
  where p.aberta
    and not p.pronta
    and not (p_votos ? p.id::text)
    and not exists (select 1 from votacao_participacao v where v.pergunta_id = p.id and v.formando = p_formando);
  if v_faltam is not null then
    raise exception 'Falta votar em: %.', v_faltam;
  end if;

  with escolhas as (
    select p.id, p.pergunta, p.criado_em, o.opcao
    from jsonb_each(p_votos) e
    join votacao_perguntas p on p.id::text = e.key
    cross join lateral (
      select e.value #>> '{}' as opcao where jsonb_typeof(e.value) = 'string'
      union all
      select x from jsonb_array_elements_text(case when jsonb_typeof(e.value) = 'array' then e.value else '[]' end) x
    ) o
  )
  select a.opcao, a.pergunta as primeira, b.pergunta as segunda into v_repetida
  from escolhas a
  join escolhas b on chave_opcao(a.opcao) = chave_opcao(b.opcao) and (a.criado_em, a.id) < (b.criado_em, b.id)
  order by a.criado_em, b.criado_em
  limit 1;
  if found then
    raise exception 'Você escolheu % em "%" e em "%". O voto não pode se repetir entre as perguntas.',
      v_repetida.opcao, v_repetida.primeira, v_repetida.segunda;
  end if;

  for v_voto in select key, value from jsonb_each(p_votos) loop
    perform votar_opcoes(
      p_formando,
      v_voto.key::uuid,
      case jsonb_typeof(v_voto.value)
        when 'null' then null
        when 'string' then array[v_voto.value #>> '{}']
        else array(select jsonb_array_elements_text(v_voto.value))
      end
    );
  end loop;
end;
$$;

revoke all on function public.votar_cedula(text, jsonb) from public, anon, authenticated;
grant execute on function public.votar_cedula(text, jsonb) to service_role;

-- Opens ready questions: the ones in `p_ids`, or every ready one (null).
-- The no-repeat rule only covers questions in the same ballot, and nothing
-- remembers a ballot once it's in. So a question that shares a name with
-- one the class already voted on (open or closed) is refused: whoever voted
-- there would vote on this one apart, free to pick that name again.
-- Questions with names in common have to open together, before anyone
-- votes. `p_mesmo_assim` opens it anyway, when the committee decides
-- repeating is fine there (say, a separate vote later on).
create or replace function public.abrir_perguntas(p_ids uuid[], p_mesmo_assim boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflito record;
begin
  -- See votar_cedula: ballots going in now finish first (and their votes
  -- count below); the next ones wait for this.
  perform pg_advisory_xact_lock(hashtext('votacao_abrir'));

  if not coalesce(p_mesmo_assim, false) then
    with nomes as (
      select p.id, p.pergunta, p.criado_em, p.pronta, o.nome, chave_opcao(o.nome) as chave
      from votacao_perguntas p
      cross join lateral unnest(
        case when p.tipo = 'formandos' then array(select formando from convidados_formando) else p.opcoes end
      ) as o(nome)
    )
    select a.nome, a.pergunta as abrindo, b.pergunta as votada into v_conflito
    from nomes a
    join nomes b on b.chave = a.chave and b.id <> a.id
    where a.pronta
      and (p_ids is null or a.id = any (p_ids))
      and not b.pronta
      and exists (select 1 from votacao_participacao v where v.pergunta_id = b.id)
    order by a.criado_em, b.criado_em
    limit 1;
    if found then
      raise exception '"%" está em "%" e também em "%", que já recebeu votos. Quem votou lá votaria nessa à parte, e o site não teria como conferir se a pessoa repetiu o nome. Perguntas com nomes em comum precisam abrir juntas, antes de a turma votar.',
        v_conflito.nome, v_conflito.abrindo, v_conflito.votada;
    end if;
  end if;

  update votacao_perguntas set pronta = false
  where pronta and (p_ids is null or id = any (p_ids));
end;
$$;

revoke all on function public.abrir_perguntas(uuid[], boolean) from public, anon, authenticated;
grant execute on function public.abrir_perguntas(uuid[], boolean) to service_role;

-- Notifying the committee: the browser's own notifications (Web Push). A
-- committee phone that turns them on (in /votacao/comissao) gets one the
-- moment every formando has voted on an open question, instead of checking
-- the page.

-- The devices to tell: each row is the push subscription the browser hands
-- over (its endpoint and keys).
create table if not exists public.votacao_avisos (
  endpoint text primary key,
  inscricao jsonb not null,
  criado_em timestamptz not null default now()
);

-- The site's own Web Push key pair (VAPID), made by the Edge Function the
-- first time it's needed. The private half signs every notification.
create table if not exists public.chaves_push (
  id int primary key default 1 check (id = 1),
  chaves jsonb not null
);

-- Whether the committee was already told that everyone voted on this
-- question, so it's told once.
alter table public.votacao_perguntas add column if not exists aviso_completa boolean not null default false;

alter table public.votacao_avisos enable row level security;
alter table public.chaves_push enable row level security;
-- Deliberately no policies on these two: anon can't read or write them.

-- Marks the open questions every formando has now voted on, and returns
-- them, each only once ever: the update claims the row, so two last
-- ballots at the same moment can't both send the notification.
create or replace function public.votacao_completas()
returns setof text
language sql
security definer
set search_path = public
as $$
  update votacao_perguntas p set aviso_completa = true
  where p.aberta
    and not p.pronta
    and not p.aviso_completa
    and (select count(*) from votacao_participacao v where v.pergunta_id = p.id)
      >= (select count(*) from convidados_formando)
  returning p.pergunta;
$$;

revoke all on function public.votacao_completas() from public, anon, authenticated;
grant execute on function public.votacao_completas() to service_role;
