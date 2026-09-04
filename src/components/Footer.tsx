import { Link } from 'react-router-dom';
import { useReveal } from '../lib/useReveal';

export function Footer() {
  const reveal = useReveal('footer');

  return (
    <footer
      ref={reveal.ref}
      className={reveal.className}
      style={{ borderTop: '1px solid var(--stroke-hair)', padding: 'var(--space-8) var(--gutter-page)' }}
    >
      <div
        style={{
          maxWidth: 'var(--maxw-page)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
          <img
            src="/assets/logo-32.png"
            alt="Turma 32"
            style={{ width: 'auto', height: 48, objectFit: 'contain', opacity: 0.32 }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', color: 'var(--text-faint)' }}>
            Formatura 2026 · Comissão de formatura
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          10.12.2026 · 19h
        </span>
        <Link
          to="/comissao"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          Área da comissão
        </Link>
      </div>
    </footer>
  );
}
