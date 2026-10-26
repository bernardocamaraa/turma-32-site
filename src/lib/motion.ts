import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './useViewport';

/**
 * How far the page has scrolled through an element, from 0 to 1 — the
 * engine behind the scroll-linked scenes (Apple-style: the scroll position
 * drives the animation, it doesn't just trigger it).
 *
 * - 'fixo': for a tall section with a `position: sticky` child. 0 when the
 *   section's top reaches the top of the viewport, 1 when its bottom does —
 *   i.e. the stretch during which the sticky child stays pinned.
 * - 'passagem': for an ordinary element. 0 when its top enters at the bottom
 *   of the viewport, 1 when its bottom leaves at the top.
 *
 * Only listens to scroll while the element is near the viewport, updates at
 * most once per frame, and with reduced motion it just reports 1 (every
 * scene's final, fully readable state).
 */
export function useProgressoRolagem<T extends HTMLElement>(modo: 'fixo' | 'passagem' = 'fixo') {
  const ref = useRef<T | null>(null);
  const reduzido = usePrefersReducedMotion();
  const [progresso, setProgresso] = useState(reduzido ? 1 : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduzido) {
      setProgresso(1);
      return;
    }

    let raf = 0;
    const medir = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = modo === 'fixo' ? -r.top / Math.max(r.height - vh, 1) : (vh - r.top) / (vh + r.height);
      setProgresso(Math.min(Math.max(p, 0), 1));
    };
    const agendar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };

    let ouvindo = false;
    const ligar = (sim: boolean) => {
      if (sim === ouvindo) return;
      ouvindo = sim;
      if (sim) {
        window.addEventListener('scroll', agendar, { passive: true });
        window.addEventListener('resize', agendar);
        agendar();
      } else {
        window.removeEventListener('scroll', agendar);
        window.removeEventListener('resize', agendar);
      }
    };

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => ligar(e.isIntersecting), { rootMargin: '20% 0px 20% 0px' })
        : null;
    if (observer) observer.observe(el);
    else ligar(true);
    medir();

    return () => {
      observer?.disconnect();
      ligar(false);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [modo, reduzido]);

  return { ref, progresso };
}

/** Maps `p` from the range [de, ate] onto 0..1, clamped — for staging parts of one scene. */
export function trecho(p: number, de: number, ate: number): number {
  return Math.min(Math.max((p - de) / (ate - de), 0), 1);
}
