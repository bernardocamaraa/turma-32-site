import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Baile } from './pages/Baile';
import { Album } from './pages/Album';
import { Rsvp } from './pages/Rsvp';
import { Comissao } from './pages/Comissao';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
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
        <Route path="/album" element={<Album />} />
        <Route path="/rsvp" element={<Rsvp />} />
        <Route path="/comissao" element={<Comissao />} />
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
