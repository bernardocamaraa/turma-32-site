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
//     every open question one option, up to its `maximo`, or a blank vote
//     (null), never the same option in two questions (votar_cedula in
//     votacao.sql). Sees a result once the committee releases it.
//   - `codigo`: COMMITTEE_CODE. Creates, deletes and closes questions,
//     shows/hides the results, and sees and edits each formando's number.
//     Can also turn on the notification for a phone (`avisar`, with the
//     browser's push subscription): when the last formando votes on a
//     question, every phone that turned it on is told (Web Push).
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

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

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

// Who the push services (Apple, Google, Mozilla) can contact about these
// notifications. Required by Web Push; nothing is ever sent to it.
const CONTATO_PUSH = 'https://turma-32-site.vercel.app';

/**
 * The site's Web Push key pair, made the first time and kept in chaves_push
 * (votacao.sql). Two first calls at once: the second insert fails on the
 * primary key and both read back the pair that won.
 */
async function chavesPush(supabase: SupabaseClient): Promise<CryptoKeyPair> {
  const { data, error } = await supabase.from('chaves_push').select('chaves').maybeSingle();
  if (error) throw error;
  if (data) return await webpush.importVapidKeys(data.chaves as webpush.ExportedVapidKeys);
  const novas = await webpush.exportVapidKeys(await webpush.generateVapidKeys({ extractable: true }));
  const { error: erroNovas } = await supabase.from('chaves_push').insert({ id: 1, chaves: novas });
  if (erroNovas && erroNovas.code !== '23505') throw erroNovas;
  return await chavesPush(supabase);
}

/** The public half, for a phone to subscribe with — or null if the keys can't be had, so the vote itself never breaks over it. */
async function chavePublicaPush(supabase: SupabaseClient): Promise<string | null> {
  try {
    return await webpush.exportApplicationServerKey(await chavesPush(supabase));
  } catch (e) {
    console.error(e);
    return null;
  }
}

type Aviso = { titulo: string; texto: string; url: string };

/**
 * Sends a notification to every phone that turned them on — or only to
 * `endpoint`. A phone the push service no longer knows (notifications
 * turned off, browser reset) is forgotten. Returns how many got it.
 */
async function avisar(supabase: SupabaseClient, aviso: Aviso, endpoint?: string): Promise<number> {
  let consulta = supabase.from('votacao_avisos').select('endpoint, inscricao');
  if (endpoint) consulta = consulta.eq('endpoint', endpoint);
  const { data, error } = await consulta;
  if (error) throw error;
  if (data.length === 0) return 0;
  const servidor = await webpush.ApplicationServer.new({ contactInformation: CONTATO_PUSH, vapidKeys: await chavesPush(supabase) });
  const entregues = await Promise.all(
    data.map(async (a) => {
      try {
        await servidor.subscribe(a.inscricao as webpush.PushSubscription).pushTextMessage(JSON.stringify(aviso), { urgency: webpush.Urgency.High });
        return true;
      } catch (e) {
        if (e instanceof webpush.PushMessageError && (e.response.status === 404 || e.response.status === 410)) {
          await supabase.from('votacao_avisos').delete().eq('endpoint', a.endpoint);
        } else {
          console.error(String(e), e instanceof webpush.PushMessageError ? await e.response.text().catch(() => '') : '');
        }
        return false;
      }
    }),
  );
  return entregues.filter(Boolean).length;
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
    const { codigo, nome, whatsapp, acao, id, votos, texto, tipo, opcoes, maximo, formando, inscricao, endpoint } = await req.json();

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
      // { question id: [options] } — or one option as a plain string, or
      // null for a blank vote.
      const valida =
        votos !== null && typeof votos === 'object' && !Array.isArray(votos) &&
        Object.keys(votos).length > 0 &&
        Object.values(votos).every(
          (v) => v === null || typeof v === 'string' || (Array.isArray(v) && v.length > 0 && v.every((o) => typeof o === 'string')),
        );
      if (!valida) return recusar('Escolha uma opção em cada pergunta.');
      const { error } = await supabase.rpc('votar_cedula', { p_formando: voce, p_votos: votos });
      if (error) {
        // Messages raised on purpose in votar_cedula()/votar() are written for the formando.
        if (error.code === 'P0001') return recusar(error.message);
        throw error;
      }

      // The ballot that completes a question tells the committee. Only once
      // someone turned the notification on: otherwise the question would be
      // marked as told with nobody to tell. The vote is already in, so
      // nothing here may fail it.
      try {
        const { count } = await supabase.from('votacao_avisos').select('endpoint', { count: 'exact', head: true });
        if (count) {
          const { data: completas, error: erroCompletas } = await supabase.rpc('votacao_completas');
          if (erroCompletas) throw erroCompletas;
          const perguntas = completas as string[];
          if (perguntas.length > 0) {
            await avisar(supabase, {
              titulo: 'Todo mundo votou',
              texto:
                perguntas.length === 1
                  ? `A turma toda já votou em "${perguntas[0]}". Já dá para encerrar e ver o resultado.`
                  : `A turma toda já votou em ${perguntas.length} perguntas. Já dá para encerrar e ver o resultado.`,
              url: '/votacao/comissao',
            });
          }
        }
      } catch (e) {
        console.error(e);
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

    // The committee's phones: turn the notification on (and send one right
    // away, so it's clear it works), off, or test it again.
    if (comissao && acao === 'avisar') {
      const valida =
        inscricao !== null && typeof inscricao === 'object' &&
        typeof inscricao.endpoint === 'string' && inscricao.endpoint.startsWith('https://') &&
        typeof inscricao.keys?.p256dh === 'string' && typeof inscricao.keys?.auth === 'string';
      if (!valida) return recusar('Este aparelho não mandou os dados do aviso. Tente de novo.');
      const { error } = await supabase.from('votacao_avisos').upsert({
        endpoint: inscricao.endpoint,
        inscricao: { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.keys.p256dh, auth: inscricao.keys.auth } },
      });
      if (error) throw error;
      const entregues = await avisar(
        supabase,
        { titulo: 'Aviso ligado', texto: 'Este aparelho vai receber uma notificação quando todo mundo votar.', url: '/votacao/comissao' },
        inscricao.endpoint,
      );
      if (entregues === 0) {
        await supabase.from('votacao_avisos').delete().eq('endpoint', inscricao.endpoint);
        return recusar('Não deu para mandar a notificação para este aparelho. Tente de novo.');
      }
    }

    if (comissao && acao === 'naoAvisar' && typeof endpoint === 'string') {
      const { error } = await supabase.from('votacao_avisos').delete().eq('endpoint', endpoint);
      if (error) throw error;
    }

    if (comissao && acao === 'testarAviso' && typeof endpoint === 'string') {
      const entregues = await avisar(
        supabase,
        { titulo: 'Teste', texto: 'O aviso da votação está funcionando neste aparelho.', url: '/votacao/comissao' },
        endpoint,
      );
      if (entregues === 0) return recusar('A notificação não chegou a este aparelho. Desligue e ligue o aviso de novo.');
    }

    if (comissao && acao === 'excluir' && typeof id === 'string') {
      const { error } = await supabase.from('votacao_perguntas').delete().eq('id', id);
      if (error) throw error;
    }

    const [perguntas, contagem, participacao, formandos, avisos] = await Promise.all([
      supabase.from('votacao_perguntas').select('id, pergunta, tipo, opcoes, aberta, resultado_liberado, maximo').order('criado_em'),
      supabase.from('votacao_contagem').select('pergunta_id, opcao, votos'),
      supabase.from('votacao_participacao').select('pergunta_id, formando'),
      // Numbers go only to the committee (see the response below).
      supabase.from('convidados_formando').select('formando, whatsapp').order('formando'),
      supabase.from('votacao_avisos').select('endpoint', { count: 'exact', head: true }),
    ]);
    if (perguntas.error) throw perguntas.error;
    if (contagem.error) throw contagem.error;
    if (participacao.error) throw participacao.error;
    if (formandos.error) throw formandos.error;
    if (avisos.error) throw avisos.error;

    const lista = formandos.data as { formando: string; whatsapp: string | null }[];
    const nomes = lista.map((f) => f.formando);

    return json({
      comissao,
      voce,
      formandos: nomes,
      eleitores: comissao ? lista : null,
      // For the committee's phones to turn the notification on: the public
      // half of the site's key, and how many phones already have it on.
      chavePush: comissao ? await chavePublicaPush(supabase) : null,
      aparelhosAvisados: comissao ? (avisos.count ?? 0) : null,
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
        const contados = contagem.data.filter((c) => c.pergunta_id === p.id);
        // Blank votes are counted under '' (votar_opcoes): shown apart, not as an option.
        const brancos = (contados.find((c) => c.opcao === '')?.votos as number | undefined) ?? 0;
        const daPergunta = contados.filter((c) => c.opcao !== '');
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
          brancos: veResultado ? brancos : null,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
