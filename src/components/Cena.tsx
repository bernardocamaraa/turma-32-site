import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { MapEmbed, MAPS_LINK } from './MapEmbed';
import { trecho, useProgressoRolagem } from '../lib/motion';
import { useReveal } from '../lib/useReveal';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

/** Building blocks shared by the Apple-style pages (Home, Baile). */

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
          background: destaque
            ? 'radial-gradient(120% 140% at 0% 0%, rgba(169,211,232,.16) 0%, rgba(169,211,232,0) 55%), var(--ink-850)'
            : 'var(--ink-850)',
          border: '1px solid var(--stroke-hair)',
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

export function Grande({ children, tamanho }: { children: ReactNode; tamanho: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: tamanho,
        lineHeight: 1.02,
        letterSpacing: '-.035em',
        textWrap: 'balance' as never,
      }}
    >
      {children}
    </span>
  );
}

/** Apple's text link: accent color with a small chevron. Opens `href` in a new tab, or runs `onClick`. */
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

/** A big section headline with the silver fade. */
export function Titulo({ children, como = 'h2', tamanho = 'var(--fs-display-3)' }: { children: ReactNode; como?: 'h1' | 'h2'; tamanho?: string }) {
  const Tag = como;
  return (
    <Tag
      className="texto-prata"
      style={{
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: tamanho,
        lineHeight: 'var(--lh-tight)',
        letterSpacing: 'var(--tracking-display)',
        textWrap: 'balance' as never,
      }}
    >
      {children}
    </Tag>
  );
}
