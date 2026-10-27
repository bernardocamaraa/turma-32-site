// Supabase Edge Function: votacao
//
// Backs the class vote (/votacao). Same two credentials as the `mesas`
// function:
//   - `link`: a formando's personal link. Sees the questions and votes,
//     once per question, as that formando — never as anyone else. Sees a
//     question's result only once the committee releases it.
//   - `codigo`: COMMITTEE_CODE. Creates and deletes questions, closes them,
//     and shows/hides the results to the class.
//
// The ballot is secret (see votacao.sql): who voted and what was voted are
// stored apart. To keep it that way the committee doesn't see the tally
// while a question is open — only how many voted and who's still missing,
// which together with a live tally would give individual votes away. The
// tally appears once the question is closed, and closing is final (no
// reopening), so it can't be peeked at between two votes either.
//
// Deploy with:
//   supabase functions deploy votacao

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

type Pergunta = {
  id: string;
  pergunta: string;
  tipo: 'formandos' | 'opcoes';
  opcoes: string[];
  aberta: boolean;
  resultado_liberado: boolean;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { codigo, link, acao, id, opcao, texto, tipo, opcoes } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Who is calling: the committee, or the one formando the link belongs to.
    let comissao = false;
    let voce: string | null = null;
    if (typeof link === 'string' && link.trim()) {
      const { data, error } = await supabase
        .from('convidados_formando')
        .select('formando')
        .eq('link', link.trim())
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Esse link não vale mais. Peça o seu para a comissão.' }, 401);
      voce = data.formando;
    } else {
      const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
      if (!codigoComissao || typeof codigo !== 'string' || codigo.trim() !== codigoComissao) {
        return json({ error: 'Código incorreto.' }, 401);
      }
      comissao = true;
    }

    const recusar = (mensagem: string) => json({ error: mensagem }, 400);

    // A formando votes as themselves only: the name comes from the link.
    if (voce && acao === 'votar' && typeof id === 'string' && typeof opcao === 'string') {
      const { error } = await supabase.rpc('votar', { p_formando: voce, p_pergunta: id, p_opcao: opcao });
      if (error) {
        // Messages raised on purpose in votar() are written for the formando.
        if (error.code === 'P0001') return recusar(error.message);
        throw error;
      }
    }

    if (comissao && acao === 'criar') {
      const pergunta = typeof texto === 'string' ? texto.trim() : '';
      if (pergunta.length < 3 || pergunta.length > 200) return recusar('Escreva a pergunta (de 3 a 200 letras).');
      if (tipo !== 'formandos' && tipo !== 'opcoes') return recusar('Escolha o tipo de pergunta.');
      let lista: string[] = [];
      if (tipo === 'opcoes') {
        lista = [...new Set((Array.isArray(opcoes) ? opcoes : []).filter((o): o is string => typeof o === 'string').map((o) => o.trim()).filter(Boolean))];
        if (lista.length < 2 || lista.length > 20) return recusar('Escreva de 2 a 20 opções, uma por linha.');
        if (lista.some((o) => o.length > 80)) return recusar('Cada opção pode ter no máximo 80 letras.');
      }
      const { error } = await supabase.from('votacao_perguntas').insert({ pergunta, tipo, opcoes: lista });
      if (error) throw error;
    }

    if (comissao && typeof id === 'string' && (acao === 'encerrar' || acao === 'liberar' || acao === 'esconder')) {
      // There is no "reopen": see the note at the top of this file.
      const mudanca =
        acao === 'encerrar'
          ? { aberta: false }
          : acao === 'liberar'
            ? { aberta: false, resultado_liberado: true }
            : { resultado_liberado: false };
      const { error } = await supabase.from('votacao_perguntas').update(mudanca).eq('id', id);
      if (error) throw error;
    }

    if (comissao && acao === 'excluir' && typeof id === 'string') {
      const { error } = await supabase.from('votacao_perguntas').delete().eq('id', id);
      if (error) throw error;
    }

    const [perguntas, contagem, participacao, formandos] = await Promise.all([
      supabase.from('votacao_perguntas').select('id, pergunta, tipo, opcoes, aberta, resultado_liberado').order('criado_em'),
      supabase.from('votacao_contagem').select('pergunta_id, opcao, votos'),
      supabase.from('votacao_participacao').select('pergunta_id, formando'),
      supabase.from('convidados_formando').select('formando').order('formando'),
    ]);
    if (perguntas.error) throw perguntas.error;
    if (contagem.error) throw contagem.error;
    if (participacao.error) throw participacao.error;
    if (formandos.error) throw formandos.error;

    const nomes = formandos.data.map((f) => f.formando as string);

    return json({
      comissao,
      voce,
      formandos: nomes,
      perguntas: (perguntas.data as Pergunta[]).map((p) => {
        const votaram = participacao.data.filter((v) => v.pergunta_id === p.id).map((v) => v.formando as string);
        // The tally: for the class once released; for the committee once
        // the question is closed. Options nobody picked still show (as 0)
        // when the committee wrote them; for "formandos" questions only
        // names that got votes are listed.
        const veResultado = p.resultado_liberado || (comissao && !p.aberta);
        const daPergunta = contagem.data.filter((c) => c.pergunta_id === p.id);
        const resultado = veResultado
          ? [
              ...daPergunta.map((c) => ({ opcao: c.opcao as string, votos: c.votos as number })),
              ...(p.tipo === 'opcoes' ? p.opcoes.filter((o) => !daPergunta.some((c) => c.opcao === o)).map((o) => ({ opcao: o, votos: 0 })) : []),
            ].sort((a, b) => b.votos - a.votos || a.opcao.localeCompare(b.opcao, 'pt-BR'))
          : null;
        return {
          id: p.id,
          pergunta: p.pergunta,
          tipo: p.tipo,
          opcoes: p.opcoes,
          aberta: p.aberta,
          resultadoLiberado: p.resultado_liberado,
          jaVotou: voce ? votaram.includes(voce) : false,
          // How many voted is fine to show alongside a result, and always to
          // the committee; who is still missing, only to the committee.
          votaram: comissao || veResultado ? votaram.length : null,
          faltam: comissao ? nomes.filter((n) => !votaram.includes(n)) : null,
          resultado,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
