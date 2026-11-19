import { chamarFuncao, supabase } from './supabase';

/**
 * The store of stickers handed out on the night (/adesivos). Each formando
 * enters with their WhatsApp (like the vote and /musica) and picks how many
 * of each model they want. The models are put on sale by the committee
 * (a picture, a name, a price — tab "Adesivos"). The childhood one is
 * personal: each formando's own childhood photo in the committee's frame.
 */
export type Modelo = {
  id: string;
  nome: string;
  descricao: string | null;
  /** In reais, per sticker. */
  preco: number;
  /** The picture's public URL; null for the childhood sticker. */
  imagem: string | null;
  crianca: boolean;
  /** Hidden ones only show to the committee (and in an order that already had them). */
  ativo: boolean;
};

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
  /** The models, in the store's order. */
  modelos: Modelo[];
  /** The formando's own order. */
  meu: Pedido | null;
  /** A link (valid a day) to the formando's own childhood photo, or null while the committee has none. */
  fotoInfancia: string | null;
  /** Committee only: every order. */
  pedidos: Pedido[] | null;
  /** Committee only: every formando's name. */
  formandos: string[] | null;
  /** Committee only: each formando's childhood photo (those who have one). */
  fotos: Record<string, string> | null;
};

export type AcessoAdesivos = { whatsapp: string; nome?: string } | { codigo: string } | Record<string, never>;

export type ModeloParaSalvar = { id?: string; nome: string; descricao: string; preco: number; ativo: boolean; imagem?: string };

export type AcaoAdesivos =
  /** Sends (or replaces) the order. All zero deletes it. Committee: whose, in `formando`. */
  | { acao: 'pedir'; itens: Itens; observacao?: string; formando?: string }
  /** Committee: the payment arrived (or not). */
  | { acao: 'pago'; formando: string; sim: boolean }
  /** Committee: deletes an order. */
  | { acao: 'apagar'; formando: string }
  /** Committee: opens or closes the store. */
  | { acao: 'aberta'; sim: boolean }
  /** Committee: creates (no id) or changes a model. */
  | { acao: 'salvarModelo'; modelo: ModeloParaSalvar }
  | { acao: 'moverModelo'; id: string; direcao: -1 | 1 }
  | { acao: 'apagarModelo'; id: string };

export async function buscarAdesivos(acesso: AcessoAdesivos, acao?: AcaoAdesivos): Promise<DadosAdesivos> {
  const dados = await chamarFuncao<DadosAdesivos>('adesivos', { ...acesso, ...acao });
  return { ...dados, modelos: dados.modelos ?? [] };
}

const TIPOS: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

/** Committee: sends a sticker's picture; the path to save the model with. */
export async function enviarImagemAdesivo(codigo: string, arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error(`"${arquivo.name}" não é uma imagem.`);
  if (arquivo.size > 10 * 1024 * 1024) throw new Error(`"${arquivo.name}" passa de 10MB.`);
  const extensao =
    Object.entries(TIPOS).find(([, t]) => t === arquivo.type)?.[0] ??
    (arquivo.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const { caminho, token } = await chamarFuncao<{ caminho: string; token: string }>('adesivos', { codigo, acao: 'prepararImagem', extensao });
  const { error } = await supabase.storage.from('adesivos').uploadToSignedUrl(caminho, token, arquivo, { contentType: arquivo.type });
  if (error) throw new Error(`Não foi possível enviar "${arquivo.name}" agora.`);
  return caminho;
}

export function urlDaLoja(): string {
  return `${window.location.origin}/adesivos`;
}

export function totalDoPedido(itens: Itens, modelos: Modelo[]): number {
  return Object.entries(itens).reduce((s, [id, q]) => s + (modelos.find((m) => m.id === id)?.preco ?? 0) * q, 0);
}

export function quantidadeDoPedido(itens: Itens): number {
  return Object.values(itens).reduce((s, q) => s + q, 0);
}

export const reais = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "bernardo-camara", for file names. */
export const slugDoNome = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
