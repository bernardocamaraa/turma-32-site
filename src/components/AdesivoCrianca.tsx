import { useRef, useState, type PointerEvent as EventoPonteiro } from 'react';
import { Minus, Plus, User } from 'lucide-react';

/**
 * The childhood sticker: the committee's own model
 * (public/assets/adesivo-crianca-moldura.webp — the date, "FORMATURA 32
 * 2026", the stars, with the photo's circle cut out) laid over the
 * formando's childhood photo. One per formando, made from their own photo.
 *
 * Which part of the photo fills the circle is its `enquadramento`: the
 * centre of the crop and how much it's zoomed in. Without one, a photo
 * taken standing up is cropped from higher up, where the face usually is.
 * The formando (their own) and the committee (anyone's) can move and zoom
 * it (AjustarFoto, below).
 *
 * The sticker is cut round: `redondo` shows it that way on the page; the
 * print file (pngDoAdesivo) keeps the square, like the model, for the print
 * shop to cut.
 */

export const MOLDURA = '/assets/adesivo-crianca-moldura.webp';
/** The model's size, and where its photo circle is (measured on it). */
const LADO = 1181;
const FOTO = { cx: 590.2, cy: 589.9, r: 442.5 };

/** The crop of the photo: its centre (0–1 across and down the photo) and the zoom (1: the biggest square that fits). */
export type Enquadramento = { x: number; y: number; zoom: number };
export const ZOOM_MAXIMO = 4;

/** Where a photo is cropped when nobody adjusted it: the middle, or higher up on a photo taken standing up. */
export function enquadramentoPadrao(largura: number, altura: number): Enquadramento {
  return { x: 0.5, y: altura > largura * 1.15 ? 0.38 : 0.5, zoom: 1 };
}

/** The square of the photo that fills the circle, in the photo's pixels, kept inside the photo. */
export function recorte(largura: number, altura: number, e: Enquadramento) {
  const lado = Math.min(largura, altura) / Math.max(1, Math.min(ZOOM_MAXIMO, e.zoom));
  const sx = Math.min(largura - lado, Math.max(0, e.x * largura - lado / 2));
  const sy = Math.min(altura - lado, Math.max(0, e.y * altura - lado / 2));
  return { sx, sy, lado };
}

/** The same crop, with its centre moved back inside the photo (so dragging past the edge doesn't pile up). */
function ajustado(largura: number, altura: number, e: Enquadramento): Enquadramento {
  const { sx, sy, lado } = recorte(largura, altura, e);
  return { x: (sx + lado / 2) / largura, y: (sy + lado / 2) / altura, zoom: Math.max(1, Math.min(ZOOM_MAXIMO, e.zoom)) };
}

const posicaoDoCirculo = {
  left: `${((FOTO.cx - FOTO.r) * 100) / LADO}%`,
  top: `${((FOTO.cy - FOTO.r) * 100) / LADO}%`,
  width: `${(FOTO.r * 2 * 100) / LADO}%`,
  height: `${(FOTO.r * 2 * 100) / LADO}%`,
};

export function AdesivoCrianca({
  foto,
  nome,
  enquadramento,
  redondo = true,
  tamanho = '100%',
  aoMedir,
}: {
  foto: string | null;
  nome: string;
  enquadramento?: Enquadramento | null;
  redondo?: boolean;
  tamanho?: number | string;
  /** The photo's size once it loads (for AjustarFoto). */
  aoMedir?: (largura: number, altura: number) => void;
}) {
  // The size of the photo it was measured on: a cached photo can load before
  // the component settles, so the size is kept with its address rather than
  // cleared when the photo changes.
  const [medidaDe, setMedidaDe] = useState<{ src: string; w: number; h: number } | null>(null);
  const medida = medidaDe && medidaDe.src === foto ? medidaDe : null;
  const e = medida ? (enquadramento ?? enquadramentoPadrao(medida.w, medida.h)) : null;
  const r = medida && e ? recorte(medida.w, medida.h, e) : null;

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
        <div style={{ position: 'absolute', ...posicaoDoCirculo, borderRadius: '50%', overflow: 'hidden', background: '#1f4370' }}>
          <img
            src={foto}
            alt=""
            draggable={false}
            onLoad={(ev) => {
              const { naturalWidth: w, naturalHeight: h } = ev.currentTarget;
              setMedidaDe({ src: foto, w, h });
              aoMedir?.(w, h);
            }}
            style={
              medida && r
                ? {
                    position: 'absolute',
                    maxWidth: 'none',
                    width: `${(medida.w / r.lado) * 100}%`,
                    height: `${(medida.h / r.lado) * 100}%`,
                    left: `${(-r.sx / r.lado) * 100}%`,
                    top: `${(-r.sy / r.lado) * 100}%`,
                  }
                : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0 }
            }
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            ...posicaoDoCirculo,
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
      <img src={MOLDURA} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
    </div>
  );
}

/**
 * Moves and zooms the photo inside the sticker: drag it (finger or mouse),
 * the − / + buttons or the slider for the zoom, the arrow keys to nudge.
 */
export function AjustarFoto({
  foto,
  nome,
  inicial,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: {
  foto: string;
  nome: string;
  inicial: Enquadramento | null;
  salvando: boolean;
  erro?: string | null;
  onSalvar: (e: Enquadramento | null) => void;
  onCancelar: () => void;
}) {
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const [e, setE] = useState<Enquadramento | null>(inicial);
  const area = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ px: number; py: number; e: Enquadramento } | null>(null);
  const atual = medida ? (e ?? enquadramentoPadrao(medida.w, medida.h)) : null;

  function mudar(novo: Enquadramento) {
    if (medida) setE(ajustado(medida.w, medida.h, novo));
  }

  /** Moves the crop by (dx, dy) pixels of the circle on screen — the photo follows the finger. */
  function mover(base: Enquadramento, dx: number, dy: number) {
    if (!medida || !area.current) return;
    const circulo = (area.current.clientWidth * FOTO.r * 2) / LADO;
    const { lado } = recorte(medida.w, medida.h, base);
    const k = lado / circulo;
    mudar({ ...base, x: base.x - (dx * k) / medida.w, y: base.y - (dy * k) / medida.h });
  }

  function comecar(ev: EventoPonteiro<HTMLDivElement>) {
    if (!atual) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    arrasto.current = { px: ev.clientX, py: ev.clientY, e: atual };
  }
  function arrastar(ev: EventoPonteiro<HTMLDivElement>) {
    if (!arrasto.current) return;
    mover(arrasto.current.e, ev.clientX - arrasto.current.px, ev.clientY - arrasto.current.py);
  }
  const soltar = () => {
    arrasto.current = null;
  };

  const zoom = atual?.zoom ?? 1;
  const botao = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(245,245,247,.12)',
    color: 'var(--chalk-050)',
    cursor: 'pointer',
    flex: '0 0 auto',
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
      <div
        ref={area}
        tabIndex={0}
        aria-label={`Foto de ${nome}: arraste para mover, setas do teclado também movem`}
        onPointerDown={comecar}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onKeyDown={(ev) => {
          if (!atual) return;
          const passo = 12;
          const d = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }[ev.key];
          if (d) {
            ev.preventDefault();
            mover(atual, d[0], d[1]);
          }
        }}
        style={{ width: 'min(100%, 340px)', touchAction: 'none', cursor: 'grab', borderRadius: '50%', outlineOffset: 4 }}
      >
        <AdesivoCrianca foto={foto} nome={nome} enquadramento={atual} aoMedir={(w, h) => setMedida({ w, h })} />
      </div>
      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)', textAlign: 'center' }}>Arraste a foto para enquadrar o rosto.</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: 'min(100%, 340px)' }}>
        <button type="button" aria-label="Menos zoom" style={botao} disabled={!atual} onClick={() => atual && mudar({ ...atual, zoom: zoom - 0.25 })}>
          <Minus size={18} />
        </button>
        <input
          type="range"
          aria-label="Zoom da foto"
          min={1}
          max={ZOOM_MAXIMO}
          step={0.05}
          value={zoom}
          disabled={!atual}
          onChange={(ev) => atual && mudar({ ...atual, zoom: Number(ev.target.value) })}
          style={{ flex: 1, accentColor: 'var(--gild-400)', minWidth: 0 }}
        />
        <button type="button" aria-label="Mais zoom" style={botao} disabled={!atual} onClick={() => atual && mudar({ ...atual, zoom: zoom + 0.25 })}>
          <Plus size={18} />
        </button>
      </div>
      {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          disabled={salvando || !atual}
          onClick={() => onSalvar(e)}
          style={{
            height: 'var(--control-h)',
            padding: '0 22px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: 'var(--gild-400)',
            color: '#000',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: salvando ? 0.6 : 1,
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar enquadramento'}
        </button>
        <button
          type="button"
          onClick={() => setE(null)}
          disabled={salvando || e === null}
          style={{ height: 'var(--control-h)', padding: '0 16px', border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 15, cursor: 'pointer', opacity: e === null ? 0.4 : 1 }}
        >
          Voltar ao padrão
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          style={{ height: 'var(--control-h)', padding: '0 16px', border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 15, cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
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
 * size by default), for the print shop: the photo cropped as framed (or
 * the default crop), the frame over it.
 */
export async function pngDoAdesivo(foto: string, nome: string, lado = LADO, enquadramento?: Enquadramento | null): Promise<Blob> {
  const [imagem, moldura] = await Promise.all([
    carregarImagem(foto, `Não foi possível baixar a foto de ${nome}. Recarregue a página e tente de novo.`),
    carregarImagem(MOLDURA, 'Não foi possível carregar o modelo do adesivo.'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d')!;
  const k = lado / LADO;
  const w = imagem.naturalWidth;
  const h = imagem.naturalHeight;
  const { sx, sy, lado: s } = recorte(w, h, enquadramento ?? enquadramentoPadrao(w, h));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagem, sx, sy, s, s, (FOTO.cx - FOTO.r) * k, (FOTO.cy - FOTO.r) * k, FOTO.r * 2 * k, FOTO.r * 2 * k);
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
