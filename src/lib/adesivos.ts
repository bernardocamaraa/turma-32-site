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
  /** The formando picks the colour of the picture's coloured part (corDoAdesivo). */
  personalizavel: boolean;
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

export type ModeloParaSalvar = { id?: string; nome: string; descricao: string; preco: number; ativo: boolean; personalizavel: boolean; imagem?: string };

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

/**
 * An order's key: the model's id, or "<id>@#rrggbb" for a custom-colour
 * model — one key per colour, each with its own quantity.
 */
export function lerChave(chave: string): { id: string; cor: string | null } {
  const [id, cor] = chave.split('@');
  return { id, cor: cor ?? null };
}

export const chaveDe = (id: string, cor: string | null) => (cor ? `${id}@${cor.toLowerCase()}` : id);

export function totalDoPedido(itens: Itens, modelos: Modelo[]): number {
  return Object.entries(itens).reduce((s, [chave, q]) => s + (modelos.find((m) => m.id === lerChave(chave).id)?.preco ?? 0) * q, 0);
}

/** "2× Logo da Turma 32 (Vermelho)". */
export function descreverItem(chave: string, q: number, modelos: Modelo[]): string {
  const { id, cor } = lerChave(chave);
  const nome = modelos.find((m) => m.id === id)?.nome ?? 'adesivo apagado';
  return `${q}× ${nome}${cor ? ` (${nomeDaCor(cor)})` : ''}`;
}

/** The colours offered for a custom-colour sticker (any other can be picked too). */
export const CORES: { nome: string; cor: string }[] = [
  { nome: 'Azul-claro', cor: '#a9d3e8' },
  { nome: 'Azul', cor: '#2f6fd6' },
  { nome: 'Vermelho', cor: '#e0262b' },
  { nome: 'Rosa', cor: '#ff5fa2' },
  { nome: 'Roxo', cor: '#8a4fe0' },
  { nome: 'Verde', cor: '#22b05a' },
  { nome: 'Amarelo', cor: '#ffd21f' },
  { nome: 'Laranja', cor: '#ff7a00' },
  { nome: 'Dourado', cor: '#c9a33a' },
  { nome: 'Cinza', cor: '#9a9a9a' },
];

export const nomeDaCor = (cor: string) => CORES.find((c) => c.cor === cor.toLowerCase())?.nome ?? cor.toUpperCase();

function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [canal(h + 1 / 3), canal(h), canal(h - 1 / 3)];
}

const pintados = new Map<string, Promise<Blob>>();

/**
 * The picture with its coloured part (the pixels with colour: the 32's blue
 * shadow) in `cor` — black, white and greys stay as they are. The shading
 * is kept: each pixel's lightness moves by as much as the colour's differs
 * from the coloured part's average. Full size, as a PNG (for the page and
 * for the print shop).
 */
export function corDoAdesivo(imagem: string, cor: string): Promise<Blob> {
  const chave = `${imagem}|${cor}`;
  if (!pintados.has(chave)) {
    const feito = (async () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Não foi possível carregar a imagem do adesivo.'));
        img.src = imagem;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = dados.data;
      const [th, ts, tl] = hsl(parseInt(cor.slice(1, 3), 16) / 255, parseInt(cor.slice(3, 5), 16) / 255, parseInt(cor.slice(5, 7), 16) / 255);
      const coloridos: number[] = [];
      let soma = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 10) continue;
        const [, s, l] = hsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
        if (s > 0.2 && l > 0.12 && l < 0.93) {
          coloridos.push(i);
          soma += l;
        }
      }
      const media = coloridos.length ? soma / coloridos.length : 0;
      for (const i of coloridos) {
        const [, , l] = hsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
        const [r, g, b] = rgb(th, ts, Math.min(1, Math.max(0, l - media + tl)));
        px[i] = Math.round(r * 255);
        px[i + 1] = Math.round(g * 255);
        px[i + 2] = Math.round(b * 255);
      }
      ctx.putImageData(dados, 0, 0);
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível pintar o adesivo.'))), 'image/png'),
      );
    })();
    feito.catch(() => pintados.delete(chave));
    pintados.set(chave, feito);
  }
  return pintados.get(chave)!;
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
