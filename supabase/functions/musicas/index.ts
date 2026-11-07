// Supabase Edge Function: musicas
//
// Backs /musica: the song each formando walks down the stairs to, and the
// second it starts at. One link for the whole class, entered like the vote:
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
//   - `codigo`: COMMITTEE_CODE. Sees every song, picks or clears anyone's
//     (`formando`, for a song sent on WhatsApp), and opens/freezes the
//     choices (`abertas`), even while frozen.
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

type Plataforma = 'youtube' | 'spotify';
type Lido = { plataforma: Plataforma; codigo: string } | { curto: string } | { erro: string };

/**
 * A pasted YouTube/Spotify link → the video or track. The same rules as
 * lerLinkDaMusica in src/lib/musicas.ts (the page checks first; this is
 * the one that counts).
 */
function lerLink(texto: string): Lido {
  const limpo = texto.trim();
  const uri = /spotify:track:([A-Za-z0-9]{22})/.exec(limpo);
  if (uri) return { plataforma: 'spotify', codigo: uri[1] };
  const achado = /(https?:\/\/[^\s<>"']+)/i.exec(limpo)?.[1] ?? (/^[\w.-]+\.[a-z]{2,}\//i.test(limpo) ? `https://${limpo.split(/\s/)[0]}` : null);
  if (!achado) return { erro: 'Cole o link da música, do YouTube ou do Spotify.' };
  let url: URL;
  try {
    url = new URL(achado);
  } catch {
    return { erro: 'Esse link não parece certo. Copie de novo pelo botão de compartilhar.' };
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
  if (host === 'spotify.link' || host === 'spotify.app.link') return { curto: url.href };
  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    const resto = partes.filter((p) => !/^intl-/.test(p) && p !== 'embed');
    if (resto[0] === 'track' && /^[A-Za-z0-9]{22}$/.test(resto[1] ?? '')) return { plataforma: 'spotify', codigo: resto[1] };
    if (['album', 'playlist', 'artist'].includes(resto[0] ?? '')) {
      return { erro: 'Esse link é de um álbum, playlist ou artista. Abra a música e copie o link dela.' };
    }
    return { erro: 'Não achei a música nesse link do Spotify. Na música, toque em "Compartilhar" e "Copiar link".' };
  }
  return { erro: 'O link precisa ser do YouTube (de preferência) ou do Spotify.' };
}

/**
 * Spotify's app shares short links (spotify.link/…) that only redirect to
 * the track. Follows them: the final address, or else the first track
 * address in the page it lands on. Null if neither works.
 */
async function seguirLinkCurto(curto: string): Promise<string | null> {
  try {
    const resposta = await fetch(curto, { redirect: 'follow', signal: AbortSignal.timeout(5000) });
    const final = lerLink(resposta.url);
    if ('codigo' in final) return final.codigo;
    const pagina = await resposta.text();
    return /open\.spotify\.com\/track\/([A-Za-z0-9]{22})/.exec(pagina)?.[1] ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * The video's or track's name, from the platform's oEmbed. 'naoExiste'
 * when the platform says there's no such video/track; null when it couldn't
 * be asked (slow, down) — the song is kept anyway, without a name.
 */
async function buscarTitulo(plataforma: Plataforma, codigo: string): Promise<string | null | 'naoExiste'> {
  const endereco =
    plataforma === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${codigo}`)}`
      : `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${codigo}`)}`;
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
    const { codigo, whatsapp, nome, acao, link, inicio, formando, abertas: definirAbertas } = await req.json();

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

    // A formando changes their own song only; the committee picks whose.
    const alvo: string | null = comissao ? (typeof formando === 'string' ? formando : null) : voce;
    const mexendo = acao === 'escolher' || acao === 'apagar';
    if (mexendo && !comissao && !voce) return json({ error: 'Entre de novo com o seu WhatsApp.' }, 401);
    if (mexendo && !alvo) return recusar('Escolha de quem é a música.');
    if (mexendo && !comissao && !abertas) {
      return recusar('A comissão já fechou a lista de músicas. Para trocar a sua, fale com ela.');
    }

    if (acao === 'escolher' && alvo) {
      if (typeof link !== 'string' || link.length > 2000) return recusar('Cole o link da música, do YouTube ou do Spotify.');
      if (!Number.isInteger(inicio) || inicio < 0 || inicio >= 36000) return recusar('Confira o minuto e o segundo em que a música começa.');
      let lido = lerLink(link);
      if ('curto' in lido) {
        const faixa = await seguirLinkCurto(lido.curto);
        if (!faixa) {
          return recusar('Não consegui abrir esse link curto do Spotify. Abra a música no navegador e copie o endereço que começa com open.spotify.com/track.');
        }
        lido = { plataforma: 'spotify', codigo: faixa };
      }
      if ('erro' in lido) return recusar(lido.erro);
      const titulo = await buscarTitulo(lido.plataforma, lido.codigo);
      if (titulo === 'naoExiste') {
        return recusar(lido.plataforma === 'youtube' ? 'Esse vídeo não existe ou é privado. Confira o link.' : 'Essa música não foi encontrada no Spotify. Confira o link.');
      }
      const { error } = await supabase.from('musicas_formando').upsert({
        formando: alvo,
        plataforma: lido.plataforma,
        codigo: lido.codigo,
        titulo,
        inicio,
        atualizado_em: new Date().toISOString(),
      });
      if (error) {
        // Not a formando's name (foreign key): only the committee can send one.
        if (error.code === '23503') return recusar('Esse nome não está na lista da turma.');
        throw error;
      }
    }

    if (acao === 'apagar' && alvo) {
      const { error } = await supabase.from('musicas_formando').delete().eq('formando', alvo);
      if (error) throw error;
    }

    if (comissao && acao === 'abertas' && typeof definirAbertas === 'boolean') {
      const { error } = await supabase.from('configuracoes').upsert({ chave: 'musicas_abertas', valor: definirAbertas });
      if (error) throw error;
      abertas = definirAbertas;
    }

    if (comissao) {
      const [musicas, formandos] = await Promise.all([
        supabase.from('musicas_formando').select('formando, plataforma, codigo, titulo, inicio, atualizado_em').order('formando'),
        supabase.from('convidados_formando').select('formando').order('formando'),
      ]);
      if (musicas.error) throw musicas.error;
      if (formandos.error) throw formandos.error;
      return json({
        comissao,
        voce: null,
        livres: null,
        abertas,
        minha: null,
        repetida: false,
        musicas: (musicas.data as Linha[]).map(paraPagina),
        formandos: formandos.data.map((f) => f.formando as string),
      });
    }

    if (!voce) {
      // A number not on the list picks among the names that have none yet.
      let livres: string[] | null = null;
      if (typeof whatsapp === 'string') {
        const { data, error } = await supabase.from('convidados_formando').select('formando').is('whatsapp', null).order('formando');
        if (error) throw error;
        livres = data.map((f) => f.formando as string);
      }
      return json({ comissao, voce, livres, abertas, minha: null, repetida: false, musicas: null, formandos: null });
    }

    const { data: minha, error: erroMinha } = await supabase
      .from('musicas_formando')
      .select('formando, plataforma, codigo, titulo, inicio, atualizado_em')
      .eq('formando', voce)
      .maybeSingle();
    if (erroMinha) throw erroMinha;
    let repetida = false;
    if (minha) {
      const { count, error } = await supabase
        .from('musicas_formando')
        .select('formando', { count: 'exact', head: true })
        .eq('plataforma', minha.plataforma)
        .eq('codigo', minha.codigo)
        .neq('formando', voce);
      if (error) throw error;
      repetida = (count ?? 0) > 0;
    }

    return json({
      comissao,
      voce,
      livres: null,
      abertas,
      minha: minha ? paraPagina(minha as Linha) : null,
      repetida,
      musicas: null,
      formandos: null,
    });
  } catch (error) {
    console.error(error);
    return json({ error: 'Erro interno.' }, 500);
  }
});
