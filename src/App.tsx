import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Carregando } from './components/Carregando';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Baile } from './pages/Baile';
import { Album } from './pages/Album';
import { Turma } from './pages/Turma';
import { Mesas } from './pages/Mesas';

// Loaded when opened, so they don't weigh on every visitor's first load: the
// vote is reached through its own link, the committee area is committee only.
const Votacao = lazy(() => import('./pages/Votacao').then((m) => ({ default: m.Votacao })));
const Comissao = lazy(() => import('./pages/Comissao').then((m) => ({ default: m.Comissao })));

// Where the committee's pages used to be, before they became tabs of the
// committee area — old links, bookmarks and the vote notification still land
// on the right tab.
const ANTIGOS: [string, string][] = [
  ['/votacao/comissao', '/comissao/votacao'],
  ['/mesas', '/comissao/mesas'],
  ...['/infancia', '/infância', '/fotos-de-crianca', '/fotos-de-criança', '/fotos-infancia', '/fotos-infância'].map(
    (p): [string, string] => [p, '/comissao/fotos-de-crianca'],
  ),
];

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // Links like /baile#traje come from the home page shortcuts: without
    // this, React Router changes the route but the browser never scrolls to
    // the anchor (it only does that on a real page load).
    if (hash) {
      const alvo = document.getElementById(hash.slice(1));
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function AppRoutes() {
  const { pathname } = useLocation();
  return (
    // Keyed by route so navigating away from a crashed page resets the
    // boundary instead of staying stuck until a full reload. The committee
    // area counts as one page — switching its tabs mustn't log out — and has
    // a boundary of its own per tab.
    <ErrorBoundary key={pathname.startsWith('/comissao') ? '/comissao' : pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/baile" element={<Baile />} />
        <Route path="/turma" element={<Turma />} />
        <Route path="/album" element={<Album />} />
        <Route
          path="/comissao/*"
          element={
            <Suspense fallback={<Carregando tela />}>
              <Comissao />
            </Suspense>
          }
        />
        <Route path="/mesas/:link" element={<Mesas />} />
        <Route
          path="/votacao"
          element={
            <Suspense fallback={<Carregando tela />}>
              <Votacao />
            </Suspense>
          }
        />
        {/* Personal voting links existed briefly; anyone opening one lands
            on the single voting link. */}
        <Route path="/votacao/:link" element={<Navigate to="/votacao" replace />} />
        {ANTIGOS.map(([de, para]) => (
          <Route key={de} path={de} element={<Navigate to={para} replace />} />
        ))}
        {/* Any old link (a shared /rsvp URL, a typo) lands on the home page
            instead of a blank screen. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <div className="app" style={{ background: 'var(--ink-950)', fontFamily: 'var(--font-core)' }}>
      <ScrollToTop />
      <NavBar />
      <div className="app-conteudo">
        <AppRoutes />
      </div>
      <Footer />
    </div>
  );
}
