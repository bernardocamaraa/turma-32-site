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

## Área da comissão (`/comissao`)

Tudo o que a comissão administra fica num lugar só, com uma entrada só: o
**código da comissão**, que fica lembrado no aparelho (o botão "Sair da área
da comissão" esquece). O link fica no rodapé do site, e o menu não mostra.
Cada parte é uma aba, com endereço próprio (dá para salvar ou mandar):

| Aba | Endereço | O que tem |
| --- | --- | --- |
| Início | `/comissao` | Um resumo de cada parte: quem falta votar, lugares marcados, fotos de criança, álbum e mensagens. |
| Votação | `/comissao/votacao` | Perguntas, WhatsApp dos formandos, quem falta votar, resultados e o aviso no celular. |
| Mesas | `/comissao/mesas` | Quantas pessoas cada formando leva, os links pessoais e o mapa. |
| Fotos de criança | `/comissao/fotos-de-crianca` | A foto de cada formando, para baixar todas juntas. |
| Álbum e mensagens | `/comissao/album` | Liberar o álbum da festa, moderar as fotos e ler as mensagens. |

As abas ficam presas no topo ao rolar a página. Os endereços antigos
(`/votacao/comissao`, `/mesas` sem link, `/infancia`) levam para a aba certa.
As páginas dos formandos continuam separadas: `/votacao` (entram pelo
WhatsApp) e `/mesas/<link pessoal>`.

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

## Mapa das mesas (`/mesas/<link>` e `/comissao/mesas`)

Cada formando recebe da comissão um **link pessoal** (`/mesas/<link>`) e,
por ele, marca em qual mesa a família dele vai sentar. Cada mesa tem 10 lugares, desenhados como
bolinhas em volta dela, e vai enchendo conforme a turma marca: dourado para
os lugares de quem está vendo e azul para os dos outros. Uma mesa pode ser
dividida entre vários formandos (ex.: 3 + 3 + 4). Um formando também pode
espalhar os lugares dele por mais de uma mesa, se não couber tudo numa só.

- **Quantos convidados cada formando leva** é a comissão que define,
  copiando do portal da casa de festas (que continua sendo a lista de
  convidados). Ela digita só os convidados, sem contar o formando; o site
  soma +1 pelo próprio formando e guarda o total de lugares. O formando só
  distribui esses lugares. Isso fica no painel da aba **Mesas** da área da
  comissão (`/comissao/mesas`).
- **Links pessoais**: no mesmo painel, cada formando tem os botões "Copiar
  link", "Mandar no WhatsApp" e "Novo link". Este último troca o link na
  hora, caso algum vaze, e o antigo para de funcionar.
- **Mesas reservadas**: `P` (professores) e `R1`/`R2` (as retangulares ao
  lado da pista, da comissão). Só o código da comissão marca lugares nelas.
- **Fechar o mapa**: o botão "Fechar mapa" congela as mudanças da turma
  (por exemplo, quando o mapa for mandado para a casa de festas). A comissão
  continua podendo mexer.
- Lotação e limite de cada formando são conferidos dentro do Postgres
  (`definir_lugares` em `mesas.sql`), com trava na linha da mesa. Assim,
  dois formandos marcando o último lugar ao mesmo tempo não estouram a mesa.
- O desenho do mapa (posições das mesas) está em `src/lib/mesas.ts`.

Com o link, o formando só mexe nos lugares dele: quem decide de quem são
os lugares é a Edge Function, a partir do link, e não o que a página manda.
O link de um colega nunca é enviado para o navegador de outro formando.

Para colocar no ar:

1. Rode `supabase/mesas.sql` no **SQL Editor** (uma vez). Num projeto que
   ainda não tem nada, rode `supabase/schema.sql` antes.
2. Publique a função (a comissão entra com o mesmo `COMMITTEE_CODE` da
   área da comissão):
   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy mesas
   ```

## Votação (`/votacao`)

A votação é uma página à parte do mapa das mesas, com **um link só para a
turma toda**: `/votacao`. O formando entra digitando o WhatsApp dele, e o
site reconhece quem ele é pelo número, sem precisar escolher o nome. O número
pode ser digitado de qualquer jeito: com ou sem DDD (sem DDD, vale o 21),
com ou sem +55, e até sem o 9 da frente. O site acerta o formato sozinho
(`normalizarWhatsapp` em `src/lib/votacao.ts`).

- **Números dos formandos:** a comissão cadastra na aba Votação da área da comissão (`/comissao/votacao`),
  com o código dela, na lista "WhatsApp dos formandos" (botões "Adicionar"
  e "Editar"; apagar o número libera o nome). Os números só aparecem para a
  comissão.
- **Número fora da lista:** o formando escolhe o nome dele entre os que
  ainda não têm número, e o número fica preso a esse nome.
- **Limite:** o número não é confirmado por SMS, como num Google Forms sem
  login. Com os números cadastrados, só dá para votar como um colega
  sabendo o WhatsApp dele.
- **Mapa das mesas:** com o número cadastrado, o botão "Mandar no WhatsApp"
  do painel das mesas abre direto a conversa daquele formando.

- **Perguntas:** a comissão cria na aba Votação (`/comissao/votacao`). As opções
  são os próprios formandos ("o mais engraçado"; ninguém vota em si mesmo)
  ou uma lista escrita pela comissão ("qual música de entrada?").
- **Deixar pronta:** ao criar, a comissão escolhe entre "Criar e abrir agora"
  e "Deixar pronta". A pergunta pronta fica guardada na área da comissão: a
  turma não vê nem vota nela (o banco também recusa o voto) até a comissão
  tocar em "Abrir votação". Com duas ou mais prontas, aparece "Abrir as N
  agora", que abre todas juntas. Abrir não tem volta.
- **Editar:** até ser encerrada, a pergunta tem o botão "Editar". Pronta,
  ou aberta sem ninguém ter votado, muda tudo: o texto, os nomes
  (acrescentar ou tirar um candidato), o tipo e quantas escolhas cada um
  faz. Aberta com votos, dá para corrigir o texto e acrescentar opções
  (só quem ainda não votou vê); as que já estavam, o tipo e o número de
  escolhas não mudam mais, porque os votos são contados por eles. Um nome
  acrescentado que está numa pergunta em que alguém já votou sem ter votado
  nesta pede confirmação, porque a pessoa poderia repetir o nome
  (`editar_pergunta` em `votacao.sql`).
- **Como um editor de formulário:** a aba Votação mostra as perguntas na
  ordem da cédula (a mesma que a turma vê), numeradas, e o formulário de
  pergunta nova fica no fim, porque a pergunta nova entra no fim da cédula.
  - **Ordem da cédula:** a lista de todas as perguntas, com setas para subir
    e descer cada uma. Vale na hora, para a turma também. Tocar numa
    pergunta leva até o cartão dela. A ordem fica em
    `votacao_perguntas.ordem` (`ordenar_perguntas` em `votacao.sql`).
  - **Duplicar:** todo cartão tem o botão "Duplicar", que faz uma cópia
    pronta logo abaixo da original, com "(cópia)" no fim do texto para
    editar. Serve para "Orador (2º voto)" ou para um segundo turno.
  - **Pré-visualizar a cédula:** mostra a cédula em tela cheia como o
    formando vai ver, com as prontas já abertas e os resultados liberados.
    Dá para testar as escolhas, o voto em branco e a regra de não repetir o
    nome. "Enviar meus votos" só avisa que estaria tudo certo: nada é
    enviado.
- **Um voto por formando em cada pergunta.** Como o voto é secreto, ele não
  pode ser trocado depois.
- **Vários votos:** ao criar a pergunta, a comissão diz quantos votos cada
  formando tem ("1 voto", "2 votos"… "5 votos"), como no orador, que é uma
  pergunta só de 2 votos. Cada voto vai para um nome diferente. Quem quiser
  votar em menos marca os nomes e toca em "Anular o 2º voto" (ou "Anular os
  outros N votos"): cada voto anulado conta como um voto em branco, e o
  branco inteiro conta tantos brancos quantos votos a pergunta tem. Assim a
  contagem é a mesma de quando eram duas perguntas ("1º voto" e "2º voto").
  Precisa sobrar pelo menos uma opção sem marcar (com 4 opções, no máximo 3
  votos).
- **Tudo de uma vez:** o formando escolhe em todas as perguntas abertas e
  envia tudo junto no fim da página. O botão "Enviar meus votos" só libera
  quando todas têm uma escolha, e o servidor confere de novo
  (`votar_cedula` em `votacao.sql`).
- **A cédula:** as opções de cada pergunta aparecem como uma cédula de
  papel, igual à que cai na urna na animação: um nome por linha, com um
  quadradinho que fica preto com ✓ ao ser marcado. A linha inteira é o
  toque. Um nome já escolhido em outra pergunta ganha um risco vermelho de
  caneta por cima, e o voto em branco desenha um X gigante na cédula
  daquela pergunta.
- **Voto em branco:** toda pergunta tem, na última linha da cédula,
  "Votar em branco", que conta como resposta. No resultado, os brancos
  aparecem à parte ("1 voto em branco"), fora das barras e das
  porcentagens, que são só dos votos dados a uma opção ("votos válidos"). No banco, o branco
  é contado na opção `''` (vazia), que nunca é uma opção de verdade.
- **O voto não se repete:** ninguém pode escolher a mesma opção (a mesma
  pessoa) em duas perguntas, de nenhuma categoria (orador 1º e 2º voto,
  juramento, homenagens…). A página avisa no topo, marca como "já
  escolhido" o que foi usado em outra pergunta, mostra um erro se a escolha
  se repetir e não deixa enviar; o servidor confere de novo. O nome é
  comparado sem acento, maiúscula nem espaço a mais ("Laís Boldrim" e
  "lais boldrim" são a mesma pessoa), porque a comissão digita os nomes de
  cada pergunta à mão (`chave_opcao` em `votacao.sql`).
- **Perguntas com nomes em comum abrem juntas:** como o voto não fica
  guardado, a conferência só vale entre as perguntas enviadas juntas. Por
  isso, deixe todas prontas e abra de uma vez ("Abrir as N agora"), antes de
  a turma começar a votar. Depois que alguém votou numa pergunta, o site não
  abre outra que tenha algum nome dela (`abrir_perguntas` em `votacao.sql`):
  quem já votou ia votar nela à parte e poderia repetir o nome. A comissão vê
  qual nome e qual pergunta, e pode abrir mesmo assim, se quiser (por
  exemplo, uma votação separada mais tarde, onde repetir não tem problema).
  Abrir só uma das prontas que têm nomes em comum também avisa antes.
- **Voto secreto de verdade:** o banco guarda separado quem já votou
  (`votacao_participacao`) e quantos votos cada opção tem
  (`votacao_contagem`). Nenhum registro liga uma pessoa à escolha dela.
- **Enquanto a pergunta está aberta,** a comissão vê só quantos votaram e
  quem falta. A contagem aparece quando ela **encerra** a pergunta.
  Encerrar não tem volta: ver a contagem ao vivo, ou reabrir depois de
  espiar, permitiria descobrir votos comparando quem acabou de votar com
  quem ganhou um voto.
- **Resultado para a turma:** "Mostrar resultado para a turma" libera o
  resultado para todos (e encerra a pergunta, se ainda estiver aberta).
  "Esconder resultado" volta atrás.
- **O que a turma vê:** a contagem completa, com as barras de todas as
  opções, fica só com a comissão. A turma vê só os mais votados, em letras
  grandes e douradas, revelados quando o resultado aparece na tela: um nome
  de cada vez sai de um borrão, um brilho passa por ele, cai um confete
  dourado e os votos válidos e em branco sobem contando (com movimento
  reduzido no aparelho, tudo aparece de uma vez). Em cada pergunta
  encerrada, o quadro "O que a turma vê do resultado" escolhe quantos nomes
  aparecem (no começo, quantos votos a pergunta tinha; empate na última
  vaga traz todos os empatados), se mostra os votos de cada um e se mostra
  os votos válidos e em branco, com uma prévia. "Votos válidos" são os
  votos dados a um nome: numa pergunta de 2 votos, válidos e brancos somam
  2 por formando que votou. O que fica escondido nem é enviado ao
  celular da turma (`resultado_*` em `votacao.sql`).
- **Uma vaga por pessoa:** quando alguém está entre os mais votados de mais
  de uma categoria, fica com a vaga na que teve mais votos, e nas outras a
  vaga passa para quem veio depois (e, se essa pessoa também ganhou em
  outra, para o seguinte). O site faz isso sozinho com as perguntas
  encerradas, indo do maior número de votos para o menor (`eleger` na
  função `votacao`). A turma vê os vencedores já assim, com uma nota ("Laís
  Boldrim ficou com a vaga em "Orador", onde teve mais votos…"); a comissão
  continua vendo a contagem completa, com a lista de quem saiu de cada
  categoria. Se a mesma pessoa tiver o mesmo número de votos em duas
  categorias, a comissão vê um aviso de empate para decidir.
- **Primeiro a cédula, depois os resultados:** enquanto o formando ainda
  tem pergunta aberta para votar, a página dele é só a cédula, com as
  perguntas que faltam, sem resultados anteriores (a função nem os envia).
  Depois que ele envia os votos, aparecem as outras perguntas e os
  resultados liberados, revelados quando a urna sai da tela. A prévia da
  cédula da comissão mostra o mesmo: só as abertas e as prontas.
- **Som da urna:** quando a cédula cai na urna, toca o som de confirmação
  da urna eletrônica (`public/assets/confirma-urna.mp3`). O navegador só
  deixa tocar som que começa num toque, então ele é ligado no toque em
  "Enviar meus votos". No iPhone, não toca com o celular no silencioso.

- **Aviso no celular:** na aba Votação (`/comissao/votacao`), o botão "Me avisar quando
  todos votarem" liga a notificação do próprio navegador (Web Push) naquele
  aparelho, e já manda uma de teste. Quando o último formando vota numa
  pergunta, todo aparelho que ligou o aviso recebe "Todo mundo votou", uma
  vez só por pergunta (`votacao_completas` em `votacao.sql`). No Android e
  no computador funciona direto no Chrome. No iPhone (iOS 16.4 ou mais novo),
  só com o site adicionado à Tela de Início e aberto pelo ícone: a página
  explica o passo a passo. As chaves do Web Push são criadas pela própria
  função na primeira vez e ficam na tabela `chaves_push`. O service worker
  (`public/sw.js`) só mostra essas notificações e só é instalado em quem liga
  o aviso.

Para colocar no ar: rode `supabase/votacao.sql` no SQL Editor (depois do
`mesas.sql`) e publique a função com `supabase functions deploy votacao`.
Rodar o arquivo de novo é seguro (ele só acrescenta o que falta), então,
quando a votação ganhar algo novo no banco (como as perguntas prontas), rode
o `votacao.sql` inteiro de novo **antes** de publicar a função.

## Fotos de criança (`/comissao/fotos-de-crianca`)

Um "drive" só da comissão para juntar a foto de criança de cada formando.
Os formandos mandam a foto para a comissão no WhatsApp, e a comissão coloca
cada uma no nome certo, na aba **Fotos de criança** da área da comissão.

- **Cada formando tem um cartão** com o botão "Adicionar foto". Dá para
  mandar mais de uma foto por formando, e várias de uma vez. Cada foto tem
  os botões de baixar e de excluir.
- **Sem salvar a foto antes:** dá para arrastar a foto direto para o cartão
  (do computador ou do WhatsApp instalado). Do WhatsApp Web o navegador não
  deixa a foto sair arrastando: aí é clicar com o botão direito na foto,
  "Copiar imagem", e tocar em "Colar" no cartão (ou clicar no cartão e
  apertar Ctrl+V). O botão "Colar" também funciona no celular, com a foto
  copiada.
- **Quem falta:** o topo mostra quantos já têm foto, e o filtro "Faltam"
  deixa só os que ainda não têm.
- **Baixar tudo:** "Baixar todas (.zip)" junta todas as fotos num arquivo
  só, cada uma com o nome do formando (`Bernardo Câmara.jpg`; com mais de
  uma, `Bernardo Câmara 1.jpg`, `Bernardo Câmara 2.jpg`). O .zip é montado
  no próprio navegador.
- **Fotos privadas:** são fotos da turma criança, então o bucket
  `fotos-infancia` é privado e a chave anon não lê nem envia nada nele. A
  função `infancia` confere o código e só então entrega links assinados
  (valem um dia) e links de envio. O arquivo vai do navegador direto para o
  Storage, sem passar pela função. Até 25MB por foto, só imagens (inclusive
  o `.heic` do iPhone).
- Não há tabela: os próprios arquivos são o registro, em
  `<slug do formando>/<id>.<extensão>`.

Para colocar no ar: rode `supabase/infancia.sql` no SQL Editor (depois do
`mesas.sql`) e publique a função com `supabase functions deploy infancia`.

## Prévia dos links (WhatsApp, iMessage, Telegram…)

O cartão que aparece quando alguém cola um link do site vem das tags
`og:*` do bloco `<!-- previa -->` em `index.html`: título, descrição e a
imagem `public/previas/turma-32.jpg`.

O link pessoal de cada formando (`/mesas/<link>`) mostra o nome e a imagem
dele. Como os apps montam a prévia sem rodar o JavaScript do site, quem
faz isso é o `middleware.ts`, na raiz do projeto, que roda na Vercel:

- **Robôs de prévia:** o middleware pergunta à função `mesas` de quem é o
  link e troca o bloco pela versão com o nome e com
  `public/previas/mesas/<slug>.jpg`.
- **Pessoas abrindo o link:** passam direto, sem consulta nenhuma.
- **Qualquer erro:** o link continua funcionando, com a prévia geral.

As imagens são geradas por `scripts/gerar-previas.mjs`, a partir de
`src/lib/formandos.ts`. Se a lista de formandos mudar, rode de novo:

```bash
node scripts/gerar-previas.mjs   # precisa do Playwright instalado
```

O WhatsApp guarda a prévia de cada endereço por um tempo. Para conferir uma
mudança, use um link que ainda não foi enviado, ou acrescente `?1` no fim.

## Conteúdo que a comissão edita no código

- **Perguntas frequentes**: a lista `DUVIDAS` no topo de `src/pages/Baile.tsx`.
  Só entram ali respostas já fechadas com a casa de festas — estacionamento,
  horário de encerramento e cardápio ficaram de fora justamente porque ainda
  não estão definidos.
- **Traje e dicas**: a mesma página, seção `#traje`.
- **Formandos**: `src/lib/formandos.ts`. Se a lista mudar, atualize também o `insert into public.convidados_formando` em `supabase/mesas.sql` (os nomes precisam ser idênticos) e gere de novo as imagens de prévia (`node scripts/gerar-previas.mjs`).
- **Data e hora do countdown**: `src/lib/countdown.ts`.

## Estrutura

```
src/
  components/   # Badge, Button, Card, Input, Select, NavBar, Dialog, etc.
                 # (porte 1:1 do design system em ../project/_ds)
  pages/        # Home, Baile, Turma, Album, Mesas, Votacao (formandos) e
                 # Comissao (a área da comissão, com as abas: Votacao,
                 # Mesas, Infancia e o álbum e mensagens)
  lib/          # Supabase client, countdown, formandos, hooks de motion/scroll
supabase/
  schema.sql                        # tabelas + RLS
  mesas.sql                         # mapa das mesas (rodar depois do schema.sql)
  functions/committee-data/index.ts # Edge Function da área da comissão
  functions/mesas/index.ts          # Edge Function do mapa das mesas
  votacao.sql                       # votação (rodar depois do mesas.sql)
  functions/votacao/index.ts        # Edge Function da votação
  infancia.sql                      # fotos de criança (rodar depois do mesas.sql)
  functions/infancia/index.ts       # Edge Function das fotos de criança
```

> A Edge Function é publicada à parte (`supabase functions deploy
> committee-data`): um `git push` atualiza o site, mas não ela.
