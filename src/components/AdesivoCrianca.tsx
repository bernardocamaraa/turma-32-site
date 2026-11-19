import { forwardRef, useId } from 'react';
import { nomeNoAdesivo } from '../lib/adesivos';

/**
 * The childhood sticker: the formando's childhood photo in a round die-cut
 * sticker, the class name around the top and their name on a band across
 * the bottom. Drawn as SVG so the same drawing shows on the page and turns
 * into a print-size PNG (baixarAdesivoCrianca below).
 *
 * PROVISIONAL LAYOUT — to be replaced by the committee's own model.
 */
export const AdesivoCrianca = forwardRef<SVGSVGElement, { foto: string | null; nome: string; tamanho?: number | string }>(
  function AdesivoCrianca({ foto, nome, tamanho = '100%' }, ref) {
    const id = useId().replace(/:/g, '');
    const nomeCurto = nomeNoAdesivo(nome).toUpperCase();
    // Long names shrink to fit the band.
    const fonteNome = Math.min(54, Math.floor(520 / Math.max(6, nomeCurto.length) / 0.62));

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 600 600"
        width={tamanho}
        height={tamanho}
        role="img"
        aria-label={`Adesivo de criança de ${nome}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={`${id}-fundo`} cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#1d3a4c" />
            <stop offset="70%" stopColor="#0a1620" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <clipPath id={`${id}-foto`}>
            <circle cx="300" cy="268" r="168" />
          </clipPath>
          <path id={`${id}-arco`} d="M 92 268 A 208 208 0 0 1 508 268" fill="none" />
        </defs>

        {/* The die-cut: a white margin all around, like a real sticker. */}
        <circle cx="300" cy="300" r="296" fill="#ffffff" />
        <circle cx="300" cy="300" r="276" fill={`url(#${id}-fundo)`} />
        <circle cx="300" cy="300" r="262" fill="none" stroke="#a9d3e8" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />

        {/* The class around the top. */}
        <text
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Helvetica Neue', Arial, sans-serif"
          fontSize="30"
          fontWeight="800"
          letterSpacing="7"
          fill="#a9d3e8"
        >
          <textPath href={`#${id}-arco`} xlinkHref={`#${id}-arco`} startOffset="50%" textAnchor="middle">
            TERCEIRÃO · TURMA 32
          </textPath>
        </text>

        {/* The photo. */}
        {foto ? (
          <image
            href={foto}
            xlinkHref={foto}
            x="132"
            y="100"
            width="336"
            height="336"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${id}-foto)`}
            crossOrigin="anonymous"
          />
        ) : (
          <g>
            <circle cx="300" cy="268" r="168" fill="#2c2c2e" />
            <circle cx="300" cy="228" r="58" fill="#48484a" />
            <path d="M 196 372 Q 300 262 404 372 Z" fill="#48484a" />
          </g>
        )}
        <circle cx="300" cy="268" r="168" fill="none" stroke="#ffffff" strokeWidth="10" />

        {/* Their name, on a band across the bottom. */}
        <g transform="rotate(-4 300 460)">
          <rect x="70" y="416" width="460" height="84" rx="20" fill="#ffffff" />
          <rect x="70" y="416" width="460" height="84" rx="20" fill="none" stroke="#000000" strokeWidth="4" />
          <text
            x="300"
            y="458"
            dominantBaseline="central"
            textAnchor="middle"
            fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Helvetica Neue', Arial, sans-serif"
            fontSize={fonteNome}
            fontWeight="900"
            letterSpacing="1"
            fill="#000000"
          >
            {nomeCurto}
          </text>
        </g>
        <text
          x="300"
          y="536"
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Helvetica Neue', Arial, sans-serif"
          fontSize="20"
          fontWeight="700"
          letterSpacing="5"
          fill="#dcc48c"
        >
          FORMATURA 2026
        </text>
      </svg>
    );
  },
);

/** A Blob read as a data: URL. */
function comoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

/**
 * Saves the sticker drawn in `svg` as a PNG of `lado` pixels (1800 ≈ 15cm at
 * 300dpi), for the print shop. The photo is a link to Storage, which an SVG
 * turned into an image can't load: it's fetched and put inside first.
 */
export async function baixarAdesivoCrianca(svg: SVGSVGElement, nomeArquivo: string, lado = 1800): Promise<void> {
  const copia = svg.cloneNode(true) as SVGSVGElement;
  copia.setAttribute('width', String(lado));
  copia.setAttribute('height', String(lado));
  for (const imagem of Array.from(copia.querySelectorAll('image'))) {
    const endereco = imagem.getAttribute('href') ?? imagem.getAttribute('xlink:href');
    if (!endereco || endereco.startsWith('data:')) continue;
    const resposta = await fetch(endereco);
    if (!resposta.ok) throw new Error('Não foi possível baixar a foto. Recarregue a página e tente de novo.');
    const dados = await comoDataUrl(await resposta.blob());
    imagem.setAttribute('href', dados);
    imagem.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dados);
  }
  const texto = new XMLSerializer().serializeToString(copia);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Não foi possível montar o adesivo.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = lado;
    canvas.height = lado;
    canvas.getContext('2d')!.drawImage(img, 0, 0, lado, lado);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível montar o adesivo.'))), 'image/png'),
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(png);
    link.download = nomeArquivo;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
