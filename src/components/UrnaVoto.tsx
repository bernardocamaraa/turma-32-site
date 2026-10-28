import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/useViewport';
import { Button } from './Button';

// The scene, in px. The box's slot sits at FENDA: the paper is cut off there
// as it drops, so it looks like it goes in.
const CENA = { largura: 220, altura: 248 };
const URNA = { largura: 168, altura: 128, topo: 116 };
const FENDA = URNA.topo + 18;
const PAPEL = { largura: 64, altura: 84, topo: 22 };

// Each step starts after the last one: the paper shows up, folds in half,
// drops into the slot, the box takes it in, and the check pops.
const T = { aparece: 0, dobra: 520, cai: 1060, engole: 1460, check: 1640, texto: 1780 };
const FECHA_SOZINHO_MS = 4600;

// A small copy of the class's 32 (the original is 1.4 MB), for the box's front.
const LOGO = '/assets/logo-32-pequena.png';

/** Loads the logo ahead, so the box has it the moment it shows. Call it while the ballot is being filled in. */
export function precarregarUrna() {
  new Image().src = LOGO;
}
const SAIDA_MS = 200;

/**
 * Confirms a ballot that just went in: the vote turns into a paper ballot
 * that folds and drops into a ballot box, then a check. A blank vote is a
 * blank paper. Tapping anywhere or Esc closes it right away; it also closes
 * by itself. The vote is already counted when this shows — closing early
 * changes nothing. With reduced motion, the box and the check just appear.
 */
export function UrnaVoto({ quantos, emBranco, onFim }: { quantos: number; emBranco: boolean; onFim: () => void }) {
  const reduzido = usePrefersReducedMotion();
  const [saindo, setSaindo] = useState(false);
  const fim = useRef(onFim);
  fim.current = onFim;

  function fechar() {
    setSaindo(true);
  }

  useEffect(() => {
    const auto = setTimeout(fechar, FECHA_SOZINHO_MS);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', tecla);
    return () => {
      clearTimeout(auto);
      window.removeEventListener('keydown', tecla);
    };
  }, []);

  // Removed on a timer, not on animationend: with animations off that event never comes.
  useEffect(() => {
    if (!saindo) return;
    const t = setTimeout(() => fim.current(), reduzido ? 0 : SAIDA_MS);
    return () => clearTimeout(t);
  }, [saindo, reduzido]);

  const titulo = emBranco
    ? quantos > 1
      ? 'Seus votos em branco estão na urna.'
      : 'Seu voto em branco está na urna.'
    : quantos > 1
      ? 'Seus votos estão na urna.'
      : 'Seu voto está na urna.';

  return createPortal(
    <div
      onClick={fechar}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--gutter-page)',
        background: 'var(--overlay-scrim)',
        backdropFilter: 'var(--blur-scrim)',
        WebkitBackdropFilter: 'var(--blur-scrim)',
        animation: saindo ? `urna-sai ${SAIDA_MS}ms var(--ease-in-out) both` : 'om-fade-in 220ms var(--ease-out) both',
        cursor: 'pointer',
      }}
    >
      <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)', textAlign: 'center' }}>
        <Cena reduzido={reduzido} emBranco={emBranco} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: '30ch', animation: `urna-texto 420ms var(--ease-out) ${T.texto}ms both` }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>
            {titulo}
          </span>
          <span style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
            Obrigado por ajudar a fazer essa escolha!
          </span>
        </div>
        <Button variant="ghost" onClick={fechar} style={{ animation: `urna-texto 420ms var(--ease-out) ${T.texto + 120}ms both` }}>
          Fechar
        </Button>
      </div>
    </div>,
    document.body,
  );
}

/** The box, the paper and the check. Decorative: the words say it all for a screen reader. */
function Cena({ reduzido, emBranco }: { reduzido: boolean; emBranco: boolean }) {
  return (
    <div aria-hidden style={{ position: 'relative', width: CENA.largura, height: CENA.altura }}>
      <svg
        width={URNA.largura}
        height={URNA.altura}
        viewBox={`0 0 ${URNA.largura} ${URNA.altura}`}
        style={{
          position: 'absolute',
          left: (CENA.largura - URNA.largura) / 2,
          top: URNA.topo,
          overflow: 'visible',
          transformOrigin: '50% 100%',
          animation: `urna-entra 420ms var(--ease-out) both, urna-engole 340ms var(--ease-snap) ${T.engole}ms`,
        }}
      >
        {/* The front, then the lid seen from slightly above, with the slot in it. */}
        {/* Square on top, where the lid sits on it, rounded only at the bottom:
            the lid's corners meet the box's exactly. */}
        <path
          d="M2 26 H166 V114 A12 12 0 0 1 154 126 H14 A12 12 0 0 1 2 114 Z"
          fill="var(--ink-800)"
          stroke="rgba(169,211,232,.38)"
          strokeLinejoin="round"
        />
        <path d="M16 8 H152 L166 26 H2 Z" fill="var(--wall-500)" stroke="rgba(169,211,232,.38)" strokeLinejoin="round" />
        <rect x="46" y="14" width="76" height="8" rx="4" fill="var(--ink-950)" />
        {/* The class's 32 on the front. */}
        <image href={LOGO} x="51" y="36" width="66" height="78" preserveAspectRatio="xMidYMid meet" />
      </svg>

      {reduzido ? null : (
        // Everything below the slot is inside the box: cut the paper off there.
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: FENDA, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              left: (CENA.largura - PAPEL.largura) / 2,
              top: PAPEL.topo,
              width: PAPEL.largura,
              height: PAPEL.altura,
              animation: `cedula-aparece 420ms var(--ease-out) ${T.aparece}ms both`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                perspective: 320,
                animation: `cedula-cai 420ms cubic-bezier(.55,0,1,.45) ${T.cai}ms both`,
              }}
            >
              <Metade parte="baixo" emBranco={emBranco} />
              {/* The top half folds down over the bottom one, showing its back. */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: PAPEL.altura / 2,
                  transformOrigin: '50% 100%',
                  transformStyle: 'preserve-3d',
                  animation: `cedula-dobra 480ms var(--ease-in-out) ${T.dobra}ms both`,
                }}
              >
                <Metade parte="cima" emBranco={emBranco} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    // The back of the paper, a little shaded: it reads as a fold.
                    background: 'linear-gradient(180deg, var(--chalk-100), #d6d6dc)',
                    borderRadius: '4px 4px 0 0',
                    transform: 'rotateX(180deg)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: CENA.largura / 2 - 26,
          top: 44,
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--gild-400)',
          color: '#000000',
          boxShadow: '0 0 0 8px rgba(201,169,106,.16)',
          animation: `urna-check 460ms cubic-bezier(.34,1.56,.64,1) ${T.check}ms both`,
        }}
      >
        <Check size={28} strokeWidth={2.6} />
      </div>
    </div>
  );
}

/**
 * Half of the paper ballot: a header line on top, then rows with a box each,
 * spaced evenly across the fold (a row every 15px). A blank vote has no box
 * marked.
 */
function Metade({ parte, emBranco }: { parte: 'cima' | 'baixo'; emBranco: boolean }) {
  const linhas = parte === 'cima' ? [false, true] : [true, false];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: parte === 'cima' ? 0 : PAPEL.altura / 2,
        width: '100%',
        height: PAPEL.altura / 2,
        boxSizing: 'border-box',
        padding: parte === 'cima' ? '6px 9px 0' : '3px 9px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'var(--chalk-050)',
        borderRadius: parte === 'cima' ? '4px 4px 0 0' : '0 0 4px 4px',
        boxShadow: parte === 'baixo' ? '0 10px 24px rgba(0,0,0,.35)' : undefined,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {parte === 'cima' ? <div style={{ width: 26, height: 3, borderRadius: 2, background: 'var(--gild-500)' }} /> : null}
      {linhas.map((marcada, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 9,
              height: 9,
              flex: '0 0 auto',
              borderRadius: 2,
              border: '1.5px solid rgba(0,0,0,.4)',
              background: marcada && !emBranco ? 'var(--ink-900)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {marcada && !emBranco ? <Check size={7} strokeWidth={4} color="var(--chalk-050)" /> : null}
          </div>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'rgba(0,0,0,.16)' }} />
        </div>
      ))}
    </div>
  );
}
