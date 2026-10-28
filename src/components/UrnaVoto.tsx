import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/useViewport';
import { Button } from './Button';

// The scene, in px. The box is drawn in two layers, its back behind the paper
// and its front over it, so the paper can fly anywhere and, dropping into
// the slot (at FENDA), really goes in.
const CENA = { largura: 220, altura: 248 };
const URNA = { largura: 168, altura: 128, topo: 116 };
const FENDA = URNA.topo + 18;
// Where the paper ends up, right over the slot, before it drops in.
const PAPEL = { largura: 64, altura: 84, topo: 22 };

// The paper's whole trip, one animation per axis (cedula-voo-x/-y and
// cedula-giro in global.css, in % of VOO_MS): it flies up from below (where
// "Enviar" was) to beside the box, floats there while it folds, and glides
// in one arc over the box and down into the slot. The steps overlap so it
// never stops: the box squashes as it goes in, its lid hops, confetti bursts
// out of the slot, and the check rises from it.
// engole: when the folded paper is all the way in (worked out from the glide's curve).
const VOO_MS = 2800;
const DOBRA_MS = 620;
const T = { aparece: 200, dobra: 200 + 0.2 * VOO_MS, engole: 2670, confete: 2690, check: 2800, texto: 3250 };
const FECHA_SOZINHO_MS = 7500;
const SAIDA_MS = 200;

// A small copy of the class's 32 (the original is 1.4 MB), for the box's front.
const LOGO = '/assets/logo-32-pequena.png';

/** Loads the logo ahead, so the box has it the moment it shows. Call it while the ballot is being filled in. */
export function precarregarUrna() {
  new Image().src = LOGO;
}

// Confirmation is green, like "Você já votou" on the page.
const VERDE = 'var(--state-ok)';
const CORES_CONFETE = ['var(--state-ok)', 'var(--ice-300)', 'var(--chalk-050)', 'var(--ice-500)'];

/** The confetti pieces, fixed so every vote looks the same: spread upwards out of the slot. */
const CONFETE = Array.from({ length: 18 }, (_, i) => {
  const angulo = (-160 + (140 / 17) * i) * (Math.PI / 180);
  const distancia = 80 + ((i * 37) % 70);
  const redondo = i % 3 === 0;
  return {
    dx: Math.round(Math.cos(angulo) * distancia),
    dy: Math.round(Math.sin(angulo) * distancia) - 20,
    giro: (i % 2 ? 1 : -1) * (200 + ((i * 53) % 300)),
    largura: redondo ? 7 : 6,
    altura: redondo ? 7 : 11,
    redondo,
    cor: CORES_CONFETE[i % CORES_CONFETE.length],
    duracao: 1250 + ((i * 41) % 320),
    atraso: (i * 13) % 90,
  };
});

/**
 * Confirms a ballot that just went in: the vote turns into a paper ballot
 * that folds and drops into a ballot box, then a green check. A blank vote is
 * a blank paper. Tapping anywhere or Esc closes it right away; it also closes
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

  const entraTexto = (atraso: number) => `urna-texto 640ms cubic-bezier(.2,.8,.3,1) ${T.texto + atraso}ms both`;

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
        // Solid, not blurred: a blur behind a moving scene costs frames on a phone.
        background: 'rgba(0,0,0,.95)',
        overflow: 'hidden',
        animation: saindo ? `urna-sai ${SAIDA_MS}ms var(--ease-in-out) both` : 'om-fade-in 220ms var(--ease-out) both',
        cursor: 'pointer',
      }}
    >
      <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)', textAlign: 'center' }}>
        <Cena reduzido={reduzido} emBranco={emBranco} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: '30ch' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-h3)',
              fontWeight: 700,
              letterSpacing: '-.02em',
              lineHeight: 1.2,
              animation: entraTexto(0),
            }}
          >
            {titulo}
          </span>
          <span style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', animation: entraTexto(120) }}>
            Obrigado por ajudar a fazer essa escolha!
          </span>
        </div>
        <Button variant="ghost" onClick={fechar} style={{ animation: entraTexto(260) }}>
          Fechar
        </Button>
      </div>
    </div>,
    document.body,
  );
}

const absoluto: CSSProperties = { position: 'absolute' };

/** The box, the paper, the confetti and the check. Decorative: the words say it all for a screen reader. */
function Cena({ reduzido, emBranco }: { reduzido: boolean; emBranco: boolean }) {
  const centro = CENA.largura / 2;
  return (
    <div aria-hidden style={{ position: 'relative', width: CENA.largura, height: CENA.altura }}>
      {/* A green glow behind the box when the paper lands. */}
      <div
        style={{
          ...absoluto,
          left: centro - 140,
          top: FENDA - 140,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(127,185,138,.42) 0%, rgba(127,185,138,0) 62%)',
          opacity: 0,
          animation: `urna-brilho 1400ms var(--ease-out) ${T.engole}ms both`,
        }}
      />

      <Urna camada="tras" />

      {reduzido ? null : (
        <>
          <div
            style={{
              ...absoluto,
              left: (CENA.largura - PAPEL.largura) / 2,
              top: PAPEL.topo,
              width: PAPEL.largura,
              height: PAPEL.altura,
              willChange: 'transform',
              animation: `cedula-voo-x ${VOO_MS}ms ${T.aparece}ms both`,
            }}
          >
            <div style={{ ...absoluto, inset: 0, willChange: 'transform, opacity', animation: `cedula-voo-y ${VOO_MS}ms ${T.aparece}ms both` }}>
              {/* Leans around the middle of the folded paper (its bottom half). */}
              <div
                style={{
                  ...absoluto,
                  inset: 0,
                  perspective: 300,
                  transformOrigin: '50% 75%',
                  willChange: 'transform',
                  animation: `cedula-giro ${VOO_MS}ms ${T.aparece}ms both`,
                }}
              >
                <Metade parte="baixo" emBranco={emBranco}>
                  {/* The top half's shadow passing over it as it folds. */}
                  <Sombra animacao={`cedula-sombra-baixo ${DOBRA_MS}ms var(--ease-in-out) ${T.dobra}ms both`} />
                </Metade>
                {/* The top half folds down over the bottom one, showing its back. */}
                <div
                  style={{
                    ...absoluto,
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: PAPEL.altura / 2,
                    transformOrigin: '50% 100%',
                    transformStyle: 'preserve-3d',
                    willChange: 'transform',
                    animation: `cedula-dobra ${DOBRA_MS}ms var(--ease-in-out) ${T.dobra}ms both`,
                  }}
                >
                  <Metade parte="cima" emBranco={emBranco}>
                    {/* Darker as it turns away from the light… */}
                    <Sombra animacao={`cedula-sombra ${DOBRA_MS / 2}ms ease-in ${T.dobra}ms both`} />
                  </Metade>
                  <div
                    style={{
                      ...absoluto,
                      inset: 0,
                      background: 'linear-gradient(180deg, var(--chalk-100), #d6d6dc)',
                      borderRadius: '4px 4px 0 0',
                      transform: 'rotateX(180deg)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      overflow: 'hidden',
                    }}
                  >
                    {/* …and its back lighter as it lands face up. */}
                    <Sombra animacao={`cedula-luz ${DOBRA_MS / 2}ms ease-out ${T.dobra + DOBRA_MS / 2}ms both`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Urna camada="frente" />

      {reduzido ? null : (
        <>
          {/* Confetti bursting out of the slot. */}
          {CONFETE.map((c, i) => (
            <span
              key={i}
              style={
                {
                  ...absoluto,
                  left: centro - c.largura / 2,
                  top: FENDA - c.altura / 2,
                  width: c.largura,
                  height: c.altura,
                  borderRadius: c.redondo ? '50%' : 2,
                  background: c.cor,
                  opacity: 0,
                  willChange: 'transform, opacity',
                  '--dx': `${c.dx}px`,
                  '--dy': `${c.dy}px`,
                  '--giro': `${c.giro}deg`,
                  animation: `urna-confete ${c.duracao}ms ${T.confete + c.atraso}ms both`,
                } as CSSProperties
              }
            />
          ))}

          {/* Rings spreading from the check as it lands. */}
          {[0, 240].map((atraso) => (
            <div
              key={atraso}
              style={{
                ...absoluto,
                left: centro - 28,
                top: 42,
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: `2px solid ${VERDE}`,
                opacity: 0,
                // forwards, not both: while it waits its turn the ring stays hidden (its first frame is a visible ring).
                animation: `urna-onda 1200ms var(--ease-out) ${T.check + 380 + atraso}ms forwards`,
              }}
            />
          ))}
        </>
      )}

      {/* The check rises out of the slot, and its tick draws itself. */}
      <div
        style={{
          ...absoluto,
          left: centro - 28,
          top: 42,
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: VERDE,
          boxShadow: '0 0 0 8px rgba(127,185,138,.18), 0 12px 32px rgba(127,185,138,.25)',
          willChange: 'transform, opacity',
          animation: `urna-check 820ms ${T.check}ms both`,
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 9.5 17 19 7.5"
            stroke="#0c1a10"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="22"
            style={{ animation: `urna-risco 440ms var(--ease-out) ${T.check + 360}ms both` }}
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * One layer of the ballot box. "tras": the back half of the lid and the top
 * of the slot, behind the paper. "frente": the box's front with the 32, the
 * lid's front edge and the bottom of the slot, over the paper — so what goes
 * past the slot disappears into the box. Both bounce in, squash and hop
 * together: same size, same place, same animations.
 */
function Urna({ camada }: { camada: 'tras' | 'frente' }) {
  const contorno = 'rgba(169,211,232,.38)';
  // The lid hops around the middle of its front edge, in the drawing's own coordinates (both layers alike).
  const tampa: CSSProperties = { transformBox: 'view-box', transformOrigin: '84px 26px', animation: `urna-tampa 620ms var(--ease-out) ${T.engole}ms` };
  return (
    <svg
      width={URNA.largura}
      height={URNA.altura}
      viewBox={`0 0 ${URNA.largura} ${URNA.altura}`}
      style={{
        ...absoluto,
        left: (CENA.largura - URNA.largura) / 2,
        top: URNA.topo,
        overflow: 'visible',
        transformOrigin: '50% 100%',
        willChange: 'transform',
        animation: `urna-entra 820ms cubic-bezier(.2,.8,.3,1) both, urna-engole 720ms var(--ease-out) ${T.engole}ms`,
      }}
    >
      {camada === 'tras' ? (
        // The lid from its back edge to just past the slot's middle line (the front layer covers the overlap).
        <g style={tampa}>
          <path d="M16 8 H152 L160.2 18.6 H7.8 Z" fill="var(--wall-500)" />
          <path d="M8.2 18 L16 8 H152 L159.8 18" fill="none" stroke={contorno} strokeLinejoin="round" />
          <path d="M50 14 H118 A4 4 0 0 1 122 18 V18.6 H46 V18 A4 4 0 0 1 50 14 Z" fill="var(--ink-950)" />
        </g>
      ) : (
        <>
          {/* Square on top, where the lid sits on it, rounded only at the bottom:
              the lid's corners meet the box's exactly. */}
          <path d="M2 26 H166 V114 A12 12 0 0 1 154 126 H14 A12 12 0 0 1 2 114 Z" fill="var(--ink-800)" stroke={contorno} strokeLinejoin="round" />
          {/* The class's 32 on the front. */}
          <image href={LOGO} x="51" y="36" width="66" height="78" preserveAspectRatio="xMidYMid meet" />
          <g style={tampa}>
            <path d="M8.2 18 H159.8 L166 26 H2 Z" fill="var(--wall-500)" />
            <path d="M8.2 18 L2 26 H166 L159.8 18" fill="none" stroke={contorno} strokeLinejoin="round" />
            <path d="M46 18 H122 A4 4 0 0 1 118 22 H50 A4 4 0 0 1 46 18 Z" fill="var(--ink-950)" />
          </g>
        </>
      )}
    </svg>
  );
}

/** A shade over half of the paper, for the fold. Starts invisible: its animation brings it in. */
function Sombra({ animacao }: { animacao: string }) {
  return (
    <div
      style={{
        ...absoluto,
        inset: 0,
        borderRadius: 'inherit',
        background: 'linear-gradient(0deg, rgba(0,0,0,.34), rgba(0,0,0,.12))',
        opacity: 0,
        pointerEvents: 'none',
        animation: animacao,
      }}
    />
  );
}

/**
 * Half of the paper ballot: a header line on top, then rows with a box each,
 * spaced evenly across the fold (a row every 15px). A blank vote has no box
 * marked.
 */
function Metade({ parte, emBranco, children }: { parte: 'cima' | 'baixo'; emBranco: boolean; children?: ReactNode }) {
  const linhas = parte === 'cima' ? [false, true] : [true, false];
  return (
    <div
      style={{
        ...absoluto,
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
      {parte === 'cima' ? <div style={{ width: 26, height: 3, borderRadius: 2, background: 'var(--ice-500)' }} /> : null}
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
      {children}
    </div>
  );
}
