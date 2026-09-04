# Turma 32 — site da formatura

Convite, agenda, RSVP e álbum da festa da Turma 32. Implementado a partir do
protótipo em `../project/Site Turma 32.dc.html` (ver `../chats/chat1.md` para
o histórico de decisões).

Stack: Vite + React + TypeScript, Supabase (Postgres + Edge Functions) para
guardar as confirmações de presença e mensagens.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com os valores do seu projeto Supabase
npm run dev
```

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode `supabase/schema.sql` — cria as tabelas `rsvps` e
   `mensagens` com RLS habilitado.
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
qualquer pessoa que abrir o site consegue vê-la. Se as tabelas `rsvps` e
`mensagens` permitissem leitura com essa chave, o código de acesso da
comissão seria só decoração: qualquer um poderia ler nome, WhatsApp e
mensagens de todo mundo direto pela API do Supabase, sem nunca digitar o
código.

Por isso o RLS (`supabase/schema.sql`) só libera **INSERT** para a chave
anon — dá pra confirmar presença e mandar mensagem, mas não dá pra listar.
A leitura acontece só dentro da Edge Function `committee-data`
(`supabase/functions/committee-data`), que roda no servidor do Supabase,
guarda a *service role key* (nunca exposta ao navegador) e só devolve os
dados depois de conferir o código digitado.

## O que fica de fora deste protótipo → produção

- **Fotos do álbum**: a página do álbum mostra placeholders, como no
  protótipo original. Enviar fotos de verdade precisa de um bucket no
  Supabase Storage — não implementado aqui porque não fazia parte do que foi
  pedido; o botão "enviar foto" hoje só mostra um aviso.
- **Cota por formando**: todos os 32 formandos têm cota de 4 convidados
  (`src/lib/formandos.ts`) — ajuste ali se algum caso for diferente.
- **Confirmação única por convidado**: como não há login, isso é garantido
  só pelo `localStorage` do navegador de quem preencheu (evita clique duplo
  por engano); não impede alguém de confirmar de novo limpando o navegador
  ou usando outro dispositivo.

## Estrutura

```
src/
  components/   # Badge, Button, Card, Input, Select, NavBar, Dialog, etc.
                 # (porte 1:1 do design system em ../project/_ds)
  pages/        # Home, Baile, Album, Rsvp, Comissao
  lib/          # Supabase client, countdown, formandos, hooks de motion/scroll
supabase/
  schema.sql                        # tabelas + RLS
  functions/committee-data/index.ts # Edge Function da área da comissão
```
