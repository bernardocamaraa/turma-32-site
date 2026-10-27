import { chamarFuncao } from './supabase';

export type TipoPergunta = 'formandos' | 'opcoes';

export type Resultado = { opcao: string; votos: number };

export type Pergunta = {
  id: string;
  pergunta: string;
  /** 'formandos': the options are the class itself; 'opcoes': written by the committee. */
  tipo: TipoPergunta;
  opcoes: string[];
  /** Still accepting votes. Closing is final. */
  aberta: boolean;
  /** The class can see the result. */
  resultadoLiberado: boolean;
  /** Whether the formando asking already voted on it (always false for the committee). */
  jaVotou: boolean;
  /** How many voted — sent to the committee always, to formandos with the result. */
  votaram: number | null;
  /** Who hasn't voted yet — committee only. */
  faltam: string[] | null;
  /** Votes per option, most voted first — once released, or to the committee once closed. */
  resultado: Resultado[] | null;
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
  perguntas: Pergunta[];
};

/**
 * Who's asking: nobody yet, a formando by their WhatsApp number (digits with
 * country code) — plus the name they picked, when the number isn't on the
 * list yet — or the committee by its code.
 */
export type AcessoVotacao = Record<string, never> | { whatsapp: string; nome?: string } | { codigo: string };

/** The one link the whole class votes through. */
export function urlDaVotacao(): string {
  return `${window.location.origin}/votacao`;
}

/**
 * A WhatsApp number as typed ("(21) 99999-9999", "21999999999",
 * "+55 21 …") as digits with Brazil's country code, or null if it doesn't
 * look like a number with area code.
 */
export function normalizarWhatsapp(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

/** "5521999999999" → "(21) 99999-9999", for showing a stored number. */
export function formatarWhatsapp(digitos: string): string {
  const local = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  const ddd = local.slice(0, 2);
  const numero = local.slice(2);
  return `(${ddd}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`;
}

export type AcaoVotacao =
  | { acao: 'votar'; id: string; opcao: string }
  | { acao: 'criar'; texto: string; tipo: TipoPergunta; opcoes: string[] }
  | { acao: 'encerrar' | 'liberar' | 'esconder' | 'excluir'; id: string }
  /** Committee: fill in, fix or (null) clear a formando's number. */
  | { acao: 'definirWhatsapp'; formando: string; whatsapp: string | null };

/**
 * Every read and write goes through the `votacao` Edge Function, which
 * checks the number (or committee code). Pass an `acao` to vote or
 * change something first; the response is always the whole state after it.
 */
export function buscarVotacao(acesso: AcessoVotacao, acao?: AcaoVotacao): Promise<DadosVotacao> {
  return chamarFuncao<DadosVotacao>('votacao', { ...acesso, ...acao });
}
