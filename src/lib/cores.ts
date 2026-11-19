/**
 * The colours of a sticker: which parts of a picture can take another
 * colour (its "camadas" — a coloured part like the 32's blue shadow, the
 * black, the white), a suggestion of which ones look good changed, and the
 * picture painted with the colours a formando picked.
 *
 * Everything runs in the browser, on the picture's pixels: no editing
 * program needed, the committee just uploads the picture.
 */

/** A part of the picture the formando can recolour. */
export type Camada = {
  /** 'matiz': the pixels of one colour (a range of hues); 'escuro': the black; 'claro': the white. */
  tipo: 'matiz' | 'escuro' | 'claro';
  /** What the formando reads: "Sombra", "Preenchimento"… */
  nome: string;
  /** The part's colour as it is in the picture (#rrggbb). */
  cor: string;
  /** For 'matiz': the hues it covers, in degrees (h0 > h1 wraps through red). */
  h0?: number;
  h1?: number;
};

/** A part found in the picture, and whether it's worth offering. */
export type CamadaSugerida = Camada & {
  /** Share of the sticker's visible area, 0–1. */
  parte: number;
  sugerida: boolean;
  /** Why (not) — for the committee. */
  motivo: string;
};

export type Analise = { camadas: CamadaSugerida[]; resumo: string };

/** The colours offered (any other can be picked too). */
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
  { nome: 'Prata', cor: '#9a9a9a' },
  { nome: 'Preto', cor: '#111111' },
  { nome: 'Branco', cor: '#ffffff' },
];

export function nomeDaCor(cor: string, camada?: Camada): string {
  const c = cor.toLowerCase();
  if (camada && c === camada.cor.toLowerCase()) return 'original';
  return CORES.find((x) => x.cor === c)?.nome ?? c.toUpperCase();
}

// ---------------------------------------------------------------------------

export function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function rgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
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

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const limitar = (v: number) => Math.max(0, Math.min(1, v));
const dentroDoMatiz = (h: number, h0: number, h1: number) => (h0 <= h1 ? h >= h0 && h <= h1 : h >= h0 || h <= h1);

/** How much a pixel belongs to a part, 0–1 (soft at the edges, so the borders blend). */
function peso(c: Camada, h: number, s: number, l: number): number {
  if (c.tipo === 'matiz') {
    if (l < 0.08 || l > 0.95 || !dentroDoMatiz(h, c.h0 ?? 0, c.h1 ?? 360)) return 0;
    return limitar((s - 0.1) / 0.15);
  }
  if (c.tipo === 'escuro') return s < 0.4 ? limitar((0.42 - l) / 0.22) : 0;
  return s < 0.3 ? limitar((l - 0.62) / 0.2) : 0;
}

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem do adesivo.'));
    img.src = src;
  });
}

/** The picture's pixels, at most `lado` on the longest side. */
async function pixels(src: string, lado = Infinity) {
  const img = await carregar(src);
  const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx, dados: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

/** The name of a hue, for a coloured part. */
function nomeDoMatiz(h: number, l: number): string {
  if (h >= 345 || h < 15) return 'vermelha';
  if (h < 40) return 'laranja';
  if (h < 70) return 'amarela';
  if (h < 165) return 'verde';
  if (h < 250) return l > 0.62 ? 'azul-clara' : 'azul';
  if (h < 290) return 'roxa';
  return 'rosa';
}

/**
 * Looks at a picture and finds the parts that could take another colour:
 * each colour that covers a good share of it, the black and the white. Then
 * suggests which to offer: the coloured parts and a large black fill look
 * good recoloured; the white is usually the sticker's border; and a photo
 * (colours everywhere) doesn't recolour well at all.
 */
export async function analisarCores(src: string): Promise<Analise> {
  const { dados } = await pixels(src, 360);
  const px = dados.data;
  let visiveis = 0;
  let escuros = 0;
  let claros = 0;
  const somaEscuro = [0, 0, 0];
  const bins = new Array(36).fill(0);
  const somaBin = Array.from({ length: 36 }, () => [0, 0, 0, 0]); // r, g, b, l
  // How the pixels spread over (coarse) colours: a drawing sits on a few, a photo on hundreds.
  const tons = new Map<number, number>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    visiveis++;
    const tom = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    tons.set(tom, (tons.get(tom) ?? 0) + 1);
    const [h, s, l] = hsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    if (s < 0.35 && l < 0.25) {
      escuros++;
      somaEscuro[0] += px[i];
      somaEscuro[1] += px[i + 1];
      somaEscuro[2] += px[i + 2];
    } else if (s < 0.25 && l > 0.85) claros++;
    else if (s > 0.25 && l > 0.12 && l < 0.93) {
      const b = Math.floor(h / 10) % 36;
      bins[b]++;
      somaBin[b][0] += px[i];
      somaBin[b][1] += px[i + 1];
      somaBin[b][2] += px[i + 2];
      somaBin[b][3] += l;
    }
  }
  if (visiveis === 0) return { camadas: [], resumo: 'A imagem parece vazia.' };

  // Runs of neighbouring hue bins, each one colour of the picture.
  const minimo = visiveis * 0.004;
  const grupos: number[][] = [];
  let atual: number[] = [];
  for (let k = 0; k < 36; k++) {
    if (bins[k] > minimo) atual.push(k);
    else if (atual.length) {
      grupos.push(atual);
      atual = [];
    }
  }
  if (atual.length) {
    // Red wraps around: a run reaching 360° joins one starting at 0°.
    if (grupos.length && grupos[0][0] === 0 && atual[atual.length - 1] === 35) grupos[0] = [...atual, ...grupos[0]];
    else grupos.push(atual);
  }
  const coloridas = grupos
    .map((g) => {
      const n = g.reduce((s, k) => s + bins[k], 0);
      const soma = g.reduce((s, k) => [s[0] + somaBin[k][0], s[1] + somaBin[k][1], s[2] + somaBin[k][2], s[3] + somaBin[k][3]], [0, 0, 0, 0]);
      return {
        n,
        parte: n / visiveis,
        h0: ((g[0] * 10 - 10) % 360 + 360) % 360,
        h1: (g[g.length - 1] * 10 + 20) % 360,
        largura: g.length,
        cor: hex(soma[0] / n, soma[1] / n, soma[2] / n),
        l: soma[3] / n,
        meio: hsl(soma[0] / n / 255, soma[1] / n / 255, soma[2] / n / 255)[0],
      };
    })
    .filter((g) => g.parte >= 0.02)
    .sort((a, b) => b.n - a.n);

  const totalColorido = coloridas.reduce((s, g) => s + g.parte, 0);
  // A photo: the 16 commonest colours cover less than half of it (a drawing: well over half),
  // or one colour spread over most of the hue circle.
  const nosPrincipais = [...tons.values()].sort((a, b) => b - a).slice(0, 16).reduce((s, n) => s + n, 0) / visiveis;
  const foto = nosPrincipais < 0.5 || coloridas.some((g) => g.largura > 12) || (totalColorido > 0.55 && coloridas.length > 3);
  const pct = (p: number) => `${Math.round(p * 100)}%`;

  const camadas: CamadaSugerida[] = [];
  for (const g of coloridas.slice(0, 3)) {
    const nomeCor = nomeDoMatiz(g.meio, g.l);
    camadas.push({
      tipo: 'matiz',
      nome: `Parte ${nomeCor}`,
      cor: g.cor,
      h0: g.h0,
      h1: g.h1,
      parte: g.parte,
      sugerida: !foto && g.parte >= 0.05,
      motivo: foto
        ? 'A imagem parece uma foto: trocar uma cor dela não costuma ficar bom.'
        : g.parte < 0.05
          ? `Um detalhe pequeno (${pct(g.parte)} do adesivo): dá para trocar, mas quase não aparece.`
          : `Uma cor só, ${pct(g.parte)} do adesivo: fica bom em qualquer cor.`,
    });
  }
  // A big coloured part to change already (the sticker's background colour): then the black is the outlines and shadows.
  const corDeFundo = coloridas.some((g) => g.parte >= 0.3);
  if (escuros / visiveis >= 0.03) {
    const n = escuros;
    const grande = escuros / visiveis >= 0.08 && !corDeFundo;
    camadas.push({
      tipo: 'escuro',
      nome: 'Parte preta',
      cor: hex(somaEscuro[0] / n, somaEscuro[1] / n, somaEscuro[2] / n),
      parte: escuros / visiveis,
      sugerida: grande && !foto,
      motivo: foto
        ? 'A imagem parece uma foto: trocar o preto dela não costuma ficar bom.'
        : corDeFundo
          ? `${pct(escuros / visiveis)} do adesivo, mas aqui o preto é contorno e sombra: trocar tira a força do desenho.`
          : grande
          ? `Preenchimento preto, ${pct(escuros / visiveis)} do adesivo: em cor, ele muda a cara do adesivo.`
          : `Pouco preto (${pct(escuros / visiveis)}), quase só contornos: trocar faz pouca diferença.`,
    });
  }
  if (claros / visiveis >= 0.03) {
    camadas.push({
      tipo: 'claro',
      nome: 'Parte branca',
      cor: '#ffffff',
      parte: claros / visiveis,
      sugerida: false,
      motivo: `${pct(claros / visiveis)} do adesivo. O branco costuma ser a borda do adesivo: dá para trocar, mas não é o mais comum.`,
    });
  }

  // A part covering nearly all of it is the picture's background, not a part of the sticker.
  for (const c of camadas) {
    if (c.parte > 0.6) {
      c.sugerida = false;
      c.motivo = `Ocupa ${pct(c.parte)} da imagem: parece o fundo, não uma parte do adesivo.`;
    }
  }
  const sugeridas = camadas.filter((c) => c.sugerida);
  const resumo = foto
    ? 'Essa imagem parece uma foto, com cores por todo lado. Trocar a cor dela não costuma ficar bom, então a sugestão é vender só como está.'
    : sugeridas.length === 0
      ? 'Não achei nenhuma parte que fique bem em outra cor. A sugestão é vender só como está.'
      : `Achei ${sugeridas.length === 1 ? 'uma parte que fica legal' : `${sugeridas.length} partes que ficam legais`} com outra cor: ${sugeridas
          .map((c) => c.nome.toLowerCase())
          .join(' e ')}. Sugestão: deixar a turma escolher.`;
  return { camadas, resumo };
}

// ---------------------------------------------------------------------------

const pintados = new Map<string, Promise<Blob>>();

/**
 * The picture with each part in its colour (`cores[i]` for `camadas[i]`).
 * The shading is kept: each pixel's lightness moves by as much as the new
 * colour's differs from the part's average. Full size, as a PNG.
 */
export function pintar(src: string, camadas: Camada[], cores: string[]): Promise<Blob> {
  const chave = `${src}|${JSON.stringify(camadas)}|${cores.join()}`;
  if (!pintados.has(chave)) {
    const feito = (async () => {
      const { canvas, ctx, dados } = await pixels(src);
      const px = dados.data;
      const alvos = cores.map((c) => hsl(parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255));
      // Which part each pixel is in (the first that takes it), and how much.
      const parte = new Int8Array(px.length / 4).fill(-1);
      const quanto = new Float32Array(px.length / 4);
      const soma = camadas.map(() => [0, 0]);
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        if (px[i + 3] < 5) continue;
        const [h, s, l] = hsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
        for (let k = 0; k < camadas.length; k++) {
          const w = peso(camadas[k], h, s, l);
          if (w > 0) {
            parte[p] = k;
            quanto[p] = w;
            if (w > 0.5) {
              soma[k][0] += l;
              soma[k][1]++;
            }
            break;
          }
        }
      }
      const media = soma.map(([s, n]) => (n ? s / n : 0.5));
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        const k = parte[p];
        if (k < 0 || !cores[k] || cores[k].toLowerCase() === camadas[k].cor.toLowerCase()) continue;
        const [, , l] = hsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
        const [th, ts, tl] = alvos[k];
        const [r, g, b] = rgb(th, ts, limitar(l - media[k] + tl));
        const w = quanto[p];
        px[i] = px[i] * (1 - w) + r * 255 * w;
        px[i + 1] = px[i + 1] * (1 - w) + g * 255 * w;
        px[i + 2] = px[i + 2] * (1 - w) + b * 255 * w;
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
