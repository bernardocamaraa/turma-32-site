/**
 * The print-shop file: every sticker ordered, 6 cm each, laid out on
 * 33 × 46 cm sheets with a 3 cm margin all around, as one PDF (one page per
 * sheet, at the real size). Each different sticker goes into the PDF once
 * and is placed as many times as it was ordered, so the file stays small.
 */
import { pngDoAdesivo, type Enquadramento } from '../components/AdesivoCrianca';
import { lerChave, type Modelo, type Pedido } from './adesivos';
import { adesivoRedondo } from './redondo';

// Everything in millimetres.
export const FOLHA = { largura: 330, altura: 460 };
export const MARGEM = 30;
export const DIAMETRO = 60;
/** The least space between two stickers, for the cut. */
const FOLGA_MINIMA = 4;
/** Pixels across a sticker: 6 cm at 300 dpi. */
const PIXELS = Math.round((DIAMETRO / 25.4) * 300);

const util = { largura: FOLHA.largura - 2 * MARGEM, altura: FOLHA.altura - 2 * MARGEM };
export const COLUNAS = Math.floor((util.largura + FOLGA_MINIMA) / (DIAMETRO + FOLGA_MINIMA));
export const LINHAS = Math.floor((util.altura + FOLGA_MINIMA) / (DIAMETRO + FOLGA_MINIMA));
export const POR_FOLHA = COLUNAS * LINHAS;
// The space left over, spread evenly between the stickers.
const PASSO_X = DIAMETRO + (COLUNAS > 1 ? (util.largura - COLUNAS * DIAMETRO) / (COLUNAS - 1) : 0);
const PASSO_Y = DIAMETRO + (LINHAS > 1 ? (util.altura - LINHAS * DIAMETRO) / (LINHAS - 1) : 0);

/** One different sticker and how many of it. */
export type ItemDaFolha = {
  rotulo: string;
  quantidade: number;
  /** The picture: a 6 cm square on white, as a JPEG data URL. */
  gerar: () => Promise<string>;
  redondo: boolean;
};

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem de um adesivo.'));
    img.src = src;
  });
}

/**
 * A 6 cm square on white with the round sticker in it: the childhood one
 * cut to its circle; any other one already round (redondo.ts).
 */
async function quadrado(src: string, redondo: boolean, pixels = PIXELS): Promise<string> {
  const PIXELS = pixels;
  const img = await carregar(src);
  const canvas = document.createElement('canvas');
  canvas.width = PIXELS;
  canvas.height = PIXELS;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PIXELS, PIXELS);
  if (redondo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(PIXELS / 2, PIXELS / 2, PIXELS / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, PIXELS, PIXELS);
    ctx.restore();
  } else {
    ctx.drawImage(img, 0, 0, PIXELS, PIXELS);
  }
  return canvas.toDataURL('image/jpeg', 0.95);
}

async function deBlob<T>(blob: Blob, usar: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(blob);
  try {
    return await usar(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The different stickers in the orders, in the store's order: the
 * childhood ones one per formando (in the order of the names), each other
 * model once per combination of colours. A childhood sticker with no photo
 * yet can't be printed: it's left out and named in `semFoto`.
 */
export function itensDasFolhas(
  pedidos: Pedido[],
  modelos: Modelo[],
  fotos: Record<string, string>,
  enquadramentos: Record<string, Enquadramento> = {},
): { itens: ItemDaFolha[]; semFoto: string[] } {
  const itens: ItemDaFolha[] = [];
  const semFoto: string[] = [];
  for (const modelo of modelos) {
    if (modelo.crianca) {
      for (const p of [...pedidos].sort((a, b) => a.formando.localeCompare(b.formando))) {
        const q = p.itens[modelo.id] ?? 0;
        if (q <= 0) continue;
        const foto = fotos[p.formando];
        if (!foto) {
          semFoto.push(p.formando);
          continue;
        }
        itens.push({
          rotulo: `${modelo.nome} · ${p.formando}`,
          quantidade: q,
          redondo: true,
          gerar: async () => deBlob(await pngDoAdesivo(foto, p.formando, PIXELS, enquadramentos[p.formando]), (url) => quadrado(url, true)),
        });
      }
      continue;
    }
    if (!modelo.imagem) continue;
    const imagem = modelo.imagem;
    const porChave = new Map<string, number>();
    for (const p of pedidos) {
      for (const [chave, q] of Object.entries(p.itens)) {
        if (q > 0 && lerChave(chave).id === modelo.id) porChave.set(chave, (porChave.get(chave) ?? 0) + q);
      }
    }
    for (const [chave, q] of [...porChave].sort(([a], [b]) => a.localeCompare(b))) {
      const { cores } = lerChave(chave);
      itens.push({
        rotulo: modelo.nome,
        quantidade: q,
        redondo: false,
        gerar: async () => deBlob(await adesivoRedondo(imagem, PIXELS, modelo.camadas, cores), (url) => quadrado(url, false)),
      });
    }
  }
  return { itens, semFoto };
}

export const folhasPara = (adesivos: number) => Math.ceil(adesivos / POR_FOLHA);

/** The PDF of the sheets. `linhaDeCorte`: a thin circle around each sticker, 6 cm across. */
export async function pdfDasFolhas(itens: ItemDaFolha[], opcoes: { linhaDeCorte: boolean; aoAvancar?: (texto: string) => void }): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: [FOLHA.largura, FOLHA.altura], orientation: 'portrait', compress: true });
  const total = itens.reduce((s, i) => s + i.quantidade, 0);
  const folhas = folhasPara(total);
  let posicao = 0;

  const rodape = (folha: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(
      `Turma 32 · Adesivos de ${DIAMETRO / 10} cm · Folha ${folha} de ${folhas} · ${FOLHA.largura / 10} × ${FOLHA.altura / 10} cm, margem de ${MARGEM / 10} cm`,
      MARGEM,
      FOLHA.altura - MARGEM / 2,
    );
  };
  rodape(1);

  for (const [n, item] of itens.entries()) {
    opcoes.aoAvancar?.(`Montando ${n + 1} de ${itens.length}…`);
    const imagem = await item.gerar();
    const apelido = `adesivo-${n}`;
    for (let k = 0; k < item.quantidade; k++) {
      const naFolha = posicao % POR_FOLHA;
      if (posicao > 0 && naFolha === 0) {
        pdf.addPage([FOLHA.largura, FOLHA.altura], 'portrait');
        rodape(posicao / POR_FOLHA + 1);
      }
      const x = MARGEM + (naFolha % COLUNAS) * PASSO_X;
      const y = MARGEM + Math.floor(naFolha / COLUNAS) * PASSO_Y;
      pdf.addImage(imagem, 'JPEG', x, y, DIAMETRO, DIAMETRO, apelido, 'NONE');
      if (opcoes.linhaDeCorte) {
        pdf.setDrawColor(236, 0, 140);
        pdf.setLineWidth(0.15);
        pdf.circle(x + DIAMETRO / 2, y + DIAMETRO / 2, DIAMETRO / 2, 'S');
      }
      posicao++;
    }
  }
  opcoes.aoAvancar?.('Gerando o PDF…');
  return pdf.output('blob');
}

/**
 * The class sheet: every formando's childhood face once, and a few twice,
 * so one sheet has exactly TURMA.porFolha stickers. 5 cm each, 5 × 7 on the
 * same 33 × 46 cm sheet with the 3 cm margin.
 */
export const TURMA = { diametro: 50, colunas: 5, linhas: 7, porFolha: 35 };
/** Who comes twice on every class sheet. */
export const DUAS_VEZES = ['Caio Bezerra', 'Bernardo Câmara', 'Maria Clara Bispo', 'Lívia Whitaker'];

/** The names on one class sheet, in order, each twice-comer right after their first. */
export function nomesDaFolhaDaTurma(formandos: string[]): string[] {
  const nomes: string[] = [];
  for (const f of [...formandos].sort((a, b) => a.localeCompare(b))) {
    nomes.push(f);
    if (DUAS_VEZES.includes(f)) nomes.push(f);
  }
  return nomes;
}

/**
 * The PDF of the class sheet: `folhas` identical pages of TURMA.porFolha faces.
 * Whoever has no childhood photo yet keeps their place on the sheet, empty.
 */
export async function pdfDaFolhaDaTurma(
  formandos: string[],
  fotos: Record<string, string>,
  enquadramentos: Record<string, Enquadramento>,
  opcoes: { folhas: number; linhaDeCorte: boolean; aoAvancar?: (texto: string) => void },
): Promise<Blob> {
  const nomes = nomesDaFolhaDaTurma(formandos);
  if (nomes.length > TURMA.porFolha) throw new Error(`São ${nomes.length} adesivos, mas cabem só ${TURMA.porFolha} na folha.`);

  const { diametro, colunas, linhas } = TURMA;
  const pixels = Math.round((diametro / 25.4) * 300);
  const passoX = diametro + (util.largura - colunas * diametro) / (colunas - 1);
  const passoY = diametro + (util.altura - linhas * diametro) / (linhas - 1);

  const imagens = new Map<string, string>();
  const unicos = [...new Set(nomes)].filter((f) => fotos[f]);
  for (const [i, f] of unicos.entries()) {
    opcoes.aoAvancar?.(`Montando ${i + 1} de ${unicos.length}…`);
    imagens.set(f, await deBlob(await pngDoAdesivo(fotos[f], f, pixels, enquadramentos[f]), (url) => quadrado(url, true, pixels)));
  }

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: [FOLHA.largura, FOLHA.altura], orientation: 'portrait', compress: true });
  for (let folha = 1; folha <= opcoes.folhas; folha++) {
    if (folha > 1) pdf.addPage([FOLHA.largura, FOLHA.altura], 'portrait');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(
      `Turma 32 · Rostos da turma · ${nomes.length} adesivos de ${diametro / 10} cm · Folha ${folha} de ${opcoes.folhas} · ${FOLHA.largura / 10} × ${FOLHA.altura / 10} cm, margem de ${MARGEM / 10} cm`,
      MARGEM,
      FOLHA.altura - MARGEM / 2,
    );
    for (const [n, f] of nomes.entries()) {
      if (!imagens.has(f)) continue;
      const x = MARGEM + (n % colunas) * passoX;
      const y = MARGEM + Math.floor(n / colunas) * passoY;
      pdf.addImage(imagens.get(f)!, 'JPEG', x, y, diametro, diametro, `rosto-${unicos.indexOf(f)}`, 'NONE');
      if (opcoes.linhaDeCorte) {
        pdf.setDrawColor(236, 0, 140);
        pdf.setLineWidth(0.15);
        pdf.circle(x + diametro / 2, y + diametro / 2, diametro / 2, 'S');
      }
    }
  }
  opcoes.aoAvancar?.('Gerando o PDF…');
  return pdf.output('blob');
}
