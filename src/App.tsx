import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Baile } from './pages/Baile';
import { Album } from './pages/Album';
import { Turma } from './pages/Turma';
import { Comissao } from './pages/Comissao';

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
    // boundary instead of staying stuck until a full reload.
    <ErrorBoundary key={pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/baile" element={<Baile />} />
        <Route path="/turma" element={<Turma />} />
        <Route path="/album" element={<Album />} />
        <Route path="/comissao" element={<Comissao />} />
        {/* Any old link (a shared /rsvp URL, a typo) lands on the home page
            instead of a blank screen. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-950)', fontFamily: 'var(--font-core)' }}>
      <ScrollToTop />
      <NavBar />
      <AppRoutes />
      <Footer />
    </div>
  );
}
