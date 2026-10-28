import { chamarFuncao, supabase } from './supabase';

export type FotoInfancia = {
  caminho: string;
  /** Signed link to the file, valid for a day. */
  url: string;
  tamanho: number | null;
  criadoEm: string;
};

export type FormandoInfancia = { formando: string; fotos: FotoInfancia[] };

export type DadosInfancia = { formandos: FormandoInfancia[] };

const BUCKET = 'fotos-infancia';

/** Same as the bucket's file_size_limit in infancia.sql. */
export const TAMANHO_MAXIMO = 25 * 1024 * 1024;

// Some browsers hand over an iPhone photo (.heic) with no type at all, and
// the bucket only takes images — so the type is filled in from the name.
const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
};

function extensaoDe(arquivo: File): string {
  const pelaParte = arquivo.name.includes('.') ? arquivo.name.split('.').pop()!.toLowerCase() : '';
  if (/^[a-z0-9]{1,5}$/.test(pelaParte)) return pelaParte;
  const peloTipo = Object.entries(TIPOS).find(([, tipo]) => tipo === arquivo.type)?.[0];
  return peloTipo ?? 'jpg';
}

/** Why this file can't go up, or null if it can. */
export function problemaNoArquivo(arquivo: File): string | null {
  if (!arquivo.type.startsWith('image/') && !TIPOS[extensaoDe(arquivo)]) return `"${arquivo.name}" não é uma foto.`;
  if (arquivo.size > TAMANHO_MAXIMO) return `"${arquivo.name}" passa de 25MB.`;
  return null;
}

/** A photo that came without a file name (pasted, or dragged from a page): named after its type. */
function semNome(imagem: Blob, nome = 'foto'): File {
  const extensao = Object.entries(TIPOS).find(([, tipo]) => tipo === imagem.type)?.[0] ?? 'jpg';
  return new File([imagem], `${nome}.${extensao}`, { type: imagem.type || 'image/jpeg' });
}

const SO_COPIANDO =
  'Essa foto não veio arrastando. No WhatsApp, clique com o botão direito na foto, em "Copiar imagem", e depois em "Colar" aqui.';

/**
 * The photos dropped on a formando's card: files from the computer (or the
 * WhatsApp app), or an image dragged from another page. A page's image only
 * comes when the browser hands it over or its address can be read; WhatsApp
 * Web's can't, so then the message says to copy and paste instead.
 */
export async function arquivosArrastados(dados: DataTransfer): Promise<File[]> {
  const arquivos = [
    ...Array.from(dados.files),
    ...Array.from(dados.items)
      .filter((i) => i.kind === 'file')
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null),
  ];
  // The same file can show up both in `files` and in `items`.
  const unicos = arquivos.filter((f, i) => arquivos.findIndex((g) => g.name === f.name && g.size === f.size) === i);
  if (unicos.length > 0) return unicos;

  const endereco =
    dados.getData('text/uri-list').split('\n').find((l) => l && !l.startsWith('#')) ||
    /<img[^>]+src="([^"]+)"/.exec(dados.getData('text/html'))?.[1];
  if (!endereco) throw new Error(SO_COPIANDO);
  try {
    const resposta = await fetch(endereco.trim());
    const imagem = await resposta.blob();
    if (!resposta.ok || !imagem.type.startsWith('image/')) throw new Error();
    return [semNome(imagem)];
  } catch {
    throw new Error(SO_COPIANDO);
  }
}

/** The photos in a paste (Ctrl+V / Cmd+V). */
export function arquivosColados(dados: DataTransfer): File[] {
  return Array.from(dados.files).filter((f) => f.type.startsWith('image/') || f.name.includes('.'));
}

/**
 * Reads a copied photo straight from the clipboard, for the "Colar" button
 * (the browser asks for permission the first time).
 */
export async function colarDaAreaDeTransferencia(): Promise<File[]> {
  if (!navigator.clipboard?.read) throw new Error('Este navegador não deixa colar pelo botão. Clique no cartão e aperte Ctrl+V (ou Cmd+V no Mac).');
  let itens: ClipboardItems;
  try {
    itens = await navigator.clipboard.read();
  } catch {
    throw new Error('O navegador não deixou ler a foto copiada. Clique no cartão e aperte Ctrl+V (ou Cmd+V no Mac).');
  }
  const fotos: File[] = [];
  for (const item of itens) {
    const tipo = item.types.find((t) => t.startsWith('image/'));
    if (tipo) fotos.push(semNome(await item.getType(tipo), 'foto colada'));
  }
  if (fotos.length === 0) throw new Error('Não tem nenhuma foto copiada. Copie a foto primeiro (no WhatsApp: botão direito, "Copiar imagem").');
  return fotos;
}

/**
 * Every read and delete goes through the `infancia` Edge Function, which
 * checks the committee code. The response is always the whole list.
 */
export function buscarInfancia(codigo: string, excluir?: string): Promise<DadosInfancia> {
  return chamarFuncao<DadosInfancia>('infancia', excluir ? { codigo, acao: 'excluir', caminho: excluir } : { codigo });
}

/**
 * The function hands out a signed upload URL for this formando's folder, and
 * the file goes from the browser straight to Storage with it.
 */
export async function enviarFotoInfancia(codigo: string, formando: string, arquivo: File): Promise<void> {
  const extensao = extensaoDe(arquivo);
  const { caminho, token } = await chamarFuncao<{ caminho: string; token: string }>('infancia', {
    codigo,
    acao: 'prepararEnvio',
    formando,
    extensao,
  });
  const corpo = arquivo.type ? arquivo : new Blob([arquivo], { type: TIPOS[extensao] ?? 'image/jpeg' });
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(caminho, token, corpo);
  if (error) {
    const mensagem = error.message.toLowerCase();
    if (mensagem.includes('size')) throw new Error(`"${arquivo.name}" passa de 25MB.`);
    if (mensagem.includes('mime')) throw new Error(`"${arquivo.name}" não é uma foto.`);
    throw new Error(`Não foi possível enviar "${arquivo.name}" agora.`);
  }
}

/** "Bernardo Câmara.jpg", or "Bernardo Câmara 2.jpg" when the formando has more than one. */
export function nomeDaFoto(formando: string, fotos: FotoInfancia[], indice: number): string {
  const extensao = fotos[indice].caminho.split('.').pop();
  return fotos.length > 1 ? `${formando} ${indice + 1}.${extensao}` : `${formando}.${extensao}`;
}

/** The signed link, but the browser saves the file under `nome` instead of opening it. */
export function linkParaBaixar(foto: FotoInfancia, nome: string): string {
  return `${foto.url}&download=${encodeURIComponent(nome)}`;
}

/**
 * Every photo in one .zip, each named after its formando. Photos are already
 * compressed, so they're stored as they are, one at a time, without holding
 * two copies of everything.
 */
export async function zipDasFotos(formandos: FormandoInfancia[], aoAvancar: (feitas: number, total: number) => void): Promise<Blob> {
  // Only whoever downloads needs the zip code, so it isn't in every visitor's bundle.
  const { Zip, ZipPassThrough } = await import('fflate');
  const fotos = formandos.flatMap((f) => f.fotos.map((foto, i) => ({ foto, nome: nomeDaFoto(f.formando, f.fotos, i) })));
  const partes: Uint8Array[] = [];
  let pronto!: (zip: Blob) => void;
  let falhou!: (erro: Error) => void;
  const resultado = new Promise<Blob>((resolve, reject) => {
    pronto = resolve;
    falhou = reject;
  });
  const zip = new Zip((erro, parte, fim) => {
    if (erro) return falhou(erro);
    partes.push(parte);
    if (fim) pronto(new Blob(partes as BlobPart[], { type: 'application/zip' }));
  });

  for (const [i, { foto, nome }] of fotos.entries()) {
    aoAvancar(i, fotos.length);
    const resposta = await fetch(foto.url);
    if (!resposta.ok) throw new Error(`Não foi possível baixar "${nome}". Recarregue a página e tente de novo.`);
    const entrada = new ZipPassThrough(nome);
    entrada.mtime = new Date(foto.criadoEm);
    zip.add(entrada);
    entrada.push(new Uint8Array(await resposta.arrayBuffer()), true);
  }
  zip.end();
  aoAvancar(fotos.length, fotos.length);
  return resultado;
}
