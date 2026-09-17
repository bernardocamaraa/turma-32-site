import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useIsMobile } from '../lib/useViewport';

const LINKS = [
  { to: '/', label: 'Início' },
  { to: '/baile', label: 'O baile' },
  // A turma escondida até termos a assinatura de todo mundo — voltar a
  // listar aqui quando o resto chegar.
  // Álbum escondido enquanto o Supabase está pausado (reativa só daqui a
  // 90 dias) — voltar a listar aqui quando o banco estiver de novo no ar.
];

export function NavBar() {
  const location = useLocation();
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
          {/* The site is informational only — no CTA here; the date is the
              one thing worth carrying on every screen. */}
          {!mobile ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '.18em',
                color: 'var(--text-faint)',
                whiteSpace: 'nowrap',
              }}
            >
              10.12.2026 · 19H
            </span>
          ) : (
            <button
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open}
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
          )}
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.18em', color: 'var(--text-faint)' }}>
            10.12.2026 · 19H
          </span>
        </nav>
      ) : null}
    </header>
  );
}
