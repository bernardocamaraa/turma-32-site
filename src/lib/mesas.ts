import { chamarFuncao } from './supabase';

/**
 * The venue's table map, traced from the floor plan the venue sent (602×336
 * px). Positions are the center of each table as a percentage of that
 * drawing, so the map scales to any width. Ids follow the layout: E = the
 * grid on the left, R = the two rectangles beside the dance floor, D = the
 * column on the far right, P = the teachers' table.
 *
 * Which tables are reserved (professores/comissão) lives in the database
 * (`mesas.reservada_para`) — that's what's enforced — this file only says
 * where to draw them.
 */
export type FormatoMesa = 'redonda' | 'retangular';

export type PosicaoMesa = {
  id: string;
  formato: FormatoMesa;
  /** Center, in % of the map's width/height. */
  x: number;
  y: number;
};

const LARGURA = 602;
const ALTURA = 336;

const pct = (px: number, total: number) => (px / total) * 100;

function redonda(id: string, cx: number, cy: number): PosicaoMesa {
  return { id, formato: 'redonda', x: pct(cx, LARGURA), y: pct(cy, ALTURA) };
}

const COLUNAS_ESQUERDA = [28, 78, 128, 178];
const LINHAS_ESQUERDA = [32, 92, 153, 215];

export const POSICOES_MESAS: PosicaoMesa[] = [
  // 4 + 4 + 4 + 2 on the left, numbered row by row.
  ...LINHAS_ESQUERDA.flatMap((cy, linha) =>
    COLUNAS_ESQUERDA.slice(0, linha === 3 ? 2 : 4).map((cx, coluna) => redonda(`E${linha * 4 + coluna + 1}`, cx, cy)),
  ),
  { id: 'R1', formato: 'retangular', x: pct(413, LARGURA), y: pct(92, ALTURA) },
  { id: 'R2', formato: 'retangular', x: pct(413, LARGURA), y: pct(209, ALTURA) },
  redonda('D1', 505, 52),
  redonda('D2', 505, 124),
  redonda('D3', 505, 188),
  redonda('D4', 505, 253),
  redonda('P', 321, 259),
];

/** Size of each kind of table, in % of the map's width/height. */
export const TAMANHO_MESA: Record<FormatoMesa, { w: number; h: number }> = {
  redonda: { w: pct(44, LARGURA), h: pct(44, ALTURA) },
  retangular: { w: pct(50, LARGURA), h: pct(92, ALTURA) },
};

/** The dance floor, as a box in % (left, top, width, height). */
export const PISTA = { x: pct(230, LARGURA), y: pct(31, ALTURA), w: pct(122, LARGURA), h: pct(122, ALTURA) };

/** The stairs, bottom left — drawn as a label only. */
export const ESCADA = { x: pct(122, LARGURA), y: pct(290, ALTURA) };

export const PROPORCAO_MAPA = LARGURA / ALTURA;

export type Mesa = {
  id: string;
  capacidade: number;
  reservada_para: 'professores' | 'comissao' | null;
  /**
   * People who aren't formandos but already hold a seat here — the teachers
   * at table P. One seat each. Optional so the page still works against an
   * older `mesas` function that doesn't send it.
   */
  ocupantes_fixos?: string[];
};

export type Reserva = {
  formando: string;
  mesa: string;
  lugares: number;
};

export type ConvidadosFormando = {
  formando: string;
  total: number;
  /** Secret part of the formando's personal URL — only sent to the committee. */
  link?: string;
  /** Their WhatsApp (digits with country code), once they've entered the vote — only sent to the committee. */
  whatsapp?: string | null;
};

export type DadosMesas = {
  /** True when the code typed was the committee's — unlocks reserved tables and the admin panel. */
  comissao: boolean;
  /** The formando a personal link belongs to (null for the committee). */
  voce: string | null;
  /** Whether formandos can still change their seats (the committee can always). */
  abertas: boolean;
  mesas: Mesa[];
  reservas: Reserva[];
  convidados: ConvidadosFormando[];
};

export type AlteracaoMesas =
  | { formando: string; mesa: string; lugares: number }
  | { definirConvidados: { formando: string; total: number } }
  | { definirMesasAbertas: boolean }
  | { novoLink: string };

/** Who's asking: a formando by their personal link, or the committee by its code. */
export type AcessoMesas = { link: string } | { codigo: string };

/** The personal URL the committee sends each formando. */
export function urlDoFormando(link: string): string {
  return `${window.location.origin}/mesas/${link}`;
}

/**
 * Every read and write goes through the `mesas` Edge Function, which checks
 * the personal link (or committee code) — the anon key in the bundle can't read
 * these tables directly (supabase/mesas.sql). Pass an `alteracao` to change
 * something first; the response is always the whole map after that change,
 * so the screen never shows a stale count after a save.
 */
export function buscarMesas(acesso: AcessoMesas, alteracao?: AlteracaoMesas): Promise<DadosMesas> {
  return chamarFuncao<DadosMesas>('mesas', { ...acesso, ...alteracao });
}
