import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { MapEmbed, MAPS_LINK } from './MapEmbed';
import { trecho, useProgressoRolagem } from '../lib/motion';
import { useReveal } from '../lib/useReveal';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

/** Building blocks shared by the invitation-style pages (Home, Baile). */

/** Rises into place the first time it scrolls into view. */
export function Revela({ children, style, atraso = 0 }: { children: ReactNode; style?: CSSProperties; atraso?: number }) {
  const reveal = useReveal<HTMLDivElement>(undefined, atraso);
  return (
    <div ref={reveal.ref} className={reveal.className} style={{ ...style, ...reveal.style }}>
      {children}
    </div>
  );
}

/**
 * A tile of the "the night, in short" grid: small line, big fact, small line.
 * Under a mouse it leans toward the pointer and its border lights up there
 * (`.bloco-vivo`); the lean lives on an inner element because the reveal
 * animation would otherwise override its transform.
 */
export function Bloco({
  children,
  coluna,
  atraso = 0,
  destaque,
}: {
  children: ReactNode;
  coluna?: string;
  atraso?: number;
  destaque?: boolean;
}) {
  const reduzido = usePrefersReducedMotion();

  const inclinar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--luz-x', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--luz-y', `${(y * 100).toFixed(1)}%`);
    if (reduzido) return;
    el.style.setProperty('--inc-x', `${((0.5 - y) * 5).toFixed(2)}deg`);
    el.style.setProperty('--inc-y', `${((x - 0.5) * 5).toFixed(2)}deg`);
  };
  const endireitar = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--inc-x', '0deg');
    e.currentTarget.style.setProperty('--inc-y', '0deg');
  };

  return (
    <Revela atraso={atraso} style={{ gridColumn: coluna, display: 'flex' }}>
      <div
        className="bloco-vivo"
        onPointerMove={inclinar}
        onPointerLeave={endireitar}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 'var(--space-3)',
          minHeight: 'clamp(150px, 22vw, 240px)',
          padding: 'clamp(28px, 4vw, 44px)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--ink-850)',
          border: '1px solid var(--stroke-hair)',
          // The invitation's thin inner frame, doubled in navy on the highlighted tile.
          boxShadow: destaque
            ? 'inset 0 0 0 6px var(--ink-850), inset 0 0 0 7px rgba(31,50,86,.35), 0 18px 40px -28px rgba(46,46,46,.35)'
            : 'inset 0 0 0 6px var(--ink-850), inset 0 0 0 7px var(--stroke-hair), 0 18px 40px -28px rgba(46,46,46,.3)',
        }}
      >
        {children}
      </div>
    </Revela>
  );
}

export function Pequeno({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>{children}</span>;
}

/**
 * The name on the invitation: brush script in ink with the navy stroke
 * swept under it. Used for the page's big names and section titles.
 */
export function NomeComPincelada({
  children,
  tamanho,
  como = 'span',
}: {
  children: ReactNode;
  tamanho: string;
  como?: 'span' | 'h2';
}) {
  const Tag = como;
  return (
    <Tag
      style={{
        position: 'relative',
        display: 'inline-block',
        margin: 0,
        paddingBottom: '.22em',
        fontFamily: 'var(--font-script)',
        fontWeight: 400,
        fontSize: tamanho,
        lineHeight: 1.05,
        letterSpacing: 0,
        color: 'var(--text-primary)',
        textWrap: 'balance' as never,
      }}
    >
      {children}
      <svg
        aria-hidden
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        className="pincelada"
        style={{ position: 'absolute', left: '-4%', right: '-2%', bottom: 0, width: '106%', height: '.2em' }}
      >
        <path
          d="M4 16 C 90 6, 200 3, 300 6 C 340 7, 372 10, 396 15 C 372 13, 330 12, 300 12 C 200 11, 100 13, 6 20 Z"
          fill="var(--accent-strong)"
        />
      </svg>
    </Tag>
  );
}

export function Grande({ children, tamanho }: { children: ReactNode; tamanho: string }) {
  return (
    <span
      className="numeros-antigos"
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: tamanho,
        lineHeight: 1.06,
        letterSpacing: '-.01em',
        textWrap: 'balance' as never,
      }}
    >
      {children}
    </span>
  );
}

/** A text link in the navy accent with a small chevron. Opens `href` in a new tab, or runs `onClick`. */
export function LinkSeta({ children, href, onClick }: { children: ReactNode; href?: string; onClick?: () => void }) {
  const estilo: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    marginTop: 'var(--space-3)',
    fontSize: 'var(--fs-body)',
    color: 'var(--accent)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  };
  const conteudo = (
    <>
      {children}
      <ChevronRight size={16} strokeWidth={2} aria-hidden />
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={estilo}>
      {conteudo}
    </a>
  ) : (
    <button type="button" onClick={onClick} style={estilo}>
      {conteudo}
    </button>
  );
}

/** The venue map, tilting up into place as it scrolls in, with the "open in Maps" button under it. */
export function MapaInclinado() {
  const mobile = useIsMobile();
  const reduzido = usePrefersReducedMotion();
  const { ref, progresso } = useProgressoRolagem<HTMLDivElement>('passagem');
  const entrada = reduzido ? 1 : trecho(progresso, 0, 0.45);

  return (
    <>
      <div
        ref={ref}
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--stroke-hair)',
          background: 'var(--ink-850)',
          transform: `perspective(1400px) rotateX(${((1 - entrada) * 14).toFixed(2)}deg) scale(${(0.92 + entrada * 0.08).toFixed(3)})`,
          opacity: 0.3 + entrada * 0.7,
          transformOrigin: '50% 100%',
          willChange: 'transform',
        }}
      >
        <MapEmbed height={mobile ? 320 : 460} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        <Button variant="secondary" as="a" href={MAPS_LINK} target="_blank" rel="noopener noreferrer">
          Abrir no Maps
        </Button>
      </div>
    </>
  );
}

/** A big section headline in the invitation's serif. */
export function Titulo({ children, como = 'h2', tamanho = 'var(--fs-display-3)' }: { children: ReactNode; como?: 'h1' | 'h2'; tamanho?: string }) {
  const Tag = como;
  return (
    <Tag
      className="texto-prata"
      style={{
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: tamanho,
        lineHeight: 'var(--lh-snug)',
        letterSpacing: 'var(--tracking-display)',
        textWrap: 'balance' as never,
      }}
    >
      {children}
    </Tag>
  );
}
