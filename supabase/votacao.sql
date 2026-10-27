-- Turma 32 site — votação
-- Run once in the SQL Editor, after mesas.sql (it uses convidados_formando:
-- formandos vote with the same personal link they use for the table map).
--
-- The committee creates questions. A question's options are either the
-- formandos themselves ("o mais engraçado") or a list written by the
-- committee ("qual música de entrada?").
--
-- The ballot is secret by construction, not by policy: who voted on a
-- question (votacao_participacao) and how many votes each option got
-- (votacao_contagem) are stored apart, and no row anywhere links a person to
-- a choice — not even for the committee or whoever opens the database. The
-- flip side: a vote can't be changed once cast, since nothing remembers it.
--
-- Nothing here is readable or writable with the anon key: every read and
-- write goes through the `votacao` Edge Function, like the table map.

create table if not exists public.votacao_perguntas (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null check (char_length(btrim(pergunta)) between 3 and 200),
  tipo text not null check (tipo in ('formandos', 'opcoes')),
  opcoes text[] not null default '{}',
  -- Accepting votes. The committee closes it, or releasing the result does.
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

alter table public.votacao_perguntas enable row level security;
alter table public.votacao_participacao enable row level security;
alter table public.votacao_contagem enable row level security;
-- Deliberately no policies on these three: anon can't read or write them.

-- Casts one formando's vote on one question. Marking them as having voted
-- and adding one to the option happen in the same transaction, so a vote
-- can't be counted without being marked (or the other way round), and the
-- primary key on votacao_participacao is what stops a second vote — even
-- from two tabs at the same moment.
create or replace function public.votar(p_formando text, p_pergunta uuid, p_opcao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
  v_opcoes text[];
  v_aberta boolean;
begin
  -- `for share` makes a committee closing the question at this very moment
  -- wait for this vote to finish (or this vote see it closed).
  select tipo, opcoes, aberta into v_tipo, v_opcoes, v_aberta from votacao_perguntas where id = p_pergunta for share;
  if not found then
    raise exception 'Essa votação não existe mais.';
  end if;
  if not v_aberta then
    raise exception 'Essa votação já foi encerrada.';
  end if;
  if not exists (select 1 from convidados_formando where formando = p_formando) then
    raise exception 'Formando não encontrado.';
  end if;

  if v_tipo = 'formandos' then
    if not exists (select 1 from convidados_formando where formando = p_opcao) then
      raise exception 'Escolha um formando da lista.';
    end if;
    if p_opcao = p_formando then
      raise exception 'Não dá para votar em você mesmo.';
    end if;
  elsif p_opcao is null or not (p_opcao = any (v_opcoes)) then
    raise exception 'Escolha uma das opções da lista.';
  end if;

  insert into votacao_participacao (pergunta_id, formando) values (p_pergunta, p_formando)
  on conflict do nothing;
  if not found then
    raise exception 'Você já votou nessa pergunta.';
  end if;

  insert into votacao_contagem (pergunta_id, opcao, votos) values (p_pergunta, p_opcao, 1)
  on conflict (pergunta_id, opcao) do update set votos = votacao_contagem.votos + 1;
end;
$$;

-- Only the Edge Function (service role) may call it.
revoke all on function public.votar(text, uuid, text) from public, anon, authenticated;
grant execute on function public.votar(text, uuid, text) to service_role;
