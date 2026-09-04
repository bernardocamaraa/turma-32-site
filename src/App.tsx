import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
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

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-950)', fontFamily: 'var(--font-core)' }}>
      <ScrollToTop />
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/baile" element={<Baile />} />
        <Route path="/album" element={<Album />} />
        <Route path="/rsvp" element={<Rsvp />} />
        <Route path="/comissao" element={<Comissao />} />
      </Routes>
      <Footer />
    </div>
  );
}
