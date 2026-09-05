// Supabase Edge Function: committee-data
//
// Checks the shared committee access code and, if it matches, returns every
// RSVP and message using the service role key (which bypasses RLS). This is
// the only place that key is ever used — it never reaches the browser.
//
// Deploy with:
//   supabase functions deploy committee-data
// Then set its secrets (NOT the same as the site's VITE_ env vars):
//   supabase secrets set COMMITTEE_CODE=turma32
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { codigo, definirAlbumAberto } = await req.json();
    const expected = Deno.env.get('COMMITTEE_CODE') ?? '';

    if (!expected || typeof codigo !== 'string' || codigo.trim() !== expected) {
      return new Response(JSON.stringify({ error: 'Código incorreto.' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Optional: flip the album open/closed flag before reading everything
    // back. Only reachable after the access-code check above — the anon key
    // alone can read this flag (see schema.sql) but never write it.
    if (typeof definirAlbumAberto === 'boolean') {
      const { error } = await supabase
        .from('configuracoes')
        .update({ valor: definirAlbumAberto })
        .eq('chave', 'album_aberto');
      if (error) throw error;
    }

    const [rsvps, mensagens, configuracoes] = await Promise.all([
      supabase.from('rsvps').select('id, formando, nome, whatsapp, pessoas, acompanhantes, criado_em').order('criado_em', { ascending: false }),
      supabase.from('mensagens').select('id, nome, mensagem, criado_em').order('criado_em', { ascending: false }),
      supabase.from('configuracoes').select('chave, valor').eq('chave', 'album_aberto').maybeSingle(),
    ]);

    if (rsvps.error) throw rsvps.error;
    if (mensagens.error) throw mensagens.error;
    if (configuracoes.error) throw configuracoes.error;

    return new Response(
      JSON.stringify({
        rsvps: rsvps.data,
        mensagens: mensagens.data,
        albumAberto: configuracoes.data?.valor ?? false,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
