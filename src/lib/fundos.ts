/**
 * Patterned backgrounds for the circle behind art that isn't round (the 32):
 * the site's wall, concrete, a starry sky… Picked like a colour, for a 'fundo'
 * part (cores.ts), and kept in an order's key by their id ("muro").
 *
 * Drawn here, in the browser, at whatever size is asked: the same drawing in
 * the store and in the print-shop file. A fixed seed per pattern, so the
 * bricks and the stars always fall in the same places.
 */

export const ESTAMPAS: { id: string; nome: string; imagem?: string }[] = [
  // The site's own wall (the "A turma" and album pages).
  { id: 'muro', nome: 'Muro', imagem: '/assets/wall-texture.png' },
  { id: 'concreto', nome: 'Muro de concreto' },
  { id: 'estrelas', nome: 'Céu estrelado' },
  { id: 'xadrez', nome: 'Xadrez' },
  { id: 'listras', nome: 'Listras' },
  { id: 'bolinhas', nome: 'Bolinhas' },
  { id: 'respingos', nome: 'Respingos de tinta' },
];

export const ehEstampa = (cor: string) => ESTAMPAS.some((e) => e.id === cor);
export const nomeDaEstampa = (cor: string) => ESTAMPAS.find((e) => e.id === cor)?.nome ?? null;

/** Always the same "random" numbers for the same seed. */
function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const imagens = new Map<string, Promise<HTMLImageElement>>();

/** Loads the picture a pattern is made of, if any (call before desenharEstampa). */
export function prepararEstampa(id: string): Promise<HTMLImageElement | null> {
  const src = ESTAMPAS.find((e) => e.id === id)?.imagem;
  if (!src) return Promise.resolve(null);
  if (!imagens.has(src)) {
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível carregar o fundo do adesivo.'));
      img.src = src;
    });
    p.catch(() => imagens.delete(src));
    imagens.set(src, p);
  }
  return imagens.get(src)!;
}

/**
 * Fills the `lado`×`lado` square with the pattern (the caller clips it to the
 * circle). A pattern made of a picture needs it, from prepararEstampa: its
 * middle square, covering.
 */
export function desenharEstampa(ctx: CanvasRenderingContext2D, id: string, lado: number, imagem?: HTMLImageElement | null) {
  const L = lado;
  const r = sorteio(id.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  ctx.save();
  if (imagem) {
    const q = Math.min(imagem.naturalWidth, imagem.naturalHeight);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagem, (imagem.naturalWidth - q) / 2, (imagem.naturalHeight - q) / 2, q, q, 0, 0, L, L);
    ctx.restore();
    return;
  }
  switch (id) {
    case 'concreto': {
      // Grey blocks, a little lighter or darker each, with speckles.
      const h = L / 5.5;
      const w = h * 2;
      const junta = h * 0.08;
      ctx.fillStyle = '#5f5f5f';
      ctx.fillRect(0, 0, L, L);
      for (let linha = 0, y = -h / 3; y < L; linha++, y += h) {
        for (let x = linha % 2 ? -w / 2 : -w * 0.1; x < L; x += w) {
          ctx.fillStyle = `hsl(0, 0%, ${52 + r() * 14}%)`;
          const bx = x + junta / 2;
          const by = y + junta / 2;
          const bw = w - junta;
          const bh = h - junta;
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = 'rgba(0,0,0,.12)';
          ctx.fillRect(bx, by + bh * 0.8, bw, bh * 0.2);
          for (let k = 0; k < 10; k++) {
            ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.10)';
            ctx.beginPath();
            ctx.arc(bx + r() * bw, by + r() * bh, (0.004 + r() * 0.006) * L, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }
    case 'estrelas': {
      const ceu = ctx.createRadialGradient(L * 0.5, L * 0.35, L * 0.05, L * 0.5, L * 0.5, L * 0.75);
      ceu.addColorStop(0, '#1d2f6b');
      ceu.addColorStop(1, '#070b1f');
      ctx.fillStyle = ceu;
      ctx.fillRect(0, 0, L, L);
      for (let k = 0; k < 140; k++) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
        ctx.beginPath();
        ctx.arc(r() * L, r() * L, (0.002 + r() * 0.005) * L, 0, Math.PI * 2);
        ctx.fill();
      }
      // A few bright four-pointed stars.
      for (let k = 0; k < 9; k++) {
        const x = r() * L;
        const y = r() * L;
        const t = (0.02 + r() * 0.025) * L;
        ctx.fillStyle = '#fff6d6';
        ctx.beginPath();
        ctx.moveTo(x, y - t);
        ctx.quadraticCurveTo(x, y, x + t, y);
        ctx.quadraticCurveTo(x, y, x, y + t);
        ctx.quadraticCurveTo(x, y, x - t, y);
        ctx.quadraticCurveTo(x, y, x, y - t);
        ctx.fill();
      }
      break;
    }
    case 'xadrez': {
      const n = 8;
      const q = L / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
          ctx.fillRect(i * q, j * q, q + 1, q + 1);
        }
      break;
    }
    case 'listras': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, L, L);
      ctx.translate(L / 2, L / 2);
      ctx.rotate(-Math.PI / 4);
      const faixa = L / 12;
      ctx.fillStyle = '#a9d3e8';
      for (let x = -L; x < L; x += faixa * 2) ctx.fillRect(x, -L, faixa, 2 * L);
      break;
    }
    case 'bolinhas': {
      ctx.fillStyle = '#a9d3e8';
      ctx.fillRect(0, 0, L, L);
      const passo = L / 7;
      ctx.fillStyle = '#ffffff';
      for (let linha = 0, y = 0; y < L + passo; linha++, y += passo * 0.87)
        for (let x = linha % 2 ? passo / 2 : 0; x < L + passo; x += passo) {
          ctx.beginPath();
          ctx.arc(x, y, passo * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    }
    case 'respingos': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, L, L);
      const tintas = ['#e0262b', '#ffd21f', '#2f6fd6', '#22b05a', '#ff5fa2', '#8a4fe0', '#ff7a00'];
      for (let k = 0; k < 16; k++) {
        const cx = r() * L;
        const cy = r() * L;
        const raio = (0.04 + r() * 0.07) * L;
        ctx.fillStyle = tintas[k % tintas.length];
        ctx.beginPath();
        ctx.arc(cx, cy, raio, 0, Math.PI * 2);
        ctx.fill();
        // Droplets around each splash.
        for (let g = 0; g < 9; g++) {
          const ang = r() * Math.PI * 2;
          const d = raio * (1.1 + r() * 1.2);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, raio * (0.08 + r() * 0.18), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    default:
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, L, L);
  }
  ctx.restore();
}

const amostras = new Map<string, string>();

/** A small picture of the pattern (a data URL, or the picture it's made of), for its swatch. */
export function amostraDaEstampa(id: string): string {
  const imagem = ESTAMPAS.find((e) => e.id === id)?.imagem;
  if (imagem) return imagem;
  if (!amostras.has(id)) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    desenharEstampa(canvas.getContext('2d')!, id, 96);
    amostras.set(id, canvas.toDataURL('image/png'));
  }
  return amostras.get(id)!;
}
