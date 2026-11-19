import { User } from 'lucide-react';

/**
 * The childhood sticker: the committee's own model
 * (public/assets/adesivo-crianca-moldura.webp — the date, "FORMATURA 32
 * 2026", the stars, with the photo's circle cut out) laid over the
 * formando's childhood photo. One per formando, made from their own photo.
 *
 * The sticker is cut round: `redondo` shows it that way on the page; the
 * print file (pngDoAdesivo) keeps the square, like the model, for the print
 * shop to cut.
 */

export const MOLDURA = '/assets/adesivo-crianca-moldura.webp';
/** The model's size, and where its photo circle is (measured on it). */
const LADO = 1181;
const FOTO = { cx: 590.2, cy: 589.9, r: 442.5 };

export function AdesivoCrianca({
  foto,
  nome,
  redondo = true,
  tamanho = '100%',
}: {
  foto: string | null;
  nome: string;
  redondo?: boolean;
  tamanho?: number | string;
}) {
  // The photo fills the hole as a square, cut round by the frame's hole.
  const lado = (FOTO.r * 2 * 100) / LADO;
  return (
    <div
      role="img"
      aria-label={`Adesivo de criança de ${nome}`}
      style={{
        position: 'relative',
        width: tamanho,
        aspectRatio: '1',
        borderRadius: redondo ? '50%' : 0,
        overflow: 'hidden',
        background: '#2b5b91',
      }}
    >
      {foto ? (
        <img
          src={foto}
          alt=""
          style={{
            position: 'absolute',
            left: `${((FOTO.cx - FOTO.r) * 100) / LADO}%`,
            top: `${((FOTO.cy - FOTO.r) * 100) / LADO}%`,
            width: `${lado}%`,
            height: `${lado}%`,
            objectFit: 'cover',
            borderRadius: '50%',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: `${((FOTO.cx - FOTO.r) * 100) / LADO}%`,
            top: `${((FOTO.cy - FOTO.r) * 100) / LADO}%`,
            width: `${lado}%`,
            height: `${lado}%`,
            borderRadius: '50%',
            background: '#1f4370',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,.55)',
          }}
        >
          <User style={{ width: '45%', height: '45%' }} strokeWidth={1.5} aria-hidden />
        </div>
      )}
      <img src={MOLDURA} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

function carregarImagem(src: string, erro: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(erro));
    img.src = src;
  });
}

/**
 * One formando's sticker as a square PNG of `lado` pixels (the model's own
 * size by default), for the print shop: the photo cropped to fill the
 * circle, the frame over it.
 */
export async function pngDoAdesivo(foto: string, nome: string, lado = LADO): Promise<Blob> {
  const [imagem, moldura] = await Promise.all([
    carregarImagem(foto, `Não foi possível baixar a foto de ${nome}. Recarregue a página e tente de novo.`),
    carregarImagem(MOLDURA, 'Não foi possível carregar o modelo do adesivo.'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d')!;
  const k = lado / LADO;
  // The photo, cropped to a centred square ("cover").
  const menor = Math.min(imagem.naturalWidth, imagem.naturalHeight);
  const sx = (imagem.naturalWidth - menor) / 2;
  const sy = (imagem.naturalHeight - menor) / 2;
  ctx.drawImage(imagem, sx, sy, menor, menor, (FOTO.cx - FOTO.r) * k, (FOTO.cy - FOTO.r) * k, FOTO.r * 2 * k, FOTO.r * 2 * k);
  ctx.drawImage(moldura, 0, 0, lado, lado);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível montar o adesivo.'))), 'image/png'),
  );
}

/** Saves a Blob as a file. */
export function salvarArquivo(blob: Blob, nome: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
