import { pintar, type Camada } from './cores';

/**
 * Every sticker is round (5 cm, folhas.ts). A picture that already is (a full circle
 * with empty corners) is used whole. One that isn't (the 32, cut to its
 * shape) is fitted inside the circle, on white: centred on what's visible
 * of it, and shrunk until no visible pixel comes closer than FOLGA to the
 * edge — so nothing gets cut off.
 */

/** Space kept between the art and the cut, as a share of the radius. */
const FOLGA = 0.1;

const prontos = new Map<string, Promise<Blob>>();

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem do adesivo.'));
    img.src = src;
  });
}

/** The round sticker, `lado` pixels across, as a PNG (transparent outside the circle). */
export function noCirculo(src: string, lado: number): Promise<Blob> {
  const chave = `${src}|${lado}`;
  if (!prontos.has(chave)) {
    const feito = (async () => {
      const img = await carregar(src);
      // Where the visible pixels are (measured on a smaller copy, enough for this).
      const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const medida = document.createElement('canvas');
      medida.width = w;
      medida.height = h;
      const mctx = medida.getContext('2d', { willReadFrequently: true })!;
      mctx.drawImage(img, 0, 0, w, h);
      const px = mctx.getImageData(0, 0, w, h).data;
      let x0 = w;
      let y0 = h;
      let x1 = 0;
      let y1 = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (px[(y * w + x) * 4 + 3] > 20) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < x0) {
        x0 = 0;
        y0 = 0;
        x1 = w - 1;
        y1 = h - 1;
      }
      const cx = (x0 + x1 + 1) / 2;
      const cy = (y0 + y1 + 1) / 2;
      // The farthest visible pixel (its far corner) from that centre.
      let longe = 1;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          if (px[(y * w + x) * 4 + 3] > 20) {
            const d = Math.hypot(Math.max(Math.abs(x - cx), Math.abs(x + 1 - cx)), Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy)));
            if (d > longe) longe = d;
          }

      const canvas = document.createElement('canvas');
      canvas.width = lado;
      canvas.height = lado;
      const ctx = canvas.getContext('2d')!;
      const raio = lado / 2;

      // Art that already is the round sticker (a full circle, empty corners):
      // used whole, at the full size.
      const alfa = (x: number, y: number) => px[(Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))) * 4 + 3];
      const d = Math.round(w * 0.03);
      const jaRedondo =
        Math.abs(w - h) <= Math.max(2, w * 0.02) &&
        [alfa(1, 1), alfa(w - 2, 1), alfa(1, h - 2), alfa(w - 2, h - 2)].every((a) => a < 10) &&
        [alfa(w / 2, d), alfa(w / 2, h - 1 - d), alfa(d, h / 2), alfa(w - 1 - d, h / 2), alfa(w / 2, h / 2)].every((a) => a > 200);
      if (jaRedondo) {
        ctx.beginPath();
        ctx.arc(raio, raio, raio, 0, Math.PI * 2);
        ctx.clip();
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, lado, lado);
        return new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível montar o adesivo.'))), 'image/png'),
        );
      }

      ctx.beginPath();
      ctx.arc(raio, raio, raio, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.save();
      ctx.clip();
      // Art pixels per small-copy pixel, so the farthest one lands FOLGA inside the edge.
      const escala = (raio * (1 - FOLGA)) / longe;
      const escalaOriginal = escala * k;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, raio - cx * escala, raio - cy * escala, img.naturalWidth * escalaOriginal, img.naturalHeight * escalaOriginal);
      ctx.restore();
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível montar o adesivo.'))), 'image/png'),
      );
    })();
    feito.catch(() => prontos.delete(chave));
    prontos.set(chave, feito);
  }
  return prontos.get(chave)!;
}

const pintadosRedondos = new Map<string, Promise<Blob>>();

/** The round sticker of a picture, painted with `cores` (one per part) first when given. */
export function adesivoRedondo(src: string, lado: number, camadas: Camada[] = [], cores: string[] | null = null): Promise<Blob> {
  if (!cores || camadas.length === 0) return noCirculo(src, lado);
  const chave = `${src}|${lado}|${JSON.stringify(camadas)}|${cores.join()}`;
  if (!pintadosRedondos.has(chave)) {
    const feito = (async () => {
      const url = URL.createObjectURL(await pintar(src, camadas, cores));
      try {
        return await noCirculo(url, lado);
      } finally {
        prontos.delete(`${url}|${lado}`);
        URL.revokeObjectURL(url);
      }
    })();
    feito.catch(() => pintadosRedondos.delete(chave));
    pintadosRedondos.set(chave, feito);
  }
  return pintadosRedondos.get(chave)!;
}
