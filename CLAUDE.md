# Instruções para o Claude

## Pull requests

- Sempre que uma mudança estiver pronta (compila com `npm run build` e foi
  conferida), abra o PR para `main` **e junte (merge) sem perguntar**. O dono
  do repositório não quer ter que juntar PR por PR.
- Depois de juntar, deixe a branch de trabalho igual ao `main` atualizado
  (e envie para o GitHub) antes da próxima mudança.
- Se a mudança precisar de algo no Supabase (SQL ou Edge Function), aplique
  lá também, antes de juntar, para o site não ficar quebrado.
