// Supabase Edge Function: mesas
//
// Backs the table map. Every call carries one of two credentials:
//   - `link`: the secret from a formando's personal URL (/mesas/<link>).
//     Reads the map and moves that formando's own seats — never anyone
//     else's, whatever the request body says — on the non-reserved tables,
//     while the committee keeps the map open.
//     With `soNome: true` it only answers whose link it is ({ voce }), for
//     the link preview.
//   - `codigo`: COMMITTEE_CODE (the same secret committee-data uses). Moves
//     anyone's seats on any table, even with the map closed, sets how many
//     people each formando brings, how many chairs each table has
//     (`definirCapacidade`: { mesa, capacidade }), opens/closes the map, and
//     sees (and can replace) every formando's personal link. Also keeps the
//     affinities for the suggested seating (`afinidades`: who sits together
//     or apart) — `salvarAfinidade` ({ tipo, pessoas }) adds a group,
//     `apagarAfinidade` (its id) removes one. Committee only, always: a
//     formando never gets them.
//
// The anon key can't touch the mesas tables at all (mesas.sql), so this is
// the only way in. Capacity and per-formando limits are enforced inside
// Postgres (definir_lugares), atomically, not here.
//
// Deploy with:
//   supabase functions deploy mesas
//   supabase secrets set COMMITTEE_CODE=...

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const {
      codigo, link, formando, mesa, lugares, definirConvidados, definirCapacidade, definirMesasAbertas, novoLink, soNome, salvarAfinidade, apagarAfinidade,
    } = await req.json();

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
      // The link preview (middleware.ts at the site's root) only needs the
      // name, to put it in the card WhatsApp shows — not the whole map.
      if (soNome === true) return json({ voce });
    } else {
      const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
      if (!codigoComissao || typeof codigo !== 'string' || codigo.trim() !== codigoComissao) {
        return json({ error: 'Código incorreto.' }, 401);
      }
      comissao = true;
    }

    // Errors raised on purpose inside the SQL functions (`raise exception`,
    // code P0001) are messages written for the formando — pass them through.
    // Anything else is a real failure and stays generic.
    async function rpc(nome: string, args: Record<string, unknown>) {
      const { error } = await supabase.rpc(nome, args);
      if (!error) return null;
      if (error.code === 'P0001') return json({ error: error.message }, 400);
      throw error;
    }

    // A formando's link only ever moves their own seats; the committee picks
    // whose seats to move.
    const alvo = comissao ? formando : voce;
    if (typeof mesa === 'string' && typeof alvo === 'string' && Number.isInteger(lugares)) {
      const falha = await rpc('definir_lugares', {
        p_formando: alvo,
        p_mesa: mesa,
        p_lugares: lugares,
        p_comissao: comissao,
      });
      if (falha) return falha;
    }

    if (comissao && definirConvidados && typeof definirConvidados.formando === 'string' && Number.isInteger(definirConvidados.total)) {
      const falha = await rpc('definir_convidados', {
        p_formando: definirConvidados.formando,
        p_total: definirConvidados.total,
      });
      if (falha) return falha;
    }

    if (comissao && definirCapacidade && typeof definirCapacidade.mesa === 'string' && Number.isInteger(definirCapacidade.capacidade)) {
      const falha = await rpc('definir_capacidade', {
        p_mesa: definirCapacidade.mesa,
        p_capacidade: definirCapacidade.capacidade,
      });
      if (falha) return falha;
    }

    if (comissao && typeof definirMesasAbertas === 'boolean') {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({ chave: 'mesas_abertas', valor: definirMesasAbertas });
      if (error) throw error;
    }

    // Replacing a leaked link: the old URL stops working at once.
    if (comissao && typeof novoLink === 'string') {
      const { error } = await supabase
        .from('convidados_formando')
        .update({ link: crypto.randomUUID().replaceAll('-', '') })
        .eq('formando', novoLink);
      if (error) throw error;
    }

    if (comissao && salvarAfinidade && typeof salvarAfinidade === 'object') {
      const { tipo, pessoas } = salvarAfinidade as { tipo?: unknown; pessoas?: unknown };
      if (tipo !== 'juntos' && tipo !== 'longe') return json({ error: 'Tipo de grupo inválido.' }, 400);
      const nomes = Array.isArray(pessoas) ? [...new Set(pessoas.filter((p): p is string => typeof p === 'string'))] : [];
      if (nomes.length < 2 || nomes.length > 12) return json({ error: 'Escolha de 2 a 12 formandos.' }, 400);
      const { data: existem, error: erroNomes } = await supabase.from('convidados_formando').select('formando').in('formando', nomes);
      if (erroNomes) throw erroNomes;
      if ((existem ?? []).length !== nomes.length) return json({ error: 'Um dos nomes não está na lista da turma.' }, 400);
      const { error } = await supabase.from('afinidades_mesas').insert({ tipo, pessoas: nomes });
      if (error) throw error;
    }

    if (comissao && typeof apagarAfinidade === 'string' && /^[0-9a-f-]{36}$/i.test(apagarAfinidade)) {
      const { error } = await supabase.from('afinidades_mesas').delete().eq('id', apagarAfinidade);
      if (error) throw error;
    }

    const [mesas, reservas, convidados, configuracao, afinidades] = await Promise.all([
      supabase.from('mesas').select('id, capacidade, reservada_para, ocupantes_fixos'),
      supabase.from('reservas_mesa').select('formando, mesa, lugares'),
      // Links go only to the committee — a formando must never see a
      // classmate's, or the whole point of personal links is gone.
      // The WhatsApp number (filled in on the vote's committee page) also
      // goes only to the committee: the "send" button opens that chat.
      supabase.from('convidados_formando').select(comissao ? 'formando, total, link, whatsapp' : 'formando, total').order('formando'),
      supabase.from('configuracoes').select('valor').eq('chave', 'mesas_abertas').maybeSingle(),
      // Who sits together or apart: the committee's eyes only.
      comissao ? supabase.from('afinidades_mesas').select('id, tipo, pessoas').order('criado_em') : Promise.resolve({ data: null, error: null }),
    ]);
    if (mesas.error) throw mesas.error;
    if (reservas.error) throw reservas.error;
    if (convidados.error) throw convidados.error;
    if (configuracao.error) throw configuracao.error;
    if (afinidades.error) throw afinidades.error;

    return json({
      comissao,
      voce,
      abertas: configuracao.data?.valor ?? false,
      mesas: mesas.data,
      reservas: reservas.data,
      convidados: convidados.data,
      ...(comissao ? { afinidades: afinidades.data ?? [] } : {}),
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
