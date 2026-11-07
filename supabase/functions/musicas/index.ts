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
//     classmate's song: only that someone else picked the same one
//     (`repetida`).
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
//     anyone's song (`formando`) or a group's (`grupo`), undoes a group
//     (`desfazerGrupo`), and opens/freezes the choices (`abertas`), even
//     while frozen.
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
 * The video's name, from YouTube's oEmbed. 'naoExiste' when YouTube says
 * there's no such video; null when it couldn't be asked (slow, down) — the
 * song is kept anyway, without a name.
 */
async function buscarTitulo(codigo: string): Promise<string | null | 'naoExiste'> {
  const endereco = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${codigo}`)}`;
  try {
    const resposta = await fetch(endereco, { signal: AbortSignal.timeout(4000) });
    if (resposta.status === 404 || resposta.status === 400) return 'naoExiste';
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as { title?: unknown };
    return typeof dados.title === 'string' ? dados.title.slice(0, 300) : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

type Grupo = {
  id: string;
  criado_por: string;
  plataforma: Plataforma | null;
  codigo: string | null;
  titulo: string | null;
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
      ? { plataforma: g.plataforma, codigo: g.codigo, titulo: g.titulo, inicio: g.inicio, atualizadoEm: g.musica_em ?? '' }
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
  if (typeof doOembed === 'string') return doOembed;
  try {
    const resposta = await fetch(`https://www.youtube.com/watch?v=${codigo}`, { headers: CABECALHOS_YOUTUBE, signal: AbortSignal.timeout(5000) });
    const html = await resposta.text();
    const m = /<meta property="og:title" content="([^"]+)"/.exec(html) ?? /<title>([^<]+?)(?: - YouTube)?<\/title>/.exec(html);
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
  } catch (e) {
    console.error(e);
    return null;
  }
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

type Linha = { formando: string; plataforma: Plataforma; codigo: string; titulo: string | null; inicio: number; atualizado_em: string };

const paraPagina = (l: Linha) => ({
  formando: l.formando,
  plataforma: l.plataforma,
  codigo: l.codigo,
  titulo: l.titulo,
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
        .select('id, criado_por, plataforma, codigo, titulo, inicio, musica_em, musicas_grupo_membros (formando, status)')
        .order('criado_em');
      if (error) throw error;
      return data as Grupo[];
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
      const titulo = await buscarTitulo(lido.codigo);
      if (titulo === 'naoExiste') return recusar('Esse vídeo não existe ou é privado. Confira o link.');
      const agora = new Date().toISOString();
      if ('grupo' in alvo) {
        const { error } = await supabase
          .from('musicas_grupos')
          .update({ plataforma: lido.plataforma, codigo: lido.codigo, titulo, inicio, musica_em: agora })
          .eq('id', alvo.grupo);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('musicas_formando').upsert({
          formando: alvo.formando,
          plataforma: lido.plataforma,
          codigo: lido.codigo,
          titulo,
          inicio,
          atualizado_em: agora,
        });
        if (error) {
          // Not a formando's name (foreign key): only the committee can send one.
          if (error.code === '23503') return recusar('Esse nome não está na lista da turma.');
          throw error;
        }
      }
    }

    if (acao === 'apagar' && alvo) {
      const { error } =
        'grupo' in alvo
          ? await supabase.from('musicas_grupos').update({ plataforma: null, codigo: null, titulo: null, inicio: 0, musica_em: null }).eq('id', alvo.grupo)
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
      supabase.from('musicas_formando').select('formando, plataforma, codigo, titulo, inicio, atualizado_em').order('formando'),
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
      return json({
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

    // The songs that will actually play: complete groups' and everyone
    // else's own. `repetida`: someone else's is the same as yours.
    const fechados = grupos.filter(completo);
    const emFechado = new Set(fechados.flatMap((g) => g.musicas_grupo_membros.filter((m) => m.status === 'aceito').map((m) => m.formando)));
    const tocando = [
      ...linhas.filter((l) => !emFechado.has(l.formando)).map((l) => ({ dono: l.formando, plataforma: l.plataforma, codigo: l.codigo })),
      ...fechados.filter((g) => g.codigo).map((g) => ({ dono: g.id, plataforma: g.plataforma, codigo: g.codigo })),
    ];
    const minhaAgora = meuGrupo && completo(meuGrupo) ? { dono: meuGrupo.id, plataforma: meuGrupo.plataforma, codigo: meuGrupo.codigo } : minha && { dono: minha.formando, plataforma: minha.plataforma, codigo: minha.codigo };
    const repetida =
      !!minhaAgora?.codigo && tocando.some((t) => t.dono !== minhaAgora.dono && t.plataforma === minhaAgora.plataforma && t.codigo === minhaAgora.codigo);

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
