import { chamarFuncao } from './supabase';

export type TipoPergunta = 'formandos' | 'opcoes';

/** An option's votes — null when the committee chose not to show the counts (see Exibicao). */
export type Resultado = { opcao: string; votos: number | null };

/**
 * What the class sees of a released result, as the committee chooses: only
 * the most voted, never the full count, which is the committee's alone
 * (resultado_* in votacao.sql).
 */
export type Exibicao = {
  /** How many of the most voted show — ties at the last place all come in. */
  primeiros: number;
  /** Whether each one's count shows too. */
  votos: boolean;
  /** Whether the valid and blank votes show. */
  totais: boolean;
};

export type Pergunta = {
  id: string;
  pergunta: string;
  /** 'formandos': the options are the class itself; 'opcoes': written by the committee. */
  tipo: TipoPergunta;
  opcoes: string[];
  /** Not closed yet: accepting votes, unless still `pronta`. Closing is final. */
  aberta: boolean;
  /** Ready but not opened yet: the class doesn't see it nor vote on it — so only the committee ever gets one. Opening is final. */
  pronta: boolean;
  /** The class can see the result. */
  resultadoLiberado: boolean;
  /** How many options a formando picks: 1, or anything from 1 up to this ("escolha até 3"). */
  maximo: number;
  /** Whether the formando asking already voted on it (always false for the committee). */
  jaVotou: boolean;
  /** How many voted — sent to the committee always, to formandos with the result and its totals. */
  votaram: number | null;
  /** Who hasn't voted yet — committee only. */
  faltam: string[] | null;
  /**
   * Votes per option, most voted first — once released, or to the committee
   * once closed. Formandos get only what `exibicao` shows: the most voted.
   */
  resultado: Resultado[] | null;
  /** Votes given to a name (on a 2-vote question, up to 2 per ballot) — sent along with `resultado`, to formandos only with the totals. */
  validos: number | null;
  /** Blank votes, apart from the options: whole blank ballots and single votes left blank — like `validos`. */
  brancos: number | null;
  exibicao: Exibicao;
  /**
   * Names elected in another (closed) category, where they got more votes:
   * off this one's ranking, the place goes to whoever came next. `em`: that
   * category (null for the class while its result isn't out). `apareceria`:
   * they'd have shown among the most voted here. The class gets only those.
   */
  eleitosEmOutra: { nome: string; em: string | null; apareceria: boolean }[];
  /** Committee: names with as many votes here as in another category — who goes where is theirs to decide. */
  empate: string[] | null;
};

export type DadosVotacao = {
  comissao: boolean;
  /** The formando the WhatsApp number belongs to (null for the committee, before entering, or for a number not on the list). */
  voce: string | null;
  formandos: string[];
  /** Each formando's WhatsApp number, or null if there's none yet — committee only. */
  eleitores: { formando: string; whatsapp: string | null }[] | null;
  /** Names with no number yet, for a formando whose number isn't on the list to pick from (null for the committee or once identified). */
  livres: string[] | null;
  /** The site's public Web Push key, for a committee phone to turn the notification on — committee only. */
  chavePush?: string | null;
  /** How many phones get the "everyone voted" notification — committee only. */
  aparelhosAvisados?: number | null;
  perguntas: Pergunta[];
};

/**
 * Who's asking: nobody yet, a formando by their WhatsApp number (digits with
 * country code) — plus the name they picked, when the number isn't on the
 * list yet — or the committee by its code.
 */
export type AcessoVotacao = Record<string, never> | { whatsapp: string; nome?: string } | { codigo: string };

/**
 * A name as the no-repeat rule compares it: accents, capitals and extra
 * spaces aside, so "Laís Boldrim" in one question and "lais  boldrim" in
 * another are the same person. Same as chave_opcao in votacao.sql.
 */
export function chaveDoNome(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A result (most voted first) cut down to what the class sees: without
 * those elected in another category, only the options with at least as many
 * votes as the one in place `primeiros` (so a tie there brings them all),
 * and their counts only if `votos`. The Edge
 * Function does the same before sending it (paraTurma); here it's the
 * committee's preview.
 */
export function resultadoDaTurma(resultado: Resultado[], exibicao: Exibicao, eleitosEmOutra: { nome: string }[] = []): Resultado[] {
  // Off the ranking first: who was elected in another category (Pergunta.eleitosEmOutra).
  const fora = new Set(eleitosEmOutra.map((e) => chaveDoNome(e.nome)));
  resultado = resultado.filter((r) => !fora.has(chaveDoNome(r.opcao)));
  const corte = resultado[exibicao.primeiros - 1]?.votos ?? 0;
  return resultado
    .filter((r) => (r.votos ?? 0) > 0 && (r.votos ?? 0) >= corte)
    .map((r) => (exibicao.votos ? r : { ...r, votos: null }));
}

/** The names a question offers: the whole class, or the options the committee wrote. */
export function nomesDaPergunta(p: Pick<Pergunta, 'tipo' | 'opcoes'>, formandos: string[]): string[] {
  return p.tipo === 'formandos' ? formandos : p.opcoes;
}

/** The one link the whole class votes through. */
export function urlDaVotacao(): string {
  return `${window.location.origin}/votacao`;
}

/** The area code assumed when a number is typed without one — the whole class is from Rio. */
const DDD_PADRAO = '21';

/**
 * A WhatsApp number however it's typed — "(21) 99999-9999", "99999-9999"
 * (no area code: 21), "+55 21 …", "021 …", or a mobile still written the
 * old way, without the leading 9 — as one canonical form: digits with
 * Brazil's country code and the 9 on mobiles (5521999999999). The same
 * phone always comes out the same, so it matches the number on the list.
 * Null if it doesn't look like a phone number.
 */
export function normalizarWhatsapp(texto: string): string | null {
  let digitos = texto.replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
  else if (digitos.startsWith('0')) digitos = digitos.slice(1);
  if (digitos.length === 8 || digitos.length === 9) digitos = DDD_PADRAO + digitos;
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  const ddd = digitos.slice(0, 2);
  let numero = digitos.slice(2);
  if (ddd.startsWith('0')) return null;
  // Mobiles start with 6–9 and gained a 9 in front; landlines (2–5) didn't.
  if (numero.length === 8 && /^[6-9]/.test(numero)) numero = `9${numero}`;
  if (numero.length === 9 && !numero.startsWith('9')) return null;
  return `55${ddd}${numero}`;
}

/** "5521999999999" → "(21) 99999-9999", for showing a stored number. */
export function formatarWhatsapp(digitos: string): string {
  const local = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  const ddd = local.slice(0, 2);
  const numero = local.slice(2);
  return `(${ddd}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`;
}

export type AcaoVotacao =
  /**
   * A formando's whole ballot: the options picked on each open question they
   * haven't voted on, by question id — or null for a blank vote.
   */
  | { acao: 'votarTudo'; votos: Record<string, string[] | null> }
  /** `maximo`: how many options each formando picks (1 = just one). `pronta`: leave it to open later. `mesmoAssim`: as in 'abrir'. */
  | { acao: 'criar'; texto: string; tipo: TipoPergunta; opcoes: string[]; maximo: number; pronta: boolean; mesmoAssim?: boolean }
  /**
   * Committee: change a question not closed yet. With votes in, only the
   * text and new options (editar_pergunta in votacao.sql); a new name that
   * someone could pick twice is refused unless `mesmoAssim`.
   */
  | { acao: 'editar'; id: string; texto: string; tipo: TipoPergunta; opcoes: string[]; maximo: number; mesmoAssim?: boolean }
  /**
   * Committee: open a ready question, or every ready one at once so the
   * class votes on them together. Refused when a name is also in a question
   * already voted on (abrir_perguntas in votacao.sql), unless `mesmoAssim`.
   */
  | { acao: 'abrir'; id: string; mesmoAssim?: boolean }
  | { acao: 'abrirProntas'; mesmoAssim?: boolean }
  /** Committee: `duplicar` makes a ready copy right after it on the ballot. */
  | { acao: 'encerrar' | 'liberar' | 'esconder' | 'excluir' | 'duplicar'; id: string }
  /** Committee: the ballot's order, every question's id from first to last. */
  | { acao: 'ordenar'; ids: string[] }
  /** Committee: choose what the class sees of a question's result. */
  | { acao: 'exibir'; id: string; exibicao: Exibicao }
  /** Committee: fill in, fix or (null) clear a formando's number. */
  | { acao: 'definirWhatsapp'; formando: string; whatsapp: string | null }
  /** Committee: tell this phone when everyone has voted (src/lib/avisos.ts); sends a first notification right away. */
  | { acao: 'avisar'; inscricao: PushSubscriptionJSON }
  /** Committee: stop telling this phone, or send it a test notification. */
  | { acao: 'naoAvisar' | 'testarAviso'; endpoint: string };

/**
 * Every read and write goes through the `votacao` Edge Function, which
 * checks the number (or committee code). Pass an `acao` to vote or
 * change something first; the response is always the whole state after it.
 */
export function buscarVotacao(acesso: AcessoVotacao, acao?: AcaoVotacao): Promise<DadosVotacao> {
  return chamarFuncao<DadosVotacao>('votacao', { ...acesso, ...acao });
}
