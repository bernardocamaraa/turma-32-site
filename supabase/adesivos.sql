-- Turma 32 site — loja de adesivos
-- Run once in the SQL Editor, after votacao.sql: the formandos enter
-- /adesivos the same way they enter the vote and /musica, with their
-- WhatsApp (convidados_formando.whatsapp and identificar_eleitor, both from
-- there). Running it again is safe.
--
-- Each formando picks how many of each sticker model they want, to be handed
-- out on the night. One order per formando; sending again replaces it. The
-- models and their prices live in the site (src/lib/adesivos.ts) and in the
-- `adesivos` Edge Function — this table only keeps the quantities.
-- The committee sees every order in the "Adesivos" tab, marks who paid and
-- downloads each formando's childhood sticker to print.

create table if not exists public.pedidos_adesivos (
  formando text primary key references public.convidados_formando (formando) on update cascade on delete cascade,
  -- { "<model id>": <quantity> }, only models with a quantity above zero.
  itens jsonb not null default '{}'::jsonb check (jsonb_typeof(itens) = 'object'),
  observacao text check (char_length(observacao) <= 500),
  -- Set by the committee once the payment arrived; the formando can't
  -- change a paid order (they ask the committee).
  pago boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.pedidos_adesivos enable row level security;
-- Deliberately no policies: only the `adesivos` Edge Function reads or
-- writes it, after checking the WhatsApp or the committee code.

-- Lets the committee close the store (e.g. once the order goes to the print
-- shop). Open from the start.
insert into public.configuracoes (chave, valor)
values ('loja_aberta', true)
on conflict (chave) do nothing;
