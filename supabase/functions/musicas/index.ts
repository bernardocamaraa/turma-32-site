// Supabase Edge Function: musicas
//
// Backs /musica: the song each formando walks down the stairs to (a
// YouTube video — Spotify was dropped), and the second it starts at. One
// link for the whole class, entered like the vote:
//   - nobody yet: only whether the choices are open.
//   - `whatsapp`: a formando, recognised by their number (the committee
//     fills the numbers in on the vote's tab). A number not on the list
//     comes back with `voce: null` and the names that still have no number
//     (`livres`); sent again with one of them as `nome`, the number gets
//     tied to that name (identificar_eleitor in votacao.sql) — the same
//     number then enters the vote too. Sees and changes only their own
//     song, while the committee keeps the choices open. Never sees a
//     classmate's song. Songs can't repeat (musica_gravar in musicas.sql):
//     the same song by the same artist as someone else's — whatever the
//     video — is refused, without saying whose. The artist and the song's
//     name come from YouTube (the video's "Música" section, else its title,
//     else its channel: infoDoVideo here, musica_identificar there).
//     `conferir` (with a `link`) asks before saving, as the link is pasted:
//     `livre` (yes or no) and the `artista` and `nomeMusica` read in it.
//     `repetida`: their song was saved before the rule and someone else
//     picked it first.
//     Can also walk down in a group of up to 3, to one song: creates it
//     (`criarGrupo`), invites more (`convidar`) or withdraws an invitation
//     (`desconvidar`) if they created it, answers an invitation
//     (`responder`), leaves it (`sairDoGrupo`; the creator undoes it), or
//     says they'll walk down without a group (`semGrupo`) — invitations
//     stay, and their creators see it. Once
//     everyone invited has accepted, any of them picks the group's song
//     (`escolher` with `paraGrupo`). The rules live in musicas.sql.
//     `alternativas` (with a `video` id): for a video YouTube won't
//     play inside other sites (VEVO…), up to 3 other versions of the same
//     song ("lyrics", "audio") that do play here — found on YouTube's own
//     search page, each checked against oEmbed. The committee can ask too.
//     Also gets a link to their own childhood photo (`fotoInfancia`, from
//     the committee's private `fotos-infancia` bucket — infancia.sql), for
//     the record on the last step; never anyone else's.
//   - `codigo`: COMMITTEE_CODE. Sees every song and group, picks or clears
//     anyone's song (`formando`) or a group's (`grupo`) — not one someone
//     else has, and then it's told whose —, undoes a group
//     (`desfazerGrupo`), and opens/freezes the choices (`abertas`), even
//     while frozen. `iguais`: which entries share a song (from before the
//     rule).
//
// The anon key can't touch musicas_formando (musicas.sql): this is the only
// way in.
//
// Deploy with:
//   supabase functions deploy musicas

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

type Plataforma = 'youtube';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Lido = { plataforma: Plataforma; codigo: string } | { erro: string };

/**
 * A pasted YouTube link → the video. The same rules as lerLinkDaMusica in
 * src/lib/musicas.ts (the page checks first; this is the one that counts).
 */
function lerLink(texto: string): Lido {
  const limpo = texto.trim();
  if (/spotify/i.test(limpo)) return { erro: 'O site só aceita link do YouTube. Procure a música no YouTube e cole o link do vídeo.' };
  const achado = /(https?:\/\/[^\s<>"']+)/i.exec(limpo)?.[1] ?? (/^[\w.-]+\.[a-z]{2,}\//i.test(limpo) ? `https://${limpo.split(/\s/)[0]}` : null);
  if (!achado) return { erro: 'Cole o link do vídeo da música no YouTube.' };
  let url: URL;
  try {
    url = new URL(achado);
  } catch {
    return { erro: 'Esse link não parece certo. Copie de novo pelo botão "Compartilhar" do YouTube.' };
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  const partes = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let codigo: string | null = null;
    if (host === 'youtu.be') codigo = partes[0] ?? null;
    else if (partes[0] === 'watch') codigo = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(partes[0] ?? '')) codigo = partes[1] ?? null;
    if (codigo && /^[A-Za-z0-9_-]{11}$/.test(codigo)) return { plataforma: 'youtube', codigo };
    return { erro: 'Não achei o vídeo nesse link do YouTube. Abra o vídeo e copie o link pelo botão "Compartilhar".' };
  }
  return { erro: 'O link precisa ser do YouTube.' };
}

/**
 * The video's name and channel, from YouTube's oEmbed. 'naoExiste' when
 * YouTube says there's no such video; null when it couldn't be asked (slow,
 * down) or won't say (videos that can't be embedded).
 */
async function lerOembed(codigo: string): Promise<{ titulo: string; canal: string | null } | null | 'naoExiste'> {
  const endereco = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${codigo}`)}`;
  try {
    const resposta = await fetch(endereco, { signal: AbortSignal.timeout(4000) });
    if (resposta.status === 404 || resposta.status === 400) return 'naoExiste';
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { title?: unknown; author_name?: unknown };
    if (typeof dados.title !== 'string') return null;
    return { titulo: dados.title.slice(0, 300), canal: typeof dados.author_name === 'string' ? dados.author_name.slice(0, 200) : null };
  } catch (e) {
    console.error(e);
    return null;
  }
}

/** Just the name (see lerOembed) — for checking which videos can play here. */
async function buscarTitulo(codigo: string): Promise<string | null | 'naoExiste'> {
  const o = await lerOembed(codigo);
  return o === 'naoExiste' ? o : o?.titulo ?? null;
}

type Grupo = {
  id: string;
  criado_por: string;
  plataforma: Plataforma | null;
  codigo: string | null;
  titulo: string | null;
  artista: string | null;
  musica: string | null;
  inicio: number;
  musica_em: string | null;
  musicas_grupo_membros: { formando: string; status: 'convidado' | 'aceito' | 'recusado' }[];
};

/** Complete: at least two in, nobody left to answer. */
const completo = (g: Grupo) =>
  g.musicas_grupo_membros.filter((m) => m.status === 'aceito').length >= 2 &&
  !g.musicas_grupo_membros.some((m) => m.status === 'convidado');

/**
 * A group as the page shows it. For someone still invited: whether they said
 * they'll go without a group (`semGrupo`), or are in another one
 * (`emOutroGrupo`) — the invitation stands either way.
 */
const grupoParaPagina = (g: Grupo, semGrupo: Set<string>, emGrupo: Set<string>) => ({
  id: g.id,
  criadoPor: g.criado_por,
  // The creator first, then by name.
  membros: [...g.musicas_grupo_membros].map((m) => m.status === 'convidado' ? { ...m, semGrupo: semGrupo.has(m.formando), emOutroGrupo: emGrupo.has(m.formando) } : m).sort(
    (a, b) => Number(b.formando === g.criado_por) - Number(a.formando === g.criado_por) || a.formando.localeCompare(b.formando, 'pt-BR'),
  ),
  completo: completo(g),
  musica:
    g.plataforma && g.codigo
      ? { plataforma: g.plataforma, codigo: g.codigo, titulo: g.titulo, artista: g.artista, nomeMusica: g.musica, inicio: g.inicio, atualizadoEm: g.musica_em ?? '' }
      : null,
});

const CABECALHOS_YOUTUBE = {
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  // Skips the cookie-consent page some regions get instead of the results.
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
};

type Alternativa = { codigo: string; titulo: string; canal: string | null; duracao: string | null };

/** A video's title even when oEmbed refuses it (videos that can't be embedded): from its page. */
async function tituloDaPagina(codigo: string): Promise<string | null> {
  const doOembed = await buscarTitulo(codigo);
  return typeof doOembed === 'string' ? doOembed : (await lerPagina(codigo))?.titulo ?? null;
}

type DadosPagina = { titulo: string | null; canal: string | null; artista: string | null; musica: string | null };

/** The text of one of YouTube's text objects ({simpleText}, {runs}, {content}) or a plain string. */
function textoYt(x: unknown): string | null {
  if (typeof x === 'string') return x.trim() || null;
  if (!x || typeof x !== 'object') return null;
  const o = x as { simpleText?: unknown; runs?: { text?: unknown }[]; content?: unknown };
  if (typeof o.simpleText === 'string') return o.simpleText.trim() || null;
  if (Array.isArray(o.runs)) return o.runs.map((r) => (typeof r.text === 'string' ? r.text : '')).join('').trim() || null;
  if (typeof o.content === 'string') return o.content.trim() || null;
  return null;
}

/**
 * The song and artist in the "Música" section YouTube adds under a music
 * video (from its ytInitialData), when there is one. YouTube has drawn it
 * two ways: rows labelled "Música"/"Song" and "Artista"/"Artist"
 * (infoRowRenderer), or a card with the song as title and the artist under
 * it (videoAttributeViewModel). Only the first song counts.
 */
export function secaoMusica(dados: unknown): { artista: string | null; musica: string | null } {
  let artista: string | null = null;
  let musica: string | null = null;
  const naSecao = (no: unknown): void => {
    if (!no || typeof no !== 'object' || (artista && musica)) return;
    if (Array.isArray(no)) return no.forEach(naSecao);
    const o = no as Record<string, unknown>;
    const linha = o.infoRowRenderer as Record<string, unknown> | undefined;
    if (linha) {
      const rotulo = (textoYt(linha.title) ?? '').toUpperCase();
      const valor = textoYt(linha.defaultMetadata) ?? textoYt(linha.expandedMetadata);
      if (valor && !musica && /^(SONG|MÚSICA|MUSICA|CANÇÃO)$/.test(rotulo)) musica = valor;
      if (valor && !artista && /^(ARTISTS?|ARTISTAS?)$/.test(rotulo)) artista = valor;
      return;
    }
    const cartao = o.videoAttributeViewModel as Record<string, unknown> | undefined;
    if (cartao) {
      if (!musica && !artista) {
        musica = textoYt(cartao.title);
        artista = textoYt(cartao.subtitle);
      }
      return;
    }
    Object.values(o).forEach(naSecao);
  };
  const procurar = (no: unknown): void => {
    if (!no || typeof no !== 'object' || (artista && musica)) return;
    if (Array.isArray(no)) return no.forEach(procurar);
    const o = no as Record<string, unknown>;
    if (o.videoDescriptionMusicSectionRenderer) return naSecao(o.videoDescriptionMusicSectionRenderer);
    // The card version: a horizontal list whose header says it's music.
    const lista = o.horizontalCardListRenderer as Record<string, unknown> | undefined;
    if (lista && /m[uú]sica|music/i.test(JSON.stringify(lista.header ?? ''))) return naSecao(lista);
    Object.values(o).forEach(procurar);
  };
  procurar(dados);
  return { artista: artista && musica ? artista : null, musica: artista && musica ? musica : null };
}

/**
 * The video's own page: its title (for when oEmbed won't say it), its
 * channel, and the song and artist of its "Música" section. Null when the
 * page couldn't be read; then the title and channel from oEmbed do.
 */
async function lerPagina(codigo: string): Promise<DadosPagina | null> {
  try {
    const resposta = await fetch(`https://www.youtube.com/watch?v=${codigo}`, { headers: CABECALHOS_YOUTUBE, signal: AbortSignal.timeout(4500) });
    const html = await resposta.text();
    const m = /<meta property="og:title" content="([^"]+)"/.exec(html) ?? /<title>([^<]+?)(?: - YouTube)?<\/title>/.exec(html);
    const titulo = m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
    let canal: string | null = null;
    const autor = /"videoDetails":\{.*?"author":"((?:[^"\\]|\\.)*)"/s.exec(html);
    if (autor) {
      try {
        canal = JSON.parse(`"${autor[1]}"`);
      } catch {
        canal = null;
      }
    }
    let secao: { artista: string | null; musica: string | null } = { artista: null, musica: null };
    const dados = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
    if (dados) {
      try {
        secao = secaoMusica(JSON.parse(dados[1]));
      } catch (e) {
        console.error(e);
      }
    }
    return { titulo, canal, ...secao };
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * What YouTube says about a pasted video: title and channel (oEmbed, or the
 * page when oEmbed won't say), and the song and artist of its "Música"
 * section if it has one. Postgres turns that into the artist and song's
 * name (musica_identificar). 'naoExiste' for a video that doesn't exist.
 */
async function infoDoVideo(codigo: string): Promise<DadosPagina | 'naoExiste'> {
  const [oembed, pagina] = await Promise.all([lerOembed(codigo), lerPagina(codigo)]);
  if (oembed === 'naoExiste') return 'naoExiste';
  const info = {
    titulo: oembed?.titulo ?? pagina?.titulo ?? null,
    canal: oembed?.canal ?? pagina?.canal ?? null,
    artista: pagina?.artista ?? null,
    musica: pagina?.musica ?? null,
  };
  // One line per video in the function's logs, to see how well the "Música" section is read.
  console.log(JSON.stringify({ video: codigo, ...info }));
  return info;
}

/** "Artista - Música (Official Music Video) [4K]" → "Artista - Música": what to search for. */
function tituloLimpo(titulo: string): string {
  return titulo
    .replace(/[([][^)\]]*(official|oficial|video|vídeo|clipe|clip|visualizer|4k|hd|ao vivo|live)[^)\]]*[)\]]/gi, '')
    .replace(/\b(official|oficial)\b.*$/i, '')
    .replace(/\bvevo\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The videos on a YouTube search results page (its ytInitialData), in order. */
async function buscarNoYoutube(busca: string): Promise<Alternativa[]> {
  const resposta = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(busca)}&sp=EgIQAQ%253D%253D`, {
    headers: CABECALHOS_YOUTUBE,
    signal: AbortSignal.timeout(6000),
  });
  const html = await resposta.text();
  const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html) ?? /window\["ytInitialData"\] = (\{.*?\});/s.exec(html);
  if (!m) return [];
  const achados: Alternativa[] = [];
  const andar = (no: unknown) => {
    if (!no || typeof no !== 'object' || achados.length >= 15) return;
    if (Array.isArray(no)) return no.forEach(andar);
    const o = no as Record<string, unknown>;
    const v = o.videoRenderer as Record<string, any> | undefined;
    if (v && typeof v.videoId === 'string') {
      achados.push({
        codigo: v.videoId,
        titulo: v.title?.runs?.map((r: { text: string }) => r.text).join('') ?? v.title?.simpleText ?? '',
        canal: v.ownerText?.runs?.[0]?.text ?? null,
        duracao: v.lengthText?.simpleText ?? null,
      });
      return;
    }
    Object.values(o).forEach(andar);
  };
  andar(JSON.parse(m[1]));
  return achados;
}

/** "3:45" / "1:02:03" → seconds. */
const segundosDe = (t: string | null) => (t ? t.split(':').reduce((s, p) => s * 60 + Number(p), 0) : 0);

/**
 * Up to 3 versions of the song in `codigo` that can play inside the site:
 * searches "<title> lyrics" and "<title> audio", puts lyric/audio videos
 * first, drops the original, mixes and very long videos, and keeps only
 * the ones oEmbed answers (YouTube refuses oEmbed for videos that can't be
 * embedded).
 */
async function alternativasPara(codigo: string): Promise<Alternativa[]> {
  const titulo = await tituloDaPagina(codigo);
  if (!titulo) return [];
  const base = tituloLimpo(titulo);
  const listas = await Promise.all([`${base} lyrics`, `${base} audio`].map((b) => buscarNoYoutube(b).catch(() => [] as Alternativa[])));
  const vistos = new Set([codigo]);
  const candidatos: Alternativa[] = [];
  for (const v of listas.flat()) {
    if (vistos.has(v.codigo)) continue;
    vistos.add(v.codigo);
    const seg = segundosDe(v.duracao);
    if (seg === 0 || seg > 12 * 60) continue;
    if (/\b(mix|playlist|1 hour|1 hora|remix|cover|karaok[eê]|8d|slowed|sped up|nightcore)\b/i.test(v.titulo)) continue;
    candidatos.push(v);
  }
  const nota = (v: Alternativa) => (/(lyrics?|letra|legendad|tradu)/i.test(v.titulo) ? 0 : /\b(audio|áudio)\b/i.test(v.titulo) ? 1 : 2);
  candidatos.sort((a, b) => nota(a) - nota(b));
  const conferidos = await Promise.all(
    candidatos.slice(0, 8).map(async (v) => (typeof (await buscarTitulo(v.codigo)) === 'string' ? v : null)),
  );
  const saida = conferidos.filter((v): v is Alternativa => v !== null).slice(0, 3);
  // One line per search in the function's logs, to see how well it finds them.
  console.log(JSON.stringify({ alternativas: codigo, busca: base, achados: listas.map((l) => l.length), candidatos: candidatos.length, tocam: saida.map((v) => v.codigo) }));
  return saida;
}

/** Same slug rule as middleware.ts and the infancia function: each formando's folder of childhood photos. */
function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type Linha = {
  formando: string;
  plataforma: Plataforma;
  codigo: string;
  titulo: string | null;
  artista: string | null;
  musica: string | null;
  inicio: number;
  atualizado_em: string;
};

const paraPagina = (l: Linha) => ({
  formando: l.formando,
  plataforma: l.plataforma,
  codigo: l.codigo,
  titulo: l.titulo,
  artista: l.artista,
  nomeMusica: l.musica,
  inicio: l.inicio,
  atualizadoEm: l.atualizado_em,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const {
      codigo, whatsapp, nome, acao, link, inicio, formando, abertas: definirAbertas, paraGrupo, grupo, convidados, convidado, aceitar, sim, video,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const recusar = (mensagem: string) => json({ error: mensagem }, 400);

    // Who is calling: the committee, a formando (by number), or nobody yet —
    // exactly as in the vote (supabase/functions/votacao).
    let comissao = false;
    let voce: string | null = null;
    if (typeof codigo === 'string') {
      const codigoComissao = Deno.env.get('COMMITTEE_CODE') ?? '';
      if (!codigoComissao || codigo.trim() !== codigoComissao) {
        return json({ error: 'Código incorreto.' }, 401);
      }
      comissao = true;
    } else if (typeof whatsapp === 'string') {
      const { data: dono, error } = await supabase.from('convidados_formando').select('formando').eq('whatsapp', whatsapp).maybeSingle();
      if (error) throw error;
      if (dono) {
        voce = dono.formando as string;
      } else if (typeof nome === 'string') {
        const { error } = await supabase.rpc('identificar_eleitor', { p_formando: nome, p_whatsapp: whatsapp });
        if (error) {
          // Messages raised on purpose in identificar_eleitor() are for the formando.
          if (error.code === 'P0001') return json({ error: error.message }, 401);
          throw error;
        }
        voce = nome;
      }
    }

    const { data: config, error: erroConfig } = await supabase.from('configuracoes').select('valor').eq('chave', 'musicas_abertas').maybeSingle();
    if (erroConfig) throw erroConfig;
    let abertas = config?.valor ?? true;

    // Errors raised on purpose in the SQL functions (P0001) are for the formando.
    async function rpc(nomeFuncao: string, args: Record<string, unknown>): Promise<Response | null> {
      const { error } = await supabase.rpc(nomeFuncao, args);
      if (!error) return null;
      if (error.code === 'P0001') return recusar(error.message);
      throw error;
    }

    /** Every group, with its members. Few enough to always load whole. */
    async function lerGrupos(): Promise<Grupo[]> {
      const { data, error } = await supabase
        .from('musicas_grupos')
        .select('id, criado_por, plataforma, codigo, titulo, artista, musica, inicio, musica_em, musicas_grupo_membros (formando, status)')
        .order('criado_em');
      if (error) throw error;
      return data as Grupo[];
    }

    // Songs saved before the site kept the artist, whose title doesn't say
    // it ("New Romantics"): ask YouTube (the channel, the "Música" section)
    // and keep the names, so they count for the no-repeat rule. Only while
    // there are such songs, a few per call, in the background (the answer
    // doesn't wait for YouTube); never breaks the request.
    const completarNomes = async () => {
      try {
        const [f, g] = await Promise.all([
          supabase.from('musicas_formando').select('formando, codigo').is('artista', null).not('codigo', 'is', null).limit(3),
          supabase.from('musicas_grupos').select('id, codigo').is('artista', null).not('codigo', 'is', null).limit(3),
        ]);
        if (f.error) throw f.error;
        if (g.error) throw g.error;
        const faltam = [
          ...f.data.map((r) => ({ tabela: 'musicas_formando', chave: 'formando', valor: r.formando as string, codigo: r.codigo as string })),
          ...g.data.map((r) => ({ tabela: 'musicas_grupos', chave: 'id', valor: r.id as string, codigo: r.codigo as string })),
        ].slice(0, 3);
        await Promise.all(
          faltam.map(async (m) => {
            const info = await infoDoVideo(m.codigo);
            if (info === 'naoExiste') return;
            const { data, error } = await supabase.rpc('musica_identificar', {
              p_titulo: info.titulo,
              p_canal: info.canal,
              p_artista: info.artista,
              p_musica: info.musica,
            });
            if (error) throw error;
            const nomes = (data as { artista: string | null; musica: string | null }[])[0];
            if (!nomes?.artista || !nomes.musica) return;
            const { error: erroGravar } = await supabase
              .from(m.tabela)
              .update({ artista: nomes.artista, musica: nomes.musica })
              .eq(m.chave, m.valor)
              .eq('codigo', m.codigo)
              .is('artista', null);
            if (erroGravar) throw erroGravar;
          }),
        );
      } catch (e) {
        console.error(e);
      }
    };
    if (comissao || voce) {
      const tarefa = completarNomes();
      const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
      if (runtime) runtime.waitUntil(tarefa);
      else await tarefa;
    }

    // Other versions of a video that won't play here. Only for someone who
    // got in (a formando or the committee), and nothing else changes.
    if (acao === 'alternativas') {
      if (!comissao && !voce) return json({ error: 'Entre de novo com o seu WhatsApp.' }, 401);
      if (typeof video !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(video)) return recusar('Vídeo inválido.');
      try {
        return json({ alternativas: await alternativasPara(video) });
      } catch (e) {
        console.error(e);
        return json({ alternativas: [] });
      }
    }

    // Whether a pasted song can still be picked: nobody else walks down to
    // it. Says which artist and song it read, and yes or no — never whose
    // it is. Nothing changes.
    if (acao === 'conferir') {
      if (!voce) return json({ error: 'Entre de novo com o seu WhatsApp.' }, 401);
      if (typeof link !== 'string' || link.length > 2000) return recusar('Cole o link do vídeo da música no YouTube.');
      const lido = lerLink(link);
      if ('erro' in lido) return recusar(lido.erro);
      const info = await infoDoVideo(lido.codigo);
      if (info === 'naoExiste') return recusar('Esse vídeo não existe ou é privado. Confira o link.');
      // Choosing for their complete group, if they're in one: that group's own song doesn't count.
      const meuGrupo = (await lerGrupos()).find((g) => completo(g) && g.musicas_grupo_membros.some((m) => m.formando === voce && m.status === 'aceito'));
      const { data, error } = await supabase.rpc('musica_conferir', {
        p_titulo: info.titulo,
        p_canal: info.canal,
        p_artista: info.artista,
        p_musica: info.musica,
        p_formando: voce,
        p_grupo: meuGrupo?.id ?? null,
      });
      if (error) throw error;
      const lida = (data as { artista: string | null; musica: string | null; livre: boolean }[])[0];
      return json({ livre: lida?.livre ?? true, artista: lida?.artista ?? null, nomeMusica: lida?.musica ?? null });
    }

    const acoesDeGrupo = ['criarGrupo', 'convidar', 'desconvidar', 'responder', 'sairDoGrupo', 'semGrupo'];
    const mexendo = acao === 'escolher' || acao === 'apagar' || (!comissao && acoesDeGrupo.includes(acao));
    if (mexendo && !comissao && !voce) return json({ error: 'Entre de novo com o seu WhatsApp.' }, 401);
    if (mexendo && !comissao && !abertas) {
      return recusar('A comissão já fechou a lista de músicas. Para mudar, fale com ela.');
    }

    if (voce && acao === 'criarGrupo') {
      const nomes = Array.isArray(convidados) ? convidados.filter((c): c is string => typeof c === 'string' && c.length > 0) : [];
      const falha = await rpc('musica_criar_grupo', { p_formando: voce, p_convidados: nomes });
      if (falha) return falha;
    }
    if (voce && acao === 'convidar' && typeof convidado === 'string') {
      const falha = await rpc('musica_convidar', { p_formando: voce, p_convidado: convidado });
      if (falha) return falha;
    }
    if (voce && acao === 'desconvidar' && typeof convidado === 'string') {
      const falha = await rpc('musica_desconvidar', { p_formando: voce, p_convidado: convidado });
      if (falha) return falha;
    }
    if (voce && acao === 'responder' && typeof grupo === 'string' && UUID.test(grupo) && typeof aceitar === 'boolean') {
      const falha = await rpc('musica_responder', { p_formando: voce, p_grupo: grupo, p_aceitar: aceitar });
      if (falha) return falha;
    }
    if (voce && acao === 'sairDoGrupo') {
      const falha = await rpc('musica_sair_do_grupo', { p_formando: voce });
      if (falha) return falha;
    }
    if (voce && acao === 'semGrupo' && typeof sim === 'boolean') {
      if (sim) {
        const { data: dentro, error: erroDentro } = await supabase
          .from('musicas_grupo_membros').select('grupo').eq('formando', voce).eq('status', 'aceito').maybeSingle();
        if (erroDentro) throw erroDentro;
        if (dentro) return recusar('Você está num grupo. Saia dele antes.');
        const { error } = await supabase.from('musicas_sem_grupo').upsert({ formando: voce });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('musicas_sem_grupo').delete().eq('formando', voce);
        if (error) throw error;
      }
    }
    if (comissao && acao === 'desfazerGrupo' && typeof grupo === 'string' && UUID.test(grupo)) {
      const { error } = await supabase.from('musicas_grupos').delete().eq('id', grupo);
      if (error) throw error;
    }

    // Whose song is changing: a formando's own, or their complete group's;
    // for the committee, the `formando` or the `grupo` it names.
    let alvo: { formando: string } | { grupo: string } | null = null;
    if (acao === 'escolher' || acao === 'apagar') {
      if (comissao) {
        if (typeof grupo === 'string' && UUID.test(grupo)) alvo = { grupo };
        else if (typeof formando === 'string') alvo = { formando };
        else return recusar('Escolha de quem é a música.');
      } else if (voce) {
        const doGrupo = (await lerGrupos()).find((g) => g.musicas_grupo_membros.some((m) => m.formando === voce && m.status === 'aceito'));
        const fechado = doGrupo && completo(doGrupo);
        // `paraGrupo` says which form the page showed: if the group closed
        // (or came apart) meanwhile, say so instead of saving it elsewhere.
        if (paraGrupo === true && !fechado) return recusar('O grupo ainda não está completo. Quando todos aceitarem, vocês escolhem a música do grupo.');
        if (paraGrupo === false && fechado) return recusar('Seu grupo já está completo: agora vocês escolhem a música do grupo.');
        alvo = fechado ? { grupo: doGrupo.id } : { formando: voce };
      }
    }

    if (acao === 'escolher' && alvo) {
      if (typeof link !== 'string' || link.length > 2000) return recusar('Cole o link do vídeo da música no YouTube.');
      if (!Number.isInteger(inicio) || inicio < 0 || inicio >= 36000) return recusar('Confira o minuto e o segundo em que a música começa.');
      const lido = lerLink(link);
      if ('erro' in lido) return recusar(lido.erro);
      const info = await infoDoVideo(lido.codigo);
      if (info === 'naoExiste') return recusar('Esse vídeo não existe ou é privado. Confira o link.');
      // Saved in Postgres with its artist and song, unless someone else
      // already has that song — one save at a time, so two can't take the
      // same song at once.
      const falha = await rpc('musica_gravar', {
        p_formando: 'grupo' in alvo ? voce : alvo.formando,
        p_grupo: 'grupo' in alvo ? alvo.grupo : null,
        p_codigo: lido.codigo,
        p_titulo: info.titulo,
        p_canal: info.canal,
        p_artista: info.artista,
        p_musica: info.musica,
        p_inicio: inicio,
        p_comissao: comissao,
      });
      if (falha) return falha;
    }

    if (acao === 'apagar' && alvo) {
      const { error } =
        'grupo' in alvo
          ? await supabase.from('musicas_grupos').update({ plataforma: null, codigo: null, titulo: null, artista: null, musica: null, inicio: 0, musica_em: null }).eq('id', alvo.grupo)
          : await supabase.from('musicas_formando').delete().eq('formando', alvo.formando);
      if (error) throw error;
    }

    if (comissao && acao === 'abertas' && typeof definirAbertas === 'boolean') {
      const { error } = await supabase.from('configuracoes').upsert({ chave: 'musicas_abertas', valor: definirAbertas });
      if (error) throw error;
      abertas = definirAbertas;
    }

    if (!comissao && !voce) {
      // A number not on the list picks among the names that have none yet.
      let livres: string[] | null = null;
      if (typeof whatsapp === 'string') {
        const { data, error } = await supabase.from('convidados_formando').select('formando').is('whatsapp', null).order('formando');
        if (error) throw error;
        livres = data.map((f) => f.formando as string);
      }
      return json({ comissao, voce, livres, abertas, minha: null, repetida: false, musicas: null, formandos: null, grupo: null, convites: [], emGrupo: [], semGrupo: false, grupos: null, fotoInfancia: null });
    }

    const [musicas, formandos, grupos, semGrupoLido] = await Promise.all([
      supabase.from('musicas_formando').select('formando, plataforma, codigo, titulo, artista, musica, inicio, atualizado_em').order('formando'),
      supabase.from('convidados_formando').select('formando').order('formando'),
      lerGrupos(),
      supabase.from('musicas_sem_grupo').select('formando'),
    ]);
    if (musicas.error) throw musicas.error;
    if (formandos.error) throw formandos.error;
    if (semGrupoLido.error) throw semGrupoLido.error;
    const semGrupo = new Set(semGrupoLido.data.map((r) => r.formando as string));
    const emGrupo = new Set(grupos.flatMap((g) => g.musicas_grupo_membros.filter((m) => m.status === 'aceito').map((m) => m.formando)));
    const paraPaginaG = (g: Grupo) => grupoParaPagina(g, semGrupo, emGrupo);
    const linhas = musicas.data as Linha[];
    const nomes = formandos.data.map((f) => f.formando as string);

    if (comissao) {
      // Entries (a formando's name, or a group's id) sharing a song — from before the rule.
      const { data: iguais, error: erroIguais } = await supabase.rpc('musicas_repetidas');
      if (erroIguais) throw erroIguais;
      return json({
        iguais: (iguais as { a: string; b: string }[]).map((p) => [p.a, p.b]),
        comissao,
        voce: null,
        livres: null,
        abertas,
        minha: null,
        repetida: false,
        musicas: linhas.map(paraPagina),
        formandos: nomes,
        grupo: null,
        convites: [],
        emGrupo: [],
        semGrupo: false,
        grupos: grupos.map(paraPaginaG),
      });
    }

    const meuGrupo = grupos.find((g) => g.musicas_grupo_membros.some((m) => m.formando === voce && m.status === 'aceito')) ?? null;
    const convites = grupos.filter((g) => g.musicas_grupo_membros.some((m) => m.formando === voce && m.status === 'convidado'));
    const minha = linhas.find((l) => l.formando === voce) ?? null;

    // `repetida`: their song (or their complete group's) is one someone else
    // picked earlier — only possible for songs saved before the rule. The
    // later one is the repeat; who has it is never said.
    const atual =
      meuGrupo && completo(meuGrupo)
        ? { codigo: meuGrupo.codigo, artista: meuGrupo.artista, musica: meuGrupo.musica, em: meuGrupo.musica_em }
        : minha && { codigo: minha.codigo, artista: minha.artista, musica: minha.musica, em: minha.atualizado_em };
    let repetida = false;
    if (atual?.codigo) {
      const { data: antes, error } = await supabase.rpc('musica_ja_tem', {
        p_artista: atual.artista,
        p_musica: atual.musica,
        p_formando: voce,
        p_grupo: meuGrupo?.id ?? null,
        p_antes: atual.em,
      });
      if (error) console.error(error);
      else repetida = antes !== null;
    }

    // Their own childhood photo (the first one sent), for the record's label
    // on the last step. A group's record shows the class logo instead, so
    // it's not even looked up then. Never breaks the page if it fails.
    let fotoInfancia: string | null = null;
    if (!(meuGrupo && completo(meuGrupo))) {
      try {
        const { data: arquivos } = await supabase.storage
          .from('fotos-infancia')
          .list(slug(voce!), { limit: 1, sortBy: { column: 'created_at', order: 'asc' } });
        const arquivo = (arquivos ?? []).find((a) => a.id);
        if (arquivo) {
          const { data } = await supabase.storage.from('fotos-infancia').createSignedUrl(`${slug(voce!)}/${arquivo.name}`, 60 * 60 * 24);
          fotoInfancia = data?.signedUrl ?? null;
        }
      } catch (e) {
        console.error(e);
      }
    }

    return json({
      comissao,
      voce,
      livres: null,
      abertas,
      minha: minha ? paraPagina(minha) : null,
      repetida,
      musicas: null,
      // The class list, to pick who to invite; `emGrupo`: already in one.
      formandos: nomes,
      grupo: meuGrupo ? paraPaginaG(meuGrupo) : null,
      // An invitation doesn't show the group's song: that's for who's in it.
      convites: convites.map((g) => ({ ...paraPaginaG(g), musica: null })),
      emGrupo: [...emGrupo],
      semGrupo: semGrupo.has(voce!),
      grupos: null,
      fotoInfancia,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
