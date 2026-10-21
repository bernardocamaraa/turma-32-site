# Turma 32 — site da formatura

Site **informativo** da formatura da Turma 32: data, local, traje, perguntas
frequentes, a lista dos formandos e o álbum de fotos da noite. Implementado a
partir do protótipo em `../project/Site Turma 32.dc.html` (ver
`../chats/chat1.md` para o histórico de decisões).

Stack: Vite + React + TypeScript, Supabase (Postgres + Edge Functions) para
guardar as mensagens para a comissão e as fotos do álbum.

## O site não coleta confirmação de presença

A lista de convidados é feita no portal da casa de festas, onde cada formando
tem login e cadastra os convidados dele. Ter um RSVP aqui também criaria duas
listas diferentes da mesma festa — a do site e a da casa de festas — e a
divergência entre elas apareceria na portaria, no dia. Por isso o site só
explica, em `src/components/AvisoConfirmacao.tsx`, que para confirmar presença
o convidado deve falar com o formando que o convidou.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com os valores do seu projeto Supabase
npm run dev
```

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode `supabase/schema.sql` — cria as tabelas
   `mensagens`, `configuracoes` e `fotos` (com RLS habilitado) e o bucket de
   Storage `fotos-album` para o álbum. Se o projeto já rodou uma versão antiga
   do arquivo, ele também traz, comentada, a linha para apagar a tabela
   `rsvps`, que não é mais usada.
3. Em **Project Settings → API**, copie a `Project URL` e a `anon public key`
   para `.env.local` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
4. Publique a Edge Function que alimenta a área da comissão:
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy committee-data
   supabase secrets set COMMITTEE_CODE=turma32
   ```
   Troque `turma32` pelo código real combinado com a turma.

### Por que uma Edge Function para a área da comissão?

O app fala com o Supabase usando a chave `anon`, que fica no bundle do site —
qualquer pessoa que abrir o site consegue vê-la. Se a tabela `mensagens`
permitisse leitura com essa chave, o código de acesso da comissão seria só
decoração: qualquer um poderia ler as mensagens de todo mundo direto pela API
do Supabase, sem nunca digitar o código.

Por isso o RLS (`supabase/schema.sql`) só libera **INSERT** para a chave
anon — dá pra mandar mensagem, mas não dá pra listar.
A leitura acontece só dentro da Edge Function `committee-data`
(`supabase/functions/committee-data`), que roda no servidor do Supabase,
guarda a *service role key* (nunca exposta ao navegador) e só devolve os
dados depois de conferir o código digitado.

## Álbum da festa

O álbum liga em três peças do Supabase, todas em `schema.sql`:

- Tabela `configuracoes` (`album_aberto`): a comissão liga/desliga o álbum
  manualmente (botão "Liberar álbum" / "Fechar álbum") em vez do site tentar
  adivinhar pela data — evita depender do relógio de quem visita ou de o
  evento atrasar. Leitura pública, escrita só pela Edge Function.
- Tabela `fotos` (caminho, legenda, criado_em) + bucket público
  `fotos-album` no Storage: convidados enviam com legenda opcional
  enquanto `album_aberto=true` (checado via RLS, não só na interface).
  A comissão apaga qualquer foto pela Edge Function.

## Mapa das mesas (`/mesas`)

Cada formando entra com o **nome** e o **código da turma** e marca em qual
mesa a família dele vai sentar. Cada mesa tem 10 lugares, desenhados como
bolinhas em volta dela, e vai enchendo conforme a turma marca: dourado para
os lugares de quem está vendo e azul para os dos outros. Uma mesa pode ser
dividida entre vários formandos (ex.: 3 + 3 + 4). Um formando também pode
espalhar os lugares dele por mais de uma mesa, se não couber tudo numa só.

- **Quantas pessoas cada formando leva** é a comissão que define, copiando
  do portal da casa de festas (que continua sendo a lista de convidados).
  O formando só distribui esses lugares. Isso fica no painel que aparece
  quando se entra em `/mesas` com o **código da comissão**.
- **Mesas reservadas**: `P` (professores) e `R1`/`R2` (as retangulares ao
  lado da pista, da comissão). Só o código da comissão marca lugares nelas.
- **Fechar o mapa**: o botão "Fechar mapa" congela as mudanças da turma
  (por exemplo, quando o mapa for mandado para a casa de festas). A comissão
  continua podendo mexer.
- Lotação e limite de cada formando são conferidos dentro do Postgres
  (`definir_lugares` em `schema.sql`), com trava na linha da mesa. Assim,
  dois formandos marcando o último lugar ao mesmo tempo não estouram a mesa.
- O desenho do mapa (posições das mesas) está em `src/lib/mesas.ts`.

Como o código da turma é um só, qualquer formando consegue mexer nos
lugares de outro. Isso foi uma escolha consciente pela simplicidade. A
comissão vê tudo no painel e pode corrigir.

Para colocar no ar, num projeto Supabase novo (o antigo está pausado):

1. Rode `supabase/schema.sql` inteiro no **SQL Editor**. Se for o projeto
   antigo, que já tem o resto, rode só a parte a partir de "Mapa de mesas".
2. Troque `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` no `.env.local` e
   na Vercel pelos do projeto novo.
3. Publique a função e defina os códigos:
   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy mesas
   supabase functions deploy committee-data
   supabase secrets set TURMA_CODE=codigo-da-turma COMMITTEE_CODE=codigo-da-comissao
   ```

## Conteúdo que a comissão edita no código

- **Perguntas frequentes**: a lista `DUVIDAS` no topo de `src/pages/Baile.tsx`.
  Só entram ali respostas já fechadas com a casa de festas — estacionamento,
  horário de encerramento e cardápio ficaram de fora justamente porque ainda
  não estão definidos.
- **Traje e dicas**: a mesma página, seção `#traje`.
- **Formandos**: `src/lib/formandos.ts`. Se a lista mudar, atualize também o `insert into public.convidados_formando` em `supabase/schema.sql` (os nomes precisam ser idênticos).
- **Data e hora do countdown**: `src/lib/countdown.ts`.

## Estrutura

```
src/
  components/   # Badge, Button, Card, Input, Select, NavBar, Dialog, etc.
                 # (porte 1:1 do design system em ../project/_ds)
  pages/        # Home, Baile, Turma, Album, Comissao, Mesas
  lib/          # Supabase client, countdown, formandos, hooks de motion/scroll
supabase/
  schema.sql                        # tabelas + RLS
  functions/committee-data/index.ts # Edge Function da área da comissão
  functions/mesas/index.ts          # Edge Function do mapa das mesas
```

> A Edge Function é publicada à parte (`supabase functions deploy
> committee-data`): um `git push` atualiza o site, mas não ela.
