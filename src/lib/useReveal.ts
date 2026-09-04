import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Fades an element up once it scrolls into view. Falls back to always-visible
 * when the browser lacks IntersectionObserver or the user asked for reduced motion.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(_id?: string, delayMs = 0) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      setReady(false);
      return;
    }
    setReady(true);
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const className = ready ? `reveal${visible ? ' is-in' : ''}` : 'reveal no-motion';

  return {
    ref,
    className,
    style: visible && delayMs ? { animationDelay: `${delayMs}ms` } : undefined,
  };
}
