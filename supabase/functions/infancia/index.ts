// Supabase Edge Function: infancia
//
// Backs the childhood photos (/infancia): the committee puts each formando's
// photo there, and whoever makes the video downloads them all. Committee
// only — every call carries COMMITTEE_CODE (the same secret committee-data
// uses).
//   - no `acao`: every formando, with their photos and a signed link to each.
//   - `acao: 'prepararEnvio'` with `formando` and `extensao`: a signed upload
//     URL for one new photo of that formando ({ caminho, token }). The browser
//     sends the file straight to Storage with it, then asks for the list again.
//   - `acao: 'excluir'` with `caminho`: deletes that photo.
//
// The bucket is private with no anon policies (infancia.sql), so this is the
// only way in.
//
// Deploy with:
//   supabase functions deploy infancia

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'fotos-infancia';

// The links are rebuilt on every call, and a new link makes the browser load
// the photo again — so they last a day and the page keeps the first one it got.
const VALIDADE_LINK = 60 * 60 * 24;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Same slug rule as middleware.ts ("João Pedro Jardim" → "joao-pedro-jardim"): the folder of each formando. */
function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { codigo, acao, formando, extensao, caminho } = await req.json();

    const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
    if (!codigoComissao || typeof codigo !== 'string' || codigo.trim() !== codigoComissao) {
      return json({ error: 'Código incorreto.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: lista, error: erroLista } = await supabase.from('convidados_formando').select('formando').order('formando');
    if (erroLista) throw erroLista;
    const formandos = (lista as { formando: string }[]).map((f) => f.formando);

    if (acao === 'prepararEnvio') {
      if (typeof formando !== 'string' || !formandos.includes(formando)) {
        return json({ error: 'Formando não encontrado.' }, 400);
      }
      const ext = typeof extensao === 'string' && /^[a-z0-9]{1,5}$/.test(extensao) ? extensao : 'jpg';
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(`${slug(formando)}/${crypto.randomUUID()}.${ext}`);
      if (error) throw error;
      return json({ caminho: data.path, token: data.token });
    }

    if (acao === 'excluir') {
      if (typeof caminho !== 'string' || !/^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/.test(caminho)) {
        return json({ error: 'Foto não encontrada.' }, 400);
      }
      const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
      if (error) throw error;
    }

    const { data: arquivos, error: erroArquivos } = await supabase.rpc('fotos_infancia_arquivos');
    if (erroArquivos) throw erroArquivos;
    const fotos = arquivos as { caminho: string; tamanho: number | null; criado_em: string }[];

    const links = new Map<string, string>();
    if (fotos.length > 0) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(
        fotos.map((f) => f.caminho),
        VALIDADE_LINK,
      );
      if (error) throw error;
      for (const l of data) if (l.path && l.signedUrl) links.set(l.path, l.signedUrl);
    }

    return json({
      formandos: formandos.map((nome) => {
        const pasta = slug(nome);
        return {
          formando: nome,
          fotos: fotos
            .filter((f) => f.caminho.split('/')[0] === pasta && links.has(f.caminho))
            .map((f) => ({ caminho: f.caminho, url: links.get(f.caminho)!, tamanho: f.tamanho, criadoEm: f.criado_em })),
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
