// Supabase Edge Function: mesas
//
// Backs the table map (/mesas). Every call carries an access code:
//   - TURMA_CODE (shared with the whole class): read the map and move the
//     seats of the formando the visitor picked, on the non-reserved tables,
//     while the committee keeps the map open.
//   - COMMITTEE_CODE (the same secret committee-data uses): all of the above
//     on any table, even with the map closed, plus setting how many people
//     each formando brings and opening/closing the map.
//
// The anon key can't touch the mesas tables at all (schema.sql), so this is
// the only way in. Capacity and per-formando limits are enforced inside
// Postgres (definir_lugares), atomically, not here.
//
// Deploy with:
//   supabase functions deploy mesas
//   supabase secrets set TURMA_CODE=... COMMITTEE_CODE=...

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
    const { codigo, formando, mesa, lugares, definirConvidados, definirMesasAbertas } = await req.json();
    const codigoTurma = Deno.env.get('TURMA_CODE') ?? '';
    const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
    const digitado = typeof codigo === 'string' ? codigo.trim() : '';

    const comissao = !!codigoComissao && digitado === codigoComissao;
    if (!comissao && !(codigoTurma && digitado === codigoTurma)) {
      return json({ error: 'Código incorreto.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Errors raised on purpose inside the SQL functions (`raise exception`,
    // code P0001) are messages written for the formando — pass them through.
    // Anything else is a real failure and stays generic.
    async function rpc(nome: string, args: Record<string, unknown>) {
      const { error } = await supabase.rpc(nome, args);
      if (!error) return null;
      if (error.code === 'P0001') return json({ error: error.message }, 400);
      throw error;
    }

    if (typeof mesa === 'string' && typeof formando === 'string' && Number.isInteger(lugares)) {
      const falha = await rpc('definir_lugares', {
        p_formando: formando,
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

    if (comissao && typeof definirMesasAbertas === 'boolean') {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({ chave: 'mesas_abertas', valor: definirMesasAbertas });
      if (error) throw error;
    }

    const [mesas, reservas, convidados, configuracao] = await Promise.all([
      supabase.from('mesas').select('id, capacidade, reservada_para'),
      supabase.from('reservas_mesa').select('formando, mesa, lugares'),
      supabase.from('convidados_formando').select('formando, total').order('formando'),
      supabase.from('configuracoes').select('valor').eq('chave', 'mesas_abertas').maybeSingle(),
    ]);
    if (mesas.error) throw mesas.error;
    if (reservas.error) throw reservas.error;
    if (convidados.error) throw convidados.error;
    if (configuracao.error) throw configuracao.error;

    return json({
      comissao,
      abertas: configuracao.data?.valor ?? false,
      mesas: mesas.data,
      reservas: reservas.data,
      convidados: convidados.data,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
