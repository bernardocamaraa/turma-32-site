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
    const { codigo, definirAlbumAberto, excluirFotoId } = await req.json();
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

    // Optional: remove one photo — its Storage file first, then the row.
    // Also only reachable after the access-code check: a guest's anon key
    // has no delete permission on either the table or the bucket (schema.sql),
    // so this is the only path a photo can be removed through.
    if (typeof excluirFotoId === 'string') {
      const { data: foto, error: buscaError } = await supabase
        .from('fotos')
        .select('caminho')
        .eq('id', excluirFotoId)
        .maybeSingle();
      if (buscaError) throw buscaError;
      if (foto) {
        const { error: storageError } = await supabase.storage.from('fotos-album').remove([foto.caminho]);
        if (storageError) throw storageError;
        const { error: deleteError } = await supabase.from('fotos').delete().eq('id', excluirFotoId);
        if (deleteError) throw deleteError;
      }
    }

    const [rsvps, mensagens, configuracoes, fotos] = await Promise.all([
      supabase.from('rsvps').select('id, formando, nome, whatsapp, pessoas, acompanhantes, criado_em').order('criado_em', { ascending: false }),
      supabase.from('mensagens').select('id, nome, mensagem, criado_em').order('criado_em', { ascending: false }),
      supabase.from('configuracoes').select('chave, valor').eq('chave', 'album_aberto').maybeSingle(),
      supabase.from('fotos').select('id, caminho, legenda, criado_em').order('criado_em', { ascending: false }),
    ]);

    if (rsvps.error) throw rsvps.error;
    if (mensagens.error) throw mensagens.error;
    if (configuracoes.error) throw configuracoes.error;
    if (fotos.error) throw fotos.error;

    return new Response(
      JSON.stringify({
        rsvps: rsvps.data,
        mensagens: mensagens.data,
        albumAberto: configuracoes.data?.valor ?? false,
        fotos: fotos.data,
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
