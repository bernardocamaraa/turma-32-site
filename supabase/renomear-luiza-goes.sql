-- Run once in the SQL Editor: fixes the spelling "Luiza Goes" → "Luíza Góes"
-- in a database that already has the old name. The formando's name is the
-- key everywhere, so the rename has to reach every table that keeps it.

begin;

-- The table map and the vote's participation didn't follow a renamed
-- formando; now they do, like the music tables already did.
alter table public.reservas_mesa
  drop constraint if exists reservas_mesa_formando_fkey,
  add constraint reservas_mesa_formando_fkey
    foreign key (formando) references public.convidados_formando (formando)
    on update cascade on delete cascade;

alter table public.votacao_participacao
  drop constraint if exists votacao_participacao_formando_fkey,
  add constraint votacao_participacao_formando_fkey
    foreign key (formando) references public.convidados_formando (formando)
    on update cascade on delete cascade;

-- The rename itself: cascades to the map, the vote and the music tables.
update public.convidados_formando set formando = 'Luíza Góes' where formando = 'Luiza Goes';

-- Votes already counted for her by name, and options typed with her name.
update public.votacao_contagem set opcao = 'Luíza Góes' where opcao = 'Luiza Goes';
update public.votacao_perguntas
  set opcoes = array_replace(opcoes, 'Luiza Goes', 'Luíza Góes')
  where 'Luiza Goes' = any (opcoes);

commit;
