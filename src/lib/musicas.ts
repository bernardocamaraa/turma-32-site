import { chamarFuncao } from './supabase';

/**
 * The song each formando walks down the stairs to (/musica), and where in
 * it the DJ starts. YouTube only: every video can be played on the night,
 * and the page can play it from the chosen second for the formando to
 * check. (Spotify was accepted at first and dropped: its player here only
 * played a preview.)
 */
export type Plataforma = 'youtube';

/** A song as picked: by one formando (Musica) or by a group (Grupo.musica). */
export type MusicaBase = {
  plataforma: Plataforma;
  /** The YouTube video's id. */
  codigo: string;
  /** The video's name, when the function could look it up. */
  titulo: string | null;
  /**
   * The artist and the song's name, read from YouTube (the video's "Música"
   * section, its title, or its channel). Songs can't repeat by these: the
   * same song by the same artist, whatever the video.
   */
  artista?: string | null;
  nomeMusica?: string | null;
  /** Seconds from the start of the song. */
  inicio: number;
  atualizadoEm: string;
};

export type Musica = MusicaBase & { formando: string };

export type MembroGrupo = {
  formando: string;
  status: 'convidado' | 'aceito' | 'recusado';
  /** Still invited, but said they'll walk down without a group — can still change their mind. */
  semGrupo?: boolean;
  /** Still invited, but accepted another group meanwhile. */
  emOutroGrupo?: boolean;
};

/**
 * Up to 3 formandos walking down together, to one song (musicas.sql): the
 * creator invites, each invitee accepts or refuses; complete once everyone
 * invited accepted (two or more in). While complete, the members' own songs
 * are set aside.
 */
export type Grupo = {
  id: string;
  criadoPor: string;
  /** The creator first. */
  membros: MembroGrupo[];
  completo: boolean;
  /** The group's song — null until picked, and always in an invitation. */
  musica: MusicaBase | null;
};

export type DadosMusicas = {
  comissao: boolean;
  /** The formando the WhatsApp belongs to (null for the committee, or for a number not on the list). */
  voce: string | null;
  /** Names with no number yet, for a number not on the list to pick from. */
  livres: string[] | null;
  /** Whether formandos can still change their song (the committee always can). */
  abertas: boolean;
  /** The formando's own song, if they picked one. */
  minha: Musica | null;
  /**
   * Songs can't repeat (the server refuses one someone else has). True only
   * for a song saved before that rule that someone else picked first: this
   * one is the repeat and should change. Who has it isn't said.
   */
  repetida: boolean;
  /** Committee only: entries sharing a song (a formando's name, or a group's id), each pair both ways. */
  iguais?: [string, string][] | null;
  /** Committee only: every formando's own song. */
  musicas: Musica[] | null;
  /** Every formando's name (to the committee, and to a formando to pick who to invite). */
  formandos: string[] | null;
  /** The formando's group (accepted in it), complete or not. */
  grupo: Grupo | null;
  /** Groups inviting the formando, waiting for an answer. */
  convites: Grupo[];
  /** Who's already in a group (can't be invited). */
  emGrupo: string[];
  /** The formando said they'll walk down without a group (their invitations still stand). */
  semGrupo: boolean;
  /** Committee only: every group. */
  grupos: Grupo[] | null;
  /**
   * A link (valid a day) to the formando's own childhood photo, the one the
   * committee collected — for the record's label on the last step. Null when
   * there's none yet, or for a complete group (the class logo goes there).
   */
  fotoInfancia?: string | null;
};

export type AcessoMusicas = { whatsapp: string; nome?: string } | { codigo: string } | Record<string, never>;

export type AcaoMusicas =
  /**
   * Picks (or replaces) the song. `paraGrupo`: the group's (the formando's
   * complete group) rather than their own. Committee: whose — `formando`, or `grupo`.
   */
  | { acao: 'escolher'; link: string; inicio: number; paraGrupo?: boolean; formando?: string; grupo?: string }
  | { acao: 'apagar'; paraGrupo?: boolean; formando?: string; grupo?: string }
  /** Starts a group, inviting 1 or 2 classmates. */
  | { acao: 'criarGrupo'; convidados: string[] }
  /** The group's creator: invite one more, or withdraw an invitation. */
  | { acao: 'convidar' | 'desconvidar'; convidado: string }
  | { acao: 'responder'; grupo: string; aceitar: boolean }
  /** Leaves the group — the creator undoes it for everyone. */
  | { acao: 'sairDoGrupo' }
  /** Says (or takes back) that they'll walk down without a group. */
  | { acao: 'semGrupo'; sim: boolean }
  /** Committee: undo a group. */
  | { acao: 'desfazerGrupo'; grupo: string }
  /** Committee: let the class change their songs, or freeze them. */
  | { acao: 'abertas'; abertas: boolean };

export function buscarMusicas(acesso: AcessoMusicas, acao?: AcaoMusicas): Promise<DadosMusicas> {
  return chamarFuncao<DadosMusicas>('musicas', { ...acesso, ...acao });
}

export function urlDaMusica(): string {
  return `${window.location.origin}/musica`;
}

/** What a pasted link turned out to be. */
export type LinkLido =
  | { plataforma: Plataforma; codigo: string; /** A start time carried by the link itself (YouTube's ?t=). */ inicio: number | null }
  | { erro: string };

/** "90", "90s", "1m30s", "1h2m3s" (YouTube's ?t=) → seconds. */
function lerT(t: string | null): number | null {
  if (!t) return null;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !t) return null;
  return (parseInt(m[1] ?? '0', 10) * 60 + parseInt(m[2] ?? '0', 10)) * 60 + parseInt(m[3] ?? '0', 10);
}

/** What to say when someone pastes a Spotify link. */
const SO_YOUTUBE = 'O site só aceita link do YouTube. Procure a música no YouTube e cole o link do vídeo.';

/**
 * Reads a YouTube link as people paste it — straight from the share button,
 * with tracking bits, inside a sentence, from music.youtube.com, a Short,
 * youtu.be. The same rules run in the `musicas` Edge Function, which has
 * the last word.
 */
export function lerLinkDaMusica(texto: string): LinkLido | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  if (/spotify/i.test(limpo)) return { erro: SO_YOUTUBE };
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
  const video = /^[A-Za-z0-9_-]{11}$/;

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const t = lerT(url.searchParams.get('t') ?? url.searchParams.get('start'));
    let codigo: string | null = null;
    if (host === 'youtu.be') codigo = partes[0] ?? null;
    else if (partes[0] === 'watch') codigo = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(partes[0] ?? '')) codigo = partes[1] ?? null;
    if (codigo && video.test(codigo)) return { plataforma: 'youtube', codigo, inicio: t };
    if (partes[0] === 'playlist') return { erro: 'Esse é o link de uma playlist. Abra a música e copie o link dela.' };
    return { erro: 'Não achei o vídeo nesse link do YouTube. Abra o vídeo e copie o link pelo botão "Compartilhar".' };
  }

  return { erro: 'O link precisa ser do YouTube.' };
}

/** 90 → "1:30"; 3725 → "1:02:05". */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Where to open the song: the video already at the chosen second. */
export function linkDaMusica(m: Pick<MusicaBase, 'codigo' | 'inicio'>): string {
  return `https://www.youtube.com/watch?v=${m.codigo}${m.inicio > 0 ? `&t=${m.inicio}s` : ''}`;
}

/** ["Ana", "Bia", "Caio"] → "Ana, Bia e Caio". */
export function juntarNomes(nomes: string[]): string {
  return nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** Who's in (accepted) — the names that walk down together. */
export const membrosDentro = (g: Grupo) => g.membros.filter((m) => m.status === 'aceito').map((m) => m.formando);

/**
 * Committee: how many formandos already have a song — their own, or their
 * complete group's (a member's own song doesn't count while in one).
 */
export function quantosTemMusica(d: DadosMusicas): number {
  const fechados = (d.grupos ?? []).filter((g) => g.completo);
  const emFechado = new Set(fechados.flatMap(membrosDentro));
  const deGrupos = fechados.filter((g) => g.musica).flatMap(membrosDentro).length;
  return deGrupos + (d.musicas ?? []).filter((m) => !emFechado.has(m.formando)).length;
}

/** Another version of a song (lyrics, audio) that plays inside the site. */
export type Alternativa = { codigo: string; titulo: string; canal: string | null; duracao: string | null };

/** What `conferirMusica` says about a pasted video. */
export type Conferida = { livre: boolean; artista: string | null; nomeMusica: string | null };

/**
 * Whether the song in `link` can still be picked: nobody else walks down to
 * the same song by the same artist. Also says which artist and song the
 * site read in the video. Never whose it is. The server checks again when
 * saving.
 */
export async function conferirMusica(acesso: AcessoMusicas, link: string): Promise<Conferida> {
  const r = await chamarFuncao<Partial<Conferida>>('musicas', { ...acesso, acao: 'conferir', link });
  return { livre: r.livre !== false, artista: r.artista ?? null, nomeMusica: r.nomeMusica ?? null };
}

/** "Coldplay — Viva La Vida" when the artist and song are known; else the video's name. */
export function nomeDaMusica(m: Pick<MusicaBase, 'titulo' | 'artista' | 'nomeMusica'>): string {
  return m.artista && m.nomeMusica ? `${m.artista} — ${m.nomeMusica}` : m.titulo ?? 'Vídeo do YouTube';
}

/**
 * For a video YouTube won't play inside other sites (VEVO…): up to 3 other
 * versions of the same song that do. Empty if none was found.
 */
export async function buscarAlternativas(acesso: AcessoMusicas, video: string): Promise<Alternativa[]> {
  const r = await chamarFuncao<{ alternativas?: Alternativa[] }>('musicas', { ...acesso, acao: 'alternativas', video });
  return r.alternativas ?? [];
}
