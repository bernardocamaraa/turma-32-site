import { chamarFuncao } from './supabase';
import type { AcessoMesas } from './mesas';

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
  /** The formando a personal link belongs to (null for the committee). */
  voce: string | null;
  formandos: string[];
  perguntas: Pergunta[];
};

export type AcaoVotacao =
  | { acao: 'votar'; id: string; opcao: string }
  | { acao: 'criar'; texto: string; tipo: TipoPergunta; opcoes: string[] }
  | { acao: 'encerrar' | 'liberar' | 'esconder' | 'excluir'; id: string };

/**
 * Every read and write goes through the `votacao` Edge Function, with the
 * same personal link (or committee code) as the table map. Pass an `acao` to
 * vote or change something first; the response is always the whole state
 * after it.
 */
export function buscarVotacao(acesso: AcessoMesas, acao?: AcaoVotacao): Promise<DadosVotacao> {
  return chamarFuncao<DadosVotacao>('votacao', { ...acesso, ...acao });
}
