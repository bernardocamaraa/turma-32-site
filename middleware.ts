/**
 * Vercel Routing Middleware: link previews for personal table links.
 *
 * When someone pastes a /mesas/<link> URL into WhatsApp (or iMessage,
 * Telegram…), the app fetches the page and reads its <meta> tags to build
 * the preview card — without running the site's JavaScript. So for those
 * preview bots, this looks up whose link it is and serves index.html with
 * that formando's name and their image (public/previas/mesas/<slug>.jpg,
 * made by scripts/gerar-previas.mjs).
 *
 * People opening the link get the normal page untouched — no extra lookup,
 * no delay. Anything that goes wrong (unknown link, Supabase slow or down)
 * also falls through to the normal page, with the site's generic preview.
 */

export const config = { matcher: '/mesas/:link' };

// Vercel provides the project's environment variables here at runtime; the
// project has no @types/node, so declare just what this file reads.
declare const process: { env: Record<string, string | undefined> };

// The apps that fetch a page to build a link preview. iMessage identifies
// itself as facebookexternalhit/Twitterbot, so it's covered too.
const ROBOS_DE_PREVIA =
  /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|discordbot|slackbot|linkedinbot|skypeuripreview|pinterest|redditbot|embedly|vkshare|snapchat/i;

// Both are public: the anon key ships in the browser bundle already (see
// .env.example). Read from the project's env first, so rotating them in
// Vercel is enough; the fallback keeps previews working if they're missing.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zfwifcvvhfanheuxdjxs.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2lmY3Z2aGZhbmhldXhkanhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTYyOTMsImV4cCI6MjEwNDEzMjI5M30.2BmTyszmmvOqBAD4LCvcsbyqwURKI-9EwW8NAh-23SM';

/** Lets the request continue to the normal page (what @vercel/functions' next() returns). */
function seguir(): Response {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

/** Same slug rule as scripts/gerar-previas.mjs ("João Pedro Jardim" → "joao-pedro-jardim"). */
export function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Whose personal link this is, or null — asks the `mesas` Edge Function, which only answers the name. */
async function donoDoLink(link: string): Promise<string | null> {
  const resposta = await fetch(`${SUPABASE_URL}/functions/v1/mesas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ link, soNome: true }),
    signal: AbortSignal.timeout(3000),
  });
  if (!resposta.ok) return null;
  const dados = (await resposta.json()) as { voce?: unknown };
  return typeof dados.voce === 'string' ? dados.voce : null;
}

/** index.html's preview block (between the `previa` comments), rewritten for one formando. */
export function comPreviaDoFormando(html: string, nome: string, url: URL): string {
  const titulo = escapar(`${nome} · Mapa das mesas`);
  const descricao = escapar('Escolha onde a sua família vai sentar no baile de formatura da Turma 32, em 10 de dezembro.');
  const imagem = escapar(`${url.origin}/previas/mesas/${slug(nome)}.jpg`);
  const bloco = `<!-- previa -->
    <title>${titulo}</title>
    <meta name="description" content="${descricao}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Turma 32" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:url" content="${escapar(url.href)}" />
    <meta property="og:title" content="${titulo}" />
    <meta property="og:description" content="${descricao}" />
    <meta property="og:image" content="${imagem}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapar(`Logo da Turma 32 e o nome ${nome}`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <!-- /previa -->`;
  return html.replace(/<!-- previa -->[\s\S]*?<!-- \/previa -->/, bloco);
}

export default async function middleware(request: Request): Promise<Response> {
  if (!ROBOS_DE_PREVIA.test(request.headers.get('user-agent') ?? '')) return seguir();

  try {
    const url = new URL(request.url);
    const link = decodeURIComponent(url.pathname.split('/')[2] ?? '');
    if (!/^[a-z0-9]{16,64}$/i.test(link)) return seguir();

    const [nome, pagina] = await Promise.all([donoDoLink(link), fetch(new URL('/index.html', url))]);
    if (!nome || !pagina.ok) return seguir();

    const html = comPreviaDoFormando(await pagina.text(), nome, url);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Personal to this link: never cached where another link could get it.
        'Cache-Control': 'private, max-age=0',
      },
    });
  } catch {
    return seguir();
  }
}
