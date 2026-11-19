import { chamarFuncao } from './supabase';

/**
 * The store of stickers handed out on the night (/adesivos). Each formando
 * enters with their WhatsApp (like the vote and /musica) and picks how many
 * of each model they want. The childhood one is personal: it's made from the
 * formando's own childhood photo, the one the committee collected.
 *
 * To add a model: add it here AND to MODELOS in
 * supabase/functions/adesivos/index.ts (the function refuses unknown ids).
 */
export type Modelo = {
  id: string;
  nome: string;
  sobre: string;
  /** In reais, per sticker. */
  preco: number;
  /** The art (a file in /public). Absent for the childhood sticker, which is drawn from the photo. */
  imagem?: string;
  /** Art that's white on transparent: printed on a dark rounded plate so it shows. */
  placa?: boolean;
  /** Made from the formando's own childhood photo. */
  crianca?: boolean;
};

export const MODELOS: Modelo[] = [
  {
    id: 'crianca',
    nome: 'Você criança',
    sobre: 'O seu adesivo, com a sua foto de criança.',
    preco: 5,
    crianca: true,
  },
  { id: 'logo-32', nome: 'Logo da Turma 32', sobre: 'O 32 da turma, recortado.', preco: 5, imagem: '/assets/logo-32.png' },
  { id: 'terceirao', nome: 'Terceirão', sobre: 'O nome do terceirão, recortado.', preco: 5, imagem: '/assets/logo-terceirao.png' },
  { id: 'assinaturas', nome: 'Assinaturas da turma', sobre: 'A assinatura de todo mundo, num adesivo só.', preco: 5, imagem: '/assets/assinaturas-mural.png', placa: true },
];

/** Most of one model a formando can order — the same as MAXIMO in the function. */
export const MAXIMO_POR_MODELO = 200;

/**
 * Where the payment goes. Empty while the committee hasn't decided: the page
 * then says the committee will tell how to pay.
 */
export const PIX = { chave: '', nome: '' };

export type Itens = Record<string, number>;

export type Pedido = {
  formando: string;
  itens: Itens;
  observacao: string | null;
  pago: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type DadosAdesivos = {
  comissao: boolean;
  /** The formando the WhatsApp belongs to (null for the committee, or for a number not on the list). */
  voce: string | null;
  /** Names with no number yet, for a number not on the list to pick from. */
  livres: string[] | null;
  /** Whether formandos can still order or change their order (the committee always can). */
  aberta: boolean;
  /** The formando's own order. */
  meu: Pedido | null;
  /** A link (valid a day) to the formando's own childhood photo, or null while the committee has none. */
  fotoInfancia: string | null;
  /** Committee only: every order. */
  pedidos: Pedido[] | null;
  /** Committee only: every formando's name. */
  formandos: string[] | null;
  /** Committee only: the childhood photo of each formando who ordered the childhood sticker. */
  fotos: Record<string, string | null> | null;
};

export type AcessoAdesivos = { whatsapp: string; nome?: string } | { codigo: string } | Record<string, never>;

export type AcaoAdesivos =
  /** Sends (or replaces) the order. All zero deletes it. Committee: whose, in `formando`. */
  | { acao: 'pedir'; itens: Itens; observacao?: string; formando?: string }
  /** Committee: the payment arrived (or not). */
  | { acao: 'pago'; formando: string; sim: boolean }
  /** Committee: deletes an order. */
  | { acao: 'apagar'; formando: string }
  /** Committee: opens or closes the store. */
  | { acao: 'aberta'; sim: boolean };

export function buscarAdesivos(acesso: AcessoAdesivos, acao?: AcaoAdesivos): Promise<DadosAdesivos> {
  return chamarFuncao<DadosAdesivos>('adesivos', { ...acesso, ...acao });
}

export function urlDaLoja(): string {
  return `${window.location.origin}/adesivos`;
}

export const modeloPorId = (id: string) => MODELOS.find((m) => m.id === id);

export function totalDoPedido(itens: Itens): number {
  return Object.entries(itens).reduce((s, [id, q]) => s + (modeloPorId(id)?.preco ?? 0) * q, 0);
}

export function quantidadeDoPedido(itens: Itens): number {
  return Object.values(itens).reduce((s, q) => s + q, 0);
}

export const reais = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** The first name, then the last, for the sticker: "Maria Clara Bispo" → "Maria Clara", "Bernardo Câmara" → "Bernardo". */
export function nomeNoAdesivo(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  // Two-word first names the class goes by.
  if (partes.length >= 3 && ['Maria', 'Anna', 'João'].includes(partes[0])) return `${partes[0]} ${partes[1]}`;
  return partes[0] ?? nome;
}
