import { Link } from 'react-router-dom';

/** Small, quiet print at the bottom, with the logo stamped in gray as on the invitations. */
export function Footer() {
  return (
    <footer className="no-print" style={{ background: 'var(--ink-850)', borderTop: '1px solid var(--stroke-hair)' }}>
      <div
        style={{
          maxWidth: 'var(--maxw-page)',
          margin: '0 auto',
          padding: 'var(--space-7) var(--gutter-page) var(--space-8)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
          fontSize: 12,
          color: 'var(--text-faint)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <img src="/assets/logo-32-pequena.png" alt="" className="logo-carimbo" style={{ height: 28, width: 'auto' }} />
          <span>Turma 32 · Formatura 2026. Feito pela comissão de formatura.</span>
        </div>
        <Link to="/comissao" style={{ color: 'var(--text-faint)', textDecoration: 'none' }}>
          Área da comissão
        </Link>
      </div>
    </footer>
  );
}
