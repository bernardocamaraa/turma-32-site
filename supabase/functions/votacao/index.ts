// Supabase Edge Function: votacao
//
// Backs the class vote (/votacao): one link for the whole class, apart from
// the table map. Three kinds of caller:
//   - nobody yet: gets the list of names and the questions.
//   - `whatsapp`: a formando, recognised by their number — the committee
//     fills the numbers in, so most formandos never pick a name. A number
//     not on the list comes back with `voce: null` and the names that still
//     have no number (`livres`); sent again with one of them as `nome`, the
//     number gets tied to that name (identificar_eleitor in votacao.sql).
//     Votes as that formando, the whole ballot at once (`votarTudo`): for
//     every open question one option, or up to its `maximo`, never the same
//     option in two questions (votar_cedula in votacao.sql). Sees a result
//     once the committee releases it.
//   - `codigo`: COMMITTEE_CODE. Creates, deletes and closes questions,
//     shows/hides the results, and sees and edits each formando's number.
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
  maximo: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { codigo, nome, whatsapp, acao, id, votos, texto, tipo, opcoes, maximo, formando } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const recusar = (mensagem: string) => json({ error: mensagem }, 400);

    // Who is calling: the committee, a formando (by number), or nobody yet.
    let comissao = false;
    let voce: string | null = null;
    if (typeof codigo === 'string') {
      const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
      if (!codigoComissao || codigo.trim() !== codigoComissao) {
        return json({ error: 'Código incorreto.' }, 401);
      }
      comissao = true;
    } else if (typeof whatsapp === 'string') {
      // The number says who it is: filled in by the committee, or tied to
      // the name on an earlier visit.
      const { data: dono, error } = await supabase.from('convidados_formando').select('formando').eq('whatsapp', whatsapp).maybeSingle();
      if (error) throw error;
      if (dono) {
        voce = dono.formando as string;
      } else if (typeof nome === 'string') {
        // A number not on the list: tie it to the name picked, if that name
        // has no number yet.
        const { error } = await supabase.rpc('identificar_eleitor', { p_formando: nome, p_whatsapp: whatsapp });
        if (error) {
          // Messages raised on purpose in identificar_eleitor() are for the formando.
          if (error.code === 'P0001') return json({ error: error.message }, 401);
          throw error;
        }
        voce = nome;
      }
    }

    // One vote per question used to be its own call; a page still open from
    // before would otherwise get an answer that looks fine and count nothing.
    if (acao === 'votar') return recusar('A votação mudou. Recarregue a página para votar.');

    // A vote from a number that's no longer on the list (the committee
    // changed it) must not vanish silently.
    if (!comissao && !voce && acao === 'votarTudo') {
      return json({ error: 'Entre de novo com o seu WhatsApp.' }, 401);
    }

    // A formando votes as themselves only: the name the number belongs to.
    // The whole ballot goes in at once — see votar_cedula in votacao.sql.
    if (voce && acao === 'votarTudo') {
      // { question id: [options] } — or one option as a plain string.
      const valida =
        votos !== null && typeof votos === 'object' && !Array.isArray(votos) &&
        Object.keys(votos).length > 0 &&
        Object.values(votos).every(
          (v) => typeof v === 'string' || (Array.isArray(v) && v.length > 0 && v.every((o) => typeof o === 'string')),
        );
      if (!valida) return recusar('Escolha uma opção em cada pergunta.');
      const { error } = await supabase.rpc('votar_cedula', { p_formando: voce, p_votos: votos });
      if (error) {
        // Messages raised on purpose in votar_cedula()/votar() are written for the formando.
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
      // How many options each formando picks: one, or up to this many.
      const escolhas = maximo === undefined ? 1 : maximo;
      if (!Number.isInteger(escolhas) || escolhas < 1 || escolhas > 10) return recusar('Cada formando pode fazer de 1 a 10 escolhas.');
      if (tipo === 'opcoes' && escolhas >= lista.length) {
        return recusar(`Com ${lista.length} opções, dá para deixar escolher no máximo ${lista.length - 1}.`);
      }
      const { error } = await supabase.from('votacao_perguntas').insert({ pergunta, tipo, opcoes: lista, maximo: escolhas });
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

    // The committee fills in, fixes or clears a formando's number (`whatsapp`
    // here is the new number, or null). Clearing frees the name: the next
    // number not on the list can pick it. Votes already cast stay as they
    // are — nothing records what they were.
    if (comissao && acao === 'definirWhatsapp' && typeof formando === 'string') {
      const numero = whatsapp === null ? null : typeof whatsapp === 'string' && /^[0-9]{12,13}$/.test(whatsapp) ? whatsapp : undefined;
      if (numero === undefined) return recusar('Digite o WhatsApp com DDD.');
      const { error } = await supabase.from('convidados_formando').update({ whatsapp: numero }).eq('formando', formando);
      if (error) {
        if (error.code === '23505') {
          const { data: dono } = await supabase.from('convidados_formando').select('formando').eq('whatsapp', numero).maybeSingle();
          return recusar(dono ? `Esse número já está com ${dono.formando}.` : 'Esse número já está com outro formando.');
        }
        throw error;
      }
    }

    if (comissao && acao === 'excluir' && typeof id === 'string') {
      const { error } = await supabase.from('votacao_perguntas').delete().eq('id', id);
      if (error) throw error;
    }

    const [perguntas, contagem, participacao, formandos] = await Promise.all([
      supabase.from('votacao_perguntas').select('id, pergunta, tipo, opcoes, aberta, resultado_liberado, maximo').order('criado_em'),
      supabase.from('votacao_contagem').select('pergunta_id, opcao, votos'),
      supabase.from('votacao_participacao').select('pergunta_id, formando'),
      // Numbers go only to the committee (see the response below).
      supabase.from('convidados_formando').select('formando, whatsapp').order('formando'),
    ]);
    if (perguntas.error) throw perguntas.error;
    if (contagem.error) throw contagem.error;
    if (participacao.error) throw participacao.error;
    if (formandos.error) throw formandos.error;

    const lista = formandos.data as { formando: string; whatsapp: string | null }[];
    const nomes = lista.map((f) => f.formando);

    return json({
      comissao,
      voce,
      formandos: nomes,
      eleitores: comissao ? lista : null,
      // For a formando whose number isn't on the list: the names they can
      // still pick (the ones with no number yet).
      livres: !comissao && !voce ? lista.filter((f) => !f.whatsapp).map((f) => f.formando) : null,
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
          maximo: p.maximo,
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
