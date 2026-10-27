import { Link, useLocation } from 'react-router-dom';

/**
 * Switches between the two parts of the formandos' area — the table map and
 * the vote — keeping the same personal link (or, for the committee, the
 * same code-protected pages). A segmented control, Apple-style.
 */
export function AbasArea({ link }: { link?: string }) {
  const { pathname } = useLocation();
  const abas = [
    { rotulo: 'Mesas', para: link ? `/mesas/${link}` : '/mesas', ativa: pathname.startsWith('/mesas') },
    { rotulo: 'Votação', para: link ? `/votacao/${link}` : '/votacao', ativa: pathname.startsWith('/votacao') },
  ];

  return (
    <nav
      aria-label="Área dos formandos"
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        gap: 2,
        padding: 3,
        borderRadius: 'var(--radius-pill)',
        background: 'rgba(245,245,247,.08)',
        marginTop: 'calc(-1 * var(--space-5))',
      }}
    >
      {abas.map((a) => (
        <Link
          key={a.rotulo}
          to={a.para}
          aria-current={a.ativa ? 'page' : undefined}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 'var(--fs-body-sm)',
            fontWeight: 500,
            textDecoration: 'none',
            color: a.ativa ? '#000' : 'var(--text-muted)',
            background: a.ativa ? 'var(--chalk-050)' : 'transparent',
            transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)',
          }}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
