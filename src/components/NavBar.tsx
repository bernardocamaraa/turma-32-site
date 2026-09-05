import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { useIsMobile } from '../lib/useViewport';

const LINKS = [
  { to: '/', label: 'Início' },
  { to: '/baile', label: 'O baile' },
  { to: '/album', label: 'Álbum' },
];

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const linkStyle = (on: boolean, compact: boolean) => ({
    fontFamily: 'var(--font-core)',
    fontSize: compact ? 14 : 'var(--fs-body-sm)',
    fontWeight: 500,
    letterSpacing: compact ? '.04em' : 'var(--tracking-wide)',
    textTransform: 'uppercase' as const,
    color: on ? 'var(--text-primary)' : 'var(--text-muted)',
    textDecoration: 'none',
    borderBottom: on && !compact ? '2px solid var(--accent)' : '2px solid transparent',
    paddingBottom: compact ? 0 : 4,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(10,10,12,.86)',
        backdropFilter: 'var(--blur-scrim)',
        WebkitBackdropFilter: 'var(--blur-scrim)',
        borderBottom: '1px solid var(--stroke-hair)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: mobile ? 'var(--space-4)' : 'var(--space-7)',
          height: mobile ? 64 : 76,
          padding: mobile ? '0 var(--space-5)' : '0 var(--gutter-page)',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', textDecoration: 'none', flex: '0 0 auto' }}>
          <img src="/assets/logo-terceirao.png" alt="Terceirão 32" style={{ height: mobile ? 32 : 44, width: 'auto', display: 'block' }} />
        </Link>

        {!mobile ? (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-7)' }}>
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} style={linkStyle(location.pathname === l.to, false)}>
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: '0 0 auto' }}>
          <Button size="sm" onClick={() => navigate('/rsvp')} style={mobile ? { padding: '0 10px', fontSize: 10 } : undefined}>
            {mobile ? 'CONFIRMAR' : 'CONFIRMAR PRESENÇA'}
          </Button>
          {mobile ? (
            <button
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                background: 'transparent',
                border: '2px solid var(--stroke-muted)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--chalk-050)',
                cursor: 'pointer',
                flex: '0 0 auto',
              }}
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          ) : null}
        </div>
      </div>

      {mobile && open ? (
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
            padding: 'var(--space-5) var(--space-5) var(--space-6)',
            borderTop: '1px solid var(--stroke-hair)',
          }}
        >
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} style={linkStyle(location.pathname === l.to, true)}>
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
