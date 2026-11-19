-- Turma 32 site — loja de adesivos
-- Run once in the SQL Editor, after votacao.sql: the formandos enter
-- /adesivos the same way they enter the vote and /musica, with their
-- WhatsApp (convidados_formando.whatsapp and identificar_eleitor, both from
-- there). Running it again is safe.
--
-- The committee puts the sticker models on sale (a picture, a name) in the
-- "Adesivos" tab; each formando picks how many of each they
-- want, to be handed out on the night. One order per formando; sending
-- again replaces it. The childhood sticker ("Você criança") is a model like
-- the others, but has no picture of its own: each formando sees theirs,
-- made from their childhood photo (infancia.sql) in the committee's frame.

-- ---------------------------------------------------------------------------
-- The models on sale.
-- ---------------------------------------------------------------------------
create table if not exists public.modelos_adesivos (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  nome text not null check (char_length(nome) between 1 and 80),
  descricao text check (char_length(descricao) <= 300),
  -- Path of the picture in the `adesivos` bucket, or a picture of the site
  -- itself when it starts with "/" (the 32's logo); null for the childhood one.
  imagem text,
  -- The childhood sticker: made from each formando's own photo.
  crianca boolean not null default false,
  -- Hidden models stay in the orders that have them, but can't be ordered.
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- Custom colour: the parts of the picture whose colour the formando picks
-- (the 32's blue shadow, its black fill…), as found by the site when the
-- committee uploads it (src/lib/cores.ts): [{ tipo, nome, cor, h0?, h1? }].
-- Empty: sold as it is. The order keeps each combination apart
-- ("<model id>@#rrggbb+#rrggbb", one colour per part, in pedidos_adesivos.itens).
alter table public.modelos_adesivos add column if not exists camadas jsonb not null default '[]'::jsonb;

insert into public.modelos_adesivos (id, nome, descricao, crianca, ordem)
values ('crianca', 'Você criança', 'O seu adesivo, com a sua foto de criança.', true, 0)
on conflict (id) do nothing;

-- The class's 32, from the site's own logo, with the colour of its shadow and
-- of its black fill for the formando to pick (as the site's colour analysis
-- suggests for this picture — src/lib/cores.ts).
insert into public.modelos_adesivos (id, nome, descricao, imagem, ordem, camadas)
values ('logo-32', 'Logo da Turma 32', 'O 32 da turma. Escolha a cor da sombra e do preenchimento.', '/assets/logo-32.png', 1,
  '[{"tipo":"matiz","nome":"Sombra","cor":"#559ecb","h0":180,"h1":230},{"tipo":"escuro","nome":"Preenchimento","cor":"#050607"}]'::jsonb)
on conflict (id) do nothing;

alter table public.modelos_adesivos enable row level security;
-- No policies: read and written only by the `adesivos` Edge Function.

-- The pictures: public (they're on sale for the class to see), but only
-- the function hands out upload URLs (no storage.objects policies).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adesivos', 'adesivos', true, 10485760, array['image/*'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The orders.
-- ---------------------------------------------------------------------------
create table if not exists public.pedidos_adesivos (
  formando text primary key references public.convidados_formando (formando) on update cascade on delete cascade,
  -- { "<model id>": <quantity> }, only models with a quantity above zero;
  -- for a custom-colour model, one key per combination of colours:
  -- "<model id>@#rrggbb+#rrggbb" (one per part, in the model's order).
  itens jsonb not null default '{}'::jsonb check (jsonb_typeof(itens) = 'object'),
  observacao text check (char_length(observacao) <= 500),
  -- Set by the committee once the payment arrived; the formando can't
  -- change a paid order (they ask the committee).
  pago boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.pedidos_adesivos enable row level security;
-- No policies: only the `adesivos` Edge Function reads or writes it, after
-- checking the WhatsApp or the committee code.

-- How each formando's childhood photo is framed in their sticker: the centre
-- of the crop (0–1 across and down the photo) and the zoom. No row: the
-- site's default crop. The formando sets theirs, the committee anyone's.
create table if not exists public.enquadramentos_infancia (
  formando text primary key references public.convidados_formando (formando) on update cascade on delete cascade,
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),
  zoom real not null check (zoom >= 1 and zoom <= 4),
  atualizado_em timestamptz not null default now()
);
alter table public.enquadramentos_infancia enable row level security;
-- No policies: read and written only by the `adesivos` Edge Function.

-- The price: one for every sticker, set by the committee. Null while it
-- isn't decided — the site then shows no price anywhere. (A project that
-- ran an older version of this file has a per-model `preco` column in
-- modelos_adesivos: it's no longer used.)
create table if not exists public.loja_adesivos (
  id boolean primary key default true check (id),
  preco numeric(8, 2) check (preco >= 0 and preco < 10000)
);
insert into public.loja_adesivos (id) values (true) on conflict (id) do nothing;
alter table public.loja_adesivos enable row level security;
-- No policies: read and written only by the `adesivos` Edge Function.

-- Lets the committee close the store (e.g. once the order goes to the print
-- shop). Open from the start.
insert into public.configuracoes (chave, valor)
values ('loja_aberta', true)
on conflict (chave) do nothing;
