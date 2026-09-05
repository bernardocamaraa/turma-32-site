import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). RSVP and message submission will fail until they are set — see site/.env.example.',
  );
}

// Fall back to a placeholder so createClient doesn't throw at import time when
// the env vars are unset (e.g. during local dev before .env.local exists) —
// calls will fail with a network error instead of crashing the whole page.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');

export type RsvpRecord = {
  formando: string;
  nome: string;
  whatsapp: string;
  pessoas: number;
  acompanhantes: string[];
};

export type MensagemRecord = {
  nome: string;
  mensagem: string;
};

export async function enviarRsvp(record: RsvpRecord) {
  const { error } = await supabase.from('rsvps').insert(record);
  if (error) throw error;
}

export async function enviarMensagem(record: MensagemRecord) {
  const { error } = await supabase.from('mensagens').insert(record);
  if (error) throw error;
}

export type ComissaoRsvp = {
  id: string;
  formando: string;
  nome: string;
  whatsapp: string;
  pessoas: number;
  acompanhantes: string[] | null;
  criado_em: string;
};

export type ComissaoMensagem = {
  id: string;
  nome: string;
  mensagem: string;
  criado_em: string;
};

export type ComissaoData = {
  rsvps: ComissaoRsvp[];
  mensagens: ComissaoMensagem[];
  albumAberto: boolean;
  fotos: Foto[];
};

/**
 * Whether the party album accepts uploads — flipped by hand from Área da
 * comissão (see buscarDadosComissao below), not guessed from the visitor's
 * own clock. Unlike rsvps/mensagens this is public: everyone visiting the
 * album needs to know its state, and it isn't sensitive, so `configuracoes`
 * has a plain anon SELECT policy (schema.sql) — no Edge Function needed to
 * read it, only to change it.
 */
export async function buscarAlbumAberto(): Promise<boolean> {
  const { data, error } = await supabase.from('configuracoes').select('valor').eq('chave', 'album_aberto').maybeSingle();
  if (error) throw error;
  return data?.valor ?? false;
}

export type Foto = {
  id: string;
  caminho: string;
  legenda: string | null;
  criado_em: string;
};

const FOTOS_BUCKET = 'fotos-album';

/** Public URL for a photo's storage path — the bucket is public, so this is a plain URL, no signing needed. */
export function urlDaFoto(caminho: string): string {
  return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(caminho).data.publicUrl;
}

export async function buscarFotos(): Promise<Foto[]> {
  const { data, error } = await supabase.from('fotos').select('id, caminho, legenda, criado_em').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Uploads straight from the browser to Storage, then records the row. Both
 * steps are only allowed while the committee has the album open — enforced
 * by RLS on both the bucket and the table (schema.sql), not just by hiding
 * the button in the UI, so a guest can't upload by calling the API directly
 * once the album has closed.
 */
export async function enviarFoto(arquivo: File, legenda: string): Promise<void> {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'jpg';
  const caminho = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extensao}`;
  const upload = await supabase.storage.from(FOTOS_BUCKET).upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (upload.error) throw upload.error;
  const { error } = await supabase.from('fotos').insert({ caminho, legenda: legenda.trim() || null });
  if (error) throw error;
}

/**
 * The committee area cannot just SELECT the tables with the public anon key —
 * that key is visible to every visitor's browser, so RLS blocks anon reads
 * entirely (see supabase/schema.sql). Instead the shared access code is
 * checked inside the `committee-data` Edge Function, which holds the service
 * role key server-side and only returns data when the code matches.
 *
 * Pass `definirAlbumAberto` to also flip the album's open/closed flag, or
 * `excluirFotoId` to delete one photo (Storage file + row), as part of the
 * same call — the response always reflects the state after that change.
 */
export async function buscarDadosComissao(
  codigo: string,
  opcoes?: { definirAlbumAberto?: boolean; excluirFotoId?: string },
): Promise<ComissaoData> {
  const { data, error } = await supabase.functions.invoke<ComissaoData>('committee-data', {
    body: { codigo, ...opcoes },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    // Only FunctionsHttpError carries a real Response in `context` — a
    // FunctionsFetchError/FunctionsRelayError (network failure, CORS, wrong
    // URL, function not deployed) carries something else (often an Error),
    // which has no .clone()/.json(). Never assume it's a Response.
    if (!(context instanceof Response)) {
      throw new Error(
        'Não foi possível falar com o servidor. Confira se VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY estão certos e se a função "committee-data" foi publicada no Supabase.',
      );
    }
    if (context.status === 404) {
      throw new Error('A função "committee-data" não foi encontrada no Supabase. Confira se ela foi publicada com esse nome exato.');
    }
    const body = await context.clone().json().catch(() => null);
    if (context.status === 401) {
      throw new Error(body?.error || 'Código incorreto.');
    }
    throw new Error(body?.error || `Erro do servidor (HTTP ${context.status}).`);
  }
  if (!data) throw new Error('Sem resposta do servidor.');
  return data;
}
