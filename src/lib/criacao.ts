/**
 * "Crie seu adesivo": a sticker a formando designs themselves, in the editor
 * (components/EditorAdesivo.tsx). The design is plain data (a background, a
 * border and a list of elements — their childhood photo, the 32, their
 * signature, texts, shapes), drawn by one function, `desenhar`, both on the
 * editor's screen and into the print file — so what they see is what gets
 * printed. Everything is in the sticker's own pixels: 1181 across (6 cm),
 * like the childhood sticker's model; the sticker is the circle inside.
 */
import { enquadramentoPadrao, recorte } from '../components/AdesivoCrianca';
import { ARCO_IRIS, FAIXAS_ARCO_IRIS, pintar, type Camada } from './cores';

export const LADO = 1181;
const C = LADO / 2;

export type Fundo = { tipo: 'cor' | 'degrade' | 'arcoiris' | 'muro'; cor1: string; cor2: string };

type Base = { id: string; x: number; y: number; escala: number; giro: number };

export type Elemento =
  | (Base & { tipo: 'foto'; formato: 'circulo' | 'quadrado'; borda: string; larguraBorda: number })
  | (Base & { tipo: 'logo'; variante: 'grafite' | 'liso'; cores: [string, string] | null })
  | (Base & { tipo: 'assinatura'; cor: string })
  /** `curva`: the arc the text follows, in degrees (0: straight; > 0 bends like the top of a circle, < 0 like the bottom). */
  | (Base & { tipo: 'texto'; conteudo: string; fonte: Fonte; cor: string; contorno: string | null; larguraContorno: number; curva: number })
  | (Base & { tipo: 'forma'; forma: Forma; cor: string; contorno: string | null });

export type Design = { v: 1; fundo: Fundo; borda: { cor: string; largura: number }; elementos: Elemento[] };

/**
 * The fonts to pick from, each a different feel: the childhood sticker's
 * slab (the default), a clean bold one, a tall poster one, graffiti marker,
 * comic, rounded, handwritten, brush script, and a condensed one.
 */
export const FONTES = ['Roboto Slab', 'Inter', 'Bebas Neue', 'Permanent Marker', 'Bangers', 'Fredoka', 'Caveat', 'Pacifico', 'Anton'] as const;
export type Fonte = (typeof FONTES)[number];
/** How each font is asked for (the weight it's loaded in). */
const PESO: Record<Fonte, number> = {
  'Roboto Slab': 900,
  Inter: 800,
  'Bebas Neue': 400,
  'Permanent Marker': 400,
  Bangers: 400,
  Fredoka: 700,
  Caveat: 700,
  Pacifico: 400,
  Anton: 400,
};
export const pesoDaFonte = (f: Fonte) => PESO[f];

export const FORMAS = ['estrela', 'estrela6', 'coracao', 'coroa', 'raio', 'brilho', 'circulo'] as const;
export type Forma = (typeof FORMAS)[number];
export const NOME_DA_FORMA: Record<Forma, string> = {
  estrela: 'Estrela',
  estrela6: 'Estrela da turma',
  coracao: 'Coração',
  coroa: 'Coroa',
  raio: 'Raio',
  brilho: 'Brilho',
  circulo: 'Círculo',
};

/** The 32's colourable parts (the same as the "Logo da Turma 32" sticker's). */
const CAMADAS_LOGO: Record<'grafite' | 'liso', Camada[]> = {
  grafite: [
    { tipo: 'matiz', nome: 'Sombra', cor: '#559ecb', h0: 180, h1: 230 },
    { tipo: 'escuro', nome: 'Preenchimento', cor: '#050607' },
  ],
  liso: [
    { tipo: 'matiz', nome: 'Sombra', cor: '#6dc4f1', h0: 180, h1: 230 },
    { tipo: 'escuro', nome: 'Preenchimento', cor: '#000000' },
  ],
};
export const coresOriginaisDoLogo = (v: 'grafite' | 'liso'): [string, string] => [CAMADAS_LOGO[v][0].cor, CAMADAS_LOGO[v][1].cor];
const ARQUIVO_LOGO = { grafite: '/assets/logo-32.png', liso: '/assets/logo-32-liso.png' };

let contador = 0;
export const novoId = () => `e${Date.now().toString(36)}${(contador++).toString(36)}`;

// ---------------------------------------------------------------------------
// The pictures a design needs, loaded once and kept.

export type Recursos = {
  /** The formando's childhood photo (a link valid a day), or null. */
  foto: string | null;
  /** Their signature's file, or null. */
  assinatura: string | null;
};

const imagens = new Map<string, Promise<CanvasImageSource>>();

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar uma imagem do adesivo.'));
    img.src = src;
  });
}

function guardada(chave: string, fazer: () => Promise<CanvasImageSource>): Promise<CanvasImageSource> {
  if (!imagens.has(chave)) {
    const p = fazer();
    p.catch(() => imagens.delete(chave));
    imagens.set(chave, p);
  }
  return imagens.get(chave)!;
}

/** The signature in a colour (it's drawn white on transparent). */
function assinaturaNaCor(src: string, cor: string) {
  return guardada(`assinatura|${src}|${cor}`, async () => {
    const img = await carregar(src);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = cor === ARCO_IRIS ? arcoIris(ctx, 0, c.height) : cor;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  });
}

function logoNasCores(variante: 'grafite' | 'liso', cores: [string, string] | null) {
  const src = ARQUIVO_LOGO[variante];
  if (!cores) return guardada(src, () => carregar(src));
  return guardada(`logo|${variante}|${cores.join()}`, async () => {
    const url = URL.createObjectURL(await pintar(src, CAMADAS_LOGO[variante], cores));
    try {
      return await carregar(url);
    } finally {
      // The image is decoded; the link isn't needed any more.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
}

/** The picture an element draws, if it uses one. */
function imagemDe(e: Elemento, r: Recursos): Promise<CanvasImageSource> | null {
  if (e.tipo === 'foto') return r.foto ? guardada(r.foto, () => carregar(r.foto!)) : null;
  if (e.tipo === 'logo') return logoNasCores(e.variante, e.cores);
  if (e.tipo === 'assinatura') return r.assinatura ? assinaturaNaCor(r.assinatura, e.cor) : null;
  return null;
}

const muro = () => guardada('/assets/wall-texture.png', () => carregar('/assets/wall-texture.png'));

let fontesCarregadas: Promise<void> | null = null;
/** The editor's fonts (Google Fonts), loaded once, before drawing any text. */
export function carregarFontes(): Promise<void> {
  if (!fontesCarregadas) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Caveat:wght@700&family=Fredoka:wght@700&family=Inter:wght@800&family=Pacifico&family=Permanent+Marker&family=Roboto+Slab:wght@900&display=block';
    document.head.appendChild(link);
    fontesCarregadas = new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
    }).then(() =>
      Promise.all(FONTES.map((f) => document.fonts.load(`${PESO[f]} 80px "${f}"`).catch(() => []))).then(() => undefined),
    );
  }
  return fontesCarregadas;
}

/** Everything a design needs, loaded: resolves to the ready pictures, by element id. */
export async function prepararImagens(d: Design, r: Recursos): Promise<Map<string, CanvasImageSource>> {
  const prontas = new Map<string, CanvasImageSource>();
  await Promise.all([
    ...d.elementos.map(async (e) => {
      const p = imagemDe(e, r);
      if (p) prontas.set(e.id, await p.catch(() => null as unknown as CanvasImageSource));
    }),
    d.fundo.tipo === 'muro' ? muro().then((m) => prontas.set('__muro', m)) : null,
    carregarFontes(),
  ]);
  return prontas;
}

// ---------------------------------------------------------------------------
// Sizes: each element's box at scale 1, in the sticker's pixels.

const BASE = { foto: 560, logo: 420, assinatura: 520, forma: 220 };

function medidaDoTexto(ctx: CanvasRenderingContext2D, e: Extract<Elemento, { tipo: 'texto' }>) {
  ctx.font = `${PESO[e.fonte]} 120px "${e.fonte}"`;
  const largura = Math.max(40, ctx.measureText(e.conteudo || ' ').width);
  return { w: largura + 20, h: 170 };
}

/** The element's box (before its scale and rotation). */
export function caixa(e: Elemento, imagem: CanvasImageSource | undefined, ctx: CanvasRenderingContext2D): { w: number; h: number } {
  if (e.tipo === 'texto') {
    const m = medidaDoTexto(ctx, e);
    if (!e.curva) return m;
    // Along an arc: as wide as the arc's chord, and higher by how much it bends.
    const angulo = (Math.abs(e.curva) * Math.PI) / 180;
    const raio = (m.w - 20) / angulo;
    return { w: 2 * raio * Math.sin(Math.min(Math.PI / 2, angulo / 2)) + 140, h: m.h + raio * (1 - Math.cos(angulo / 2)) };
  }
  if (e.tipo === 'forma') return { w: BASE.forma, h: BASE.forma };
  if (e.tipo === 'foto') return { w: BASE.foto, h: BASE.foto };
  const base = e.tipo === 'logo' ? BASE.logo : BASE.assinatura;
  const iw = (imagem as HTMLImageElement | undefined)?.width || 1;
  const ih = (imagem as HTMLImageElement | undefined)?.height || 1;
  return iw >= ih ? { w: base, h: (base * ih) / iw } : { w: (base * iw) / ih, h: base };
}

// ---------------------------------------------------------------------------
// Drawing.

function arcoIris(ctx: CanvasRenderingContext2D, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  const n = FAIXAS_ARCO_IRIS.length;
  FAIXAS_ARCO_IRIS.forEach((c, i) => {
    g.addColorStop(i / n, c);
    g.addColorStop((i + 1) / n - 0.0001, c);
  });
  return g;
}

const pintura = (ctx: CanvasRenderingContext2D, cor: string, y0: number, y1: number) => (cor === ARCO_IRIS ? arcoIris(ctx, y0, y1) : cor);

function caminhoDaForma(ctx: CanvasRenderingContext2D, forma: Forma, r: number) {
  ctx.beginPath();
  if (forma === 'circulo') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else if (forma === 'estrela' || forma === 'estrela6' || forma === 'brilho') {
    const pontas = forma === 'estrela' ? 5 : forma === 'estrela6' ? 6 : 4;
    const dentro = forma === 'estrela' ? 0.45 : forma === 'estrela6' ? 0.6 : 0.28;
    for (let i = 0; i < pontas * 2; i++) {
      const a = (Math.PI / pontas) * i - Math.PI / 2;
      const raio = i % 2 === 0 ? r : r * dentro;
      ctx.lineTo(raio * Math.cos(a), raio * Math.sin(a));
    }
    ctx.closePath();
  } else if (forma === 'coracao') {
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.25, r * 0.05, -r * 0.75, -r * 1.05, 0, -r * 0.42);
    ctx.bezierCurveTo(r * 0.75, -r * 1.05, r * 1.25, r * 0.05, 0, r * 0.9);
    ctx.closePath();
  } else if (forma === 'coroa') {
    const p = [
      [-1, 0.55],
      [-1.05, -0.55],
      [-0.5, -0.05],
      [0, -0.75],
      [0.5, -0.05],
      [1.05, -0.55],
      [1, 0.55],
    ];
    p.forEach(([x, y], i) => (i ? ctx.lineTo(x * r * 0.9, y * r * 0.9) : ctx.moveTo(x * r * 0.9, y * r * 0.9)));
    ctx.closePath();
  } else if (forma === 'raio') {
    const p = [
      [0.15, -1],
      [-0.55, 0.12],
      [-0.05, 0.12],
      [-0.2, 1],
      [0.55, -0.15],
      [0.05, -0.15],
    ];
    p.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    ctx.closePath();
  }
}

function desenharTexto(ctx: CanvasRenderingContext2D, e: Extract<Elemento, { tipo: 'texto' }>) {
  ctx.font = `${PESO[e.fonte]} 120px "${e.fonte}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const preencher = pintura(ctx, e.cor, -70, 70);
  const traco = (t: string, x: number, y: number) => {
    if (e.contorno && e.larguraContorno > 0) {
      ctx.strokeStyle = pintura(ctx, e.contorno, -70, 70);
      ctx.lineWidth = e.larguraContorno * 2;
      ctx.strokeText(t, x, y);
    }
    ctx.fillStyle = preencher;
    ctx.fillText(t, x, y);
  };
  if (!e.curva) {
    traco(e.conteudo, 0, 0);
    return;
  }
  // Along an arc spanning `curva` degrees, centred on the element: > 0 like
  // the top of a circle (the ends lower), < 0 like the bottom (the ends higher).
  const largura = ctx.measureText(e.conteudo).width;
  const angulo = (Math.abs(e.curva) * Math.PI) / 180;
  const raio = largura / angulo;
  const sinal = e.curva > 0 ? 1 : -1;
  // Centred vertically on the box: half of the bend up, half down.
  ctx.translate(0, -sinal * (raio * (1 - Math.cos(angulo / 2))) / 2);
  let a = -angulo / 2;
  for (const letra of e.conteudo) {
    const w = ctx.measureText(letra).width;
    const meio = a + w / raio / 2;
    ctx.save();
    ctx.translate(Math.sin(meio) * raio, sinal * (raio - Math.cos(meio) * raio));
    ctx.rotate(sinal * meio);
    traco(letra, 0, 0);
    ctx.restore();
    a += w / raio;
  }
}

/**
 * Draws the design on a canvas `LADO` across (scaled with `escala` for a
 * smaller screen): the background and the elements clipped to the circle,
 * then the border; transparent outside. `selecionado`: the id to mark (only
 * on the editor's screen, never in the print file).
 */
export function desenhar(
  ctx: CanvasRenderingContext2D,
  d: Design,
  prontas: Map<string, CanvasImageSource>,
  opcoes: { escala?: number; selecionado?: string | null } = {},
) {
  const k = opcoes.escala ?? 1;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, LADO, LADO);
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, C, 0, Math.PI * 2);
  ctx.clip();

  // Background.
  const f = d.fundo;
  if (f.tipo === 'degrade') {
    const g = ctx.createLinearGradient(0, 0, LADO, LADO);
    g.addColorStop(0, f.cor1);
    g.addColorStop(1, f.cor2);
    ctx.fillStyle = g;
  } else if (f.tipo === 'arcoiris') {
    ctx.fillStyle = arcoIris(ctx, 0, LADO);
  } else {
    ctx.fillStyle = f.cor1;
  }
  ctx.fillRect(0, 0, LADO, LADO);
  if (f.tipo === 'muro' && prontas.get('__muro')) {
    ctx.globalAlpha = 0.85;
    const m = prontas.get('__muro') as HTMLImageElement;
    const s = Math.max(LADO / m.width, LADO / m.height);
    ctx.drawImage(m, (LADO - m.width * s) / 2, (LADO - m.height * s) / 2, m.width * s, m.height * s);
    ctx.globalAlpha = 1;
  }

  // Elements, first at the back.
  for (const e of d.elementos) {
    const img = prontas.get(e.id);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate((e.giro * Math.PI) / 180);
    ctx.scale(e.escala, e.escala);
    if (e.tipo === 'texto') desenharTexto(ctx, e);
    else if (e.tipo === 'forma') {
      caminhoDaForma(ctx, e.forma, BASE.forma / 2);
      ctx.fillStyle = pintura(ctx, e.cor, -BASE.forma / 2, BASE.forma / 2);
      ctx.fill();
      if (e.contorno) {
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = pintura(ctx, e.contorno, -BASE.forma / 2, BASE.forma / 2);
        ctx.stroke();
      }
    } else if (e.tipo === 'foto') {
      const lado = BASE.foto;
      if (img) {
        const fw = (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width;
        const fh = (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height;
        const r = recorte(fw, fh, enquadramentoPadrao(fw, fh));
        ctx.save();
        ctx.beginPath();
        if (e.formato === 'circulo') ctx.arc(0, 0, lado / 2, 0, Math.PI * 2);
        else ctx.roundRect(-lado / 2, -lado / 2, lado, lado, 36);
        ctx.clip();
        ctx.drawImage(img, r.sx, r.sy, r.lado, r.lado, -lado / 2, -lado / 2, lado, lado);
        ctx.restore();
      }
      if (e.larguraBorda > 0) {
        ctx.beginPath();
        if (e.formato === 'circulo') ctx.arc(0, 0, lado / 2, 0, Math.PI * 2);
        else ctx.roundRect(-lado / 2, -lado / 2, lado, lado, 36);
        ctx.lineWidth = e.larguraBorda;
        ctx.strokeStyle = pintura(ctx, e.borda, -lado / 2, lado / 2);
        ctx.stroke();
      }
    } else if (img) {
      const { w, h } = caixa(e, img, ctx);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
  ctx.restore();

  // The border, along the cut.
  if (d.borda.largura > 0) {
    ctx.beginPath();
    ctx.arc(C, C, C - d.borda.largura / 2, 0, Math.PI * 2);
    ctx.lineWidth = d.borda.largura;
    ctx.strokeStyle = pintura(ctx, d.borda.cor, 0, LADO);
    ctx.stroke();
  }

  // The selection (editor only): a dashed box and the corner handle.
  const sel = d.elementos.find((e) => e.id === opcoes.selecionado);
  if (sel) {
    const { w, h } = caixa(sel, prontas.get(sel.id), ctx);
    ctx.save();
    ctx.translate(sel.x, sel.y);
    ctx.rotate((sel.giro * Math.PI) / 180);
    const W = (w * sel.escala) / 2 + 14;
    const H = (h * sel.escala) / 2 + 14;
    ctx.lineWidth = 4 / k;
    ctx.setLineDash([16 / k, 10 / k]);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(-W, -H, W * 2, H * 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2 / k;
    ctx.strokeRect(-W - 2 / k, -H - 2 / k, W * 2 + 4 / k, H * 2 + 4 / k);
    ctx.beginPath();
    ctx.arc(W, H, 22 / k, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a96a';
    ctx.fill();
    ctx.lineWidth = 4 / k;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Which element is under a point (the topmost), or null. */
export function elementoEm(d: Design, prontas: Map<string, CanvasImageSource>, ctx: CanvasRenderingContext2D, x: number, y: number): Elemento | null {
  for (let i = d.elementos.length - 1; i >= 0; i--) {
    const e = d.elementos[i];
    const { w, h } = caixa(e, prontas.get(e.id), ctx);
    const a = (-e.giro * Math.PI) / 180;
    const dx = x - e.x;
    const dy = y - e.y;
    const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / e.escala;
    const ly = (dx * Math.sin(a) + dy * Math.cos(a)) / e.escala;
    if (Math.abs(lx) <= w / 2 + 10 && Math.abs(ly) <= h / 2 + 10) return e;
  }
  return null;
}

/** Where the selected element's corner handle is, in the sticker's pixels. */
export function alcaDe(e: Elemento, prontas: Map<string, CanvasImageSource>, ctx: CanvasRenderingContext2D) {
  const { w, h } = caixa(e, prontas.get(e.id), ctx);
  const W = (w * e.escala) / 2 + 14;
  const H = (h * e.escala) / 2 + 14;
  const a = (e.giro * Math.PI) / 180;
  return { x: e.x + W * Math.cos(a) - H * Math.sin(a), y: e.y + W * Math.sin(a) + H * Math.cos(a), raioBase: Math.hypot(W, H) };
}

/** The finished sticker as a PNG, `LADO` across, transparent outside the circle. */
export async function pngDaCriacao(d: Design, r: Recursos): Promise<Blob> {
  const prontas = await prepararImagens(d, r);
  const canvas = document.createElement('canvas');
  canvas.width = LADO;
  canvas.height = LADO;
  desenhar(canvas.getContext('2d')!, d, prontas);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível montar o adesivo.'))), 'image/png'),
  );
}

/** What a new creation starts with: their photo in the middle, TURMA 32 along the bottom, their signature, a couple of stars. */
export function designInicial(temFoto: boolean, temAssinatura: boolean): Design {
  const elementos: Elemento[] = [];
  if (temFoto) elementos.push({ id: novoId(), tipo: 'foto', x: C, y: C - 40, escala: 1, giro: 0, formato: 'circulo', borda: '#ffffff', larguraBorda: 18 });
  else elementos.push({ id: novoId(), tipo: 'logo', x: C, y: C - 40, escala: 1.25, giro: 0, variante: 'grafite', cores: null });
  elementos.push({
    id: novoId(),
    tipo: 'texto',
    x: C,
    y: C + 400,
    escala: 0.85,
    giro: 0,
    conteudo: 'TURMA 32',
    fonte: 'Roboto Slab',
    cor: '#ffffff',
    contorno: '#000000',
    larguraContorno: 10,
    curva: -120,
  });
  if (temAssinatura) elementos.push({ id: novoId(), tipo: 'assinatura', x: C + 230, y: C + 190, escala: 0.6, giro: -8, cor: '#ffffff' });
  elementos.push({ id: novoId(), tipo: 'forma', x: C - 380, y: C - 250, escala: 0.45, giro: 0, forma: 'estrela6', cor: '#c7d1d9', contorno: null });
  elementos.push({ id: novoId(), tipo: 'forma', x: C + 380, y: C - 250, escala: 0.45, giro: 0, forma: 'estrela6', cor: '#c7d1d9', contorno: null });
  return { v: 1, fundo: { tipo: 'cor', cor1: '#2b5b91', cor2: '#0b1a2e' }, borda: { cor: '#ffffff', largura: 22 }, elementos };
}
