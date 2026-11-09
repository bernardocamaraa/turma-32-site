import { useEffect, useState } from 'react';
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
  // Mesas fica fora do menu: cada formando entra pelo link pessoal que a
  // comissão manda, e a comissão entra pela área dela.
];

const ALTURA = 52;

/**
 * A thin translucent bar, the way Apple's global nav sits over the page:
 * whatever scrolls under it shows through, blurred. On a phone the links
 * open as a full-screen sheet, each one sliding in after the last.
 */
export function NavBar() {
  const location = useLocation();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Close the sheet on navigation, and don't let the page scroll under it.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, [open]);

  const link = (on: boolean) => ({
    fontSize: 13,
    fontWeight: on ? 500 : 400,
    color: on ? 'var(--chalk-050)' : 'rgba(245,245,247,.72)',
    textDecoration: 'none',
    transition: 'color var(--dur) var(--ease-out)',
  });

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: open ? '#000' : 'rgba(22,22,23,.72)',
        backdropFilter: 'var(--blur-scrim)',
        WebkitBackdropFilter: 'var(--blur-scrim)',
        borderBottom: '1px solid var(--stroke-hair)',
        transition: 'background var(--dur-slow) var(--ease-out)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--maxw-page)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-7)',
          height: ALTURA,
          padding: '0 var(--gutter-page)',
        }}
      >
        <Link to="/" aria-label="Início" style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
          <img src="/assets/logo-terceirao.png" alt="Terceirão 32" style={{ height: 26, width: 'auto', display: 'block' }} />
        </Link>

        {!mobile ? (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-7)' }}>
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} style={link(location.pathname === l.to)}>
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {/* The site is informational only — no CTA here; the date is the
            one thing worth carrying on every screen. */}
        {!mobile ? (
          <span style={{ fontSize: 13, color: 'rgba(245,245,247,.56)', whiteSpace: 'nowrap' }}>10 de dezembro · 19h</span>
        ) : (
          <button
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              marginRight: -10,
              background: 'transparent',
              border: 'none',
              color: 'var(--chalk-050)',
              cursor: 'pointer',
            }}
          >
            {open ? <X size={20} strokeWidth={1.6} /> : <Menu size={20} strokeWidth={1.6} />}
          </button>
        )}
      </div>

      {mobile && open ? (
        <nav
          style={{
            position: 'fixed',
            top: ALTURA,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
            padding: 'var(--space-7) var(--gutter-page)',
          }}
        >
          {LINKS.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-.02em',
                color: location.pathname === l.to ? 'var(--chalk-050)' : 'rgba(245,245,247,.72)',
                textDecoration: 'none',
                animation: `om-fade-up 600ms var(--ease-out) ${80 + i * 60}ms both`,
              }}
            >
              {l.label}
            </Link>
          ))}
          <span
            style={{
              marginTop: 'var(--space-5)',
              fontSize: 15,
              color: 'var(--text-faint)',
              animation: `om-fade-up 600ms var(--ease-out) ${80 + LINKS.length * 60}ms both`,
            }}
          >
            10 de dezembro · 19h · Ballroom, Nova Iguaçu
          </span>
        </nav>
      ) : null}
    </header>
  );
}
