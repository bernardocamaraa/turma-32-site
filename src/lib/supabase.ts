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
};

/**
 * The committee area cannot just SELECT the tables with the public anon key —
 * that key is visible to every visitor's browser, so RLS blocks anon reads
 * entirely (see supabase/schema.sql). Instead the shared access code is
 * checked inside the `committee-data` Edge Function, which holds the service
 * role key server-side and only returns data when the code matches.
 */
export async function buscarDadosComissao(codigo: string): Promise<ComissaoData> {
  const { data, error } = await supabase.functions.invoke<ComissaoData>('committee-data', {
    body: { codigo },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (!context) {
      // No HTTP response at all: the request never reached the function —
      // wrong/missing VITE_SUPABASE_URL, no network, or CORS blocked it.
      // This is NOT the same as a wrong access code, so don't say that.
      throw new Error(
        'Não foi possível falar com o servidor. Confira se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configurados corretamente.',
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
