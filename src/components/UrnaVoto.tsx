import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { precarregarSomDaUrna, tocarSomDaUrna } from '../lib/somDaUrna';
import { usePrefersReducedMotion } from '../lib/useViewport';
import { Button } from './Button';

// The scene: an electronic ballot box like the real one (UE2022), seen from
// the front, drawn in these units (the SVG's viewBox) and scaled to fit.
const CENA = { largura: 260, altura: 228 };
// Its screen, where the vote shows as it's typed.
const TELA = { x: 55, y: 14, largura: 152, altura: 89 };
const MEIO_DA_TELA = { x: TELA.x + TELA.largura / 2, y: TELA.y + TELA.altura / 2 };
const FONTE = 'Arial, Helvetica, sans-serif';

// When each key is pressed: 3 then 2 (or BRANCO), then CONFIRMA, and the
// screen says FIM. Each key beeps; CONFIRMA plays the whole sound.
const T = { primeira: 1050, segunda: 1600, confirma: 2500, fim: 2620, texto: 3200 };
const FECHA_SOZINHO_MS = 7500;
const SAIDA_MS = 200;

// A small copy of the class's 32 (the original is 1.4 MB), for the candidate's photo.
const LOGO = '/assets/logo-32-pequena.png';

/** Loads the logo and the sound ahead, so the box has them the moment it shows. Call it while the ballot is being filled in. */
export function precarregarUrna() {
  new Image().src = LOGO;
  precarregarSomDaUrna();
}

const CORES_CONFETE = ['var(--state-ok)', 'var(--ice-300)', 'var(--chalk-050)', 'var(--ice-500)'];

/** The confetti pieces, fixed so every vote looks the same: spread upwards out of the screen. */
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

type Tecla = { rotulo: string; x: number; y: number; largura: number; altura: number; cor: string; tinta: string };

// The keypad as on the real one: black numbers, 0 under the middle column,
// and BRANCO, CORRIGE and a tall CONFIRMA beside them.
const NUMEROS: Tecla[] = '1234567890'.split('').map((rotulo, i) => ({
  rotulo,
  x: 114 + (rotulo === '0' ? 1 : i % 3) * 22,
  y: 128 + (rotulo === '0' ? 3 : Math.floor(i / 3)) * 18,
  largura: 17.5,
  altura: 12.7,
  cor: '#1d1d1f',
  tinta: '#f5f5f7',
}));
const BRANCO: Tecla = { rotulo: 'BRANCO', x: 180, y: 128, largura: 26, altura: 12.7, cor: '#f7f7f5', tinta: '#1d1d1f' };
const CORRIGE: Tecla = { rotulo: 'CORRIGE', x: 180, y: 146, largura: 26, altura: 12.7, cor: '#f26a1b', tinta: '#1d1d1f' };
const CONFIRMA: Tecla = { rotulo: 'CONFIRMA', x: 180, y: 164.5, largura: 26, altura: 30.5, cor: '#5fae63', tinta: '#0c1a10' };

/** The keys pressed, in order, and when. */
function apertos(emBranco: boolean): { tecla: Tecla; quando: number }[] {
  return [
    ...(emBranco
      ? [{ tecla: BRANCO, quando: T.primeira }]
      : [
          { tecla: NUMEROS[2], quando: T.primeira },
          { tecla: NUMEROS[1], quando: T.segunda },
        ]),
    { tecla: CONFIRMA, quando: T.confirma },
  ];
}

/**
 * Confirms a ballot that just went in: an electronic ballot box where 3 and 2
 * are typed (BRANCO, for a blank vote), then CONFIRMA, with the box's own
 * sounds, and its screen says FIM. Tapping anywhere or Esc closes it right
 * away; it also closes by itself. The vote is already counted when this
 * shows — closing early changes nothing. With reduced motion, the box just
 * shows with FIM on its screen.
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
    // A beep on each key and the whole sound on CONFIRMA (just that, right away, when nothing moves).
    const sons = reduzido
      ? [setTimeout(() => void tocarSomDaUrna('confirma'), 0)]
      : apertos(emBranco).map(({ tecla, quando }) => setTimeout(() => void tocarSomDaUrna(tecla === CONFIRMA ? 'confirma' : 'tecla'), quando));
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', tecla);
    return () => {
      clearTimeout(auto);
      sons.forEach(clearTimeout);
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
      // Lets what sits under it know it's up (the ballot preview leaves Esc to it).
      data-urna=""
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
      <div role="status" aria-live="polite" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)', textAlign: 'center' }}>
        <Cena emBranco={emBranco} />
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

/** The box, the glow and the confetti. Decorative: the words say it all for a screen reader. */
function Cena({ emBranco }: { emBranco: boolean }) {
  // Where FIM shows, in % of the scene: the glow and the confetti come from there.
  const meio = { left: `${(MEIO_DA_TELA.x / CENA.largura) * 100}%`, top: `${(MEIO_DA_TELA.y / CENA.altura) * 100}%` };
  return (
    <div aria-hidden style={{ position: 'relative', width: 'min(340px, 100%)' }}>
      {/* A green glow behind the screen as it says FIM. */}
      <div
        style={{
          ...absoluto,
          left: `calc(${meio.left} - 150px)`,
          top: `calc(${meio.top} - 150px)`,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(127,185,138,.42) 0%, rgba(127,185,138,0) 62%)',
          opacity: 0,
          animation: `urna-brilho 1400ms var(--ease-out) ${T.fim}ms both`,
        }}
      />

      <div style={{ position: 'relative', transformOrigin: '50% 100%', animation: 'urna-entra 820ms cubic-bezier(.2,.8,.3,1) both' }}>
        <Urna emBranco={emBranco} />
      </div>

      {/* Confetti bursting out of the screen. */}
      {CONFETE.map((c, i) => (
        <span
          key={i}
          style={
            {
              ...absoluto,
              left: `calc(${meio.left} - ${c.largura / 2}px)`,
              top: `calc(${meio.top} - ${c.altura / 2}px)`,
              width: c.largura,
              height: c.altura,
              borderRadius: c.redondo ? '50%' : 2,
              background: c.cor,
              opacity: 0,
              willChange: 'transform, opacity',
              '--dx': `${c.dx}px`,
              '--dy': `${c.dy}px`,
              '--giro': `${c.giro}deg`,
              animation: `urna-confete ${c.duracao}ms ${T.fim + 20 + c.atraso}ms both`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * The ballot box: a light grey shell, the screen in its black frame on top,
 * the keypad below, and the class's name where the real one has the
 * electoral court's. The keys pressed sink in under a fingertip.
 */
function Urna({ emBranco }: { emBranco: boolean }) {
  const lista = apertos(emBranco);
  const quando = (t: Tecla) => lista.find((a) => a.tecla === t)?.quando;
  return (
    <svg viewBox={`0 0 ${CENA.largura} ${CENA.altura}`} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="urna-casco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eeeff1" />
          <stop offset="1" stopColor="#d9dadd" />
        </linearGradient>
      </defs>
      {/* Its thickness under the front, and the front. */}
      <rect x={4} y={9} width={252} height={218} rx={7} fill="#9fa1a6" />
      <rect x={4} y={4} width={252} height={218} rx={7} fill="url(#urna-casco)" stroke="#c4c6ca" strokeWidth={0.8} />
      {/* The keypad's face, a step below the screen's. */}
      <path d="M4 117 H256" stroke="#c4c6ca" strokeWidth={0.8} />
      <path d="M4 118.2 H256" stroke="#f7f8f9" strokeWidth={0.8} />

      {/* The screen in its frame. */}
      <rect x={40} y={8} width={182} height={105} rx={2} fill="#141416" />
      <Tela emBranco={emBranco} />

      {/* Where the real one has the electoral court's mark, the class's — in the plastic. */}
      <rect x={43} y={149.5} width={60.6} height={29.3} rx={2} fill="none" stroke="#b3b5ba" strokeWidth={0.7} />
      <text x={73.3} y={164} dy=".36em" textAnchor="middle" fontSize={11} fontWeight={700} fontFamily={FONTE} fill="none" stroke="#a3a5aa" strokeWidth={0.45}>
        Turma 32
      </text>
      <rect x={43} y={181} width={60.6} height={14} rx={2} fill="none" stroke="#b3b5ba" strokeWidth={0.7} />
      <text x={73.3} y={188} dy=".36em" textAnchor="middle" fontSize={8} fontFamily={FONTE} fill="none" stroke="#a3a5aa" strokeWidth={0.4}>
        UE2026
      </text>

      {[...NUMEROS, BRANCO, CORRIGE, CONFIRMA].map((t) => (
        <Tecla key={t.rotulo} tecla={t} aperta={quando(t)} />
      ))}
      {/* The fingertip, over every key. */}
      {lista.map(({ tecla, quando }) => (
        <circle
          key={tecla.rotulo}
          cx={tecla.x + tecla.largura / 2}
          cy={tecla.y + tecla.altura / 2}
          r={10}
          // Tinted, so it shows on the white key as on the black ones.
          fill="rgba(132,188,218,.45)"
          stroke="rgba(169,211,232,.95)"
          strokeWidth={0.8}
          opacity={0}
          style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `urna-toque 560ms ease-out ${quando - 190}ms both` }}
        />
      ))}

      {/* Vents along the bottom. */}
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={31 + i * 13} y={216.5} width={6} height={1.6} rx={0.8} fill="#b9bbbf" />
      ))}
    </svg>
  );
}

/** A key: its side shows under it until it's pressed in at `aperta` (ms). Labels and Braille dots as on the real one. */
function Tecla({ tecla, aperta }: { tecla: Tecla; aperta?: number }) {
  const { x, y, largura, altura } = tecla;
  const numero = tecla.rotulo.length === 1;
  const apertar = (nome: string) => (aperta === undefined ? undefined : `${nome} 260ms ease-out ${aperta - 70}ms both`);
  return (
    <>
      <rect x={x} y={y + 1.6} width={largura} height={altura} rx={1.6} fill="rgba(0,0,0,.4)" />
      <g style={{ animation: apertar('urna-tecla') }}>
        <rect x={x} y={y} width={largura} height={altura} rx={1.6} fill={tecla.cor} />
        <text
          x={numero ? x + 5.5 : x + largura / 2}
          y={numero ? y + altura / 2 : y + 4.4}
          dy=".36em"
          textAnchor="middle"
          fontSize={numero ? 8 : 4.3}
          fontWeight={700}
          fontFamily={FONTE}
          fill={tecla.tinta}
        >
          {tecla.rotulo}
        </text>
        <Braille
          x={numero ? x + 10.5 : x + largura / 2 - 3}
          y={numero ? y + 3.6 : y + 8.2}
          texto={tecla.rotulo}
          cor={numero ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.35)'}
        />
        {aperta === undefined ? null : (
          <rect x={x} y={y} width={largura} height={altura} rx={1.6} fill="#000" opacity={0} style={{ animation: apertar('urna-tecla-sombra') }} />
        )}
      </g>
    </>
  );
}

/** Raised dots like the keys' Braille: a few cells, each from the label's letters (decorative, not real Braille). */
function Braille({ x, y, texto, cor }: { x: number; y: number; texto: string; cor: string }) {
  const celulas = texto.length === 1 ? [texto.charCodeAt(0)] : [texto.charCodeAt(0), texto.charCodeAt(1), texto.charCodeAt(2)];
  return (
    <>
      {celulas.flatMap((codigo, c) =>
        Array.from({ length: 6 }, (_, p) =>
          (codigo >> p) & 1 || p === 0 ? (
            <circle key={`${c}-${p}`} cx={x + c * 2.6 + (p % 2) * 1.1} cy={y + Math.floor(p / 2) * 1.1} r={0.36} fill={cor} />
          ) : null,
        ),
      )}
    </>
  );
}

/**
 * The screen, as the real one goes: "SEU VOTO PARA" and the number's boxes,
 * filled as the keys are pressed — then the candidate (the class, with its 32
 * as the photo) and how to confirm. A blank vote says "VOTO EM BRANCO". Once
 * confirmed, it all goes and FIM shows.
 */
function Tela({ emBranco }: { emBranco: boolean }) {
  const texto = { fontFamily: FONTE, fill: '#1d1d1f' };
  const aparece = (quando: number): CSSProperties => ({ animation: `urna-aparece 180ms ease-out ${quando}ms both` });
  // The candidate and the instructions, once the number is complete (or BRANCO pressed).
  const completo = (emBranco ? T.primeira : T.segunda) + 160;
  const esquerda = TELA.x + 5;
  return (
    <>
      <rect x={TELA.x} y={TELA.y} width={TELA.largura} height={TELA.altura} fill="#e6f1f0" />
      <g opacity={0} style={{ animation: `urna-some 140ms ease-in ${T.confirma + 40}ms both` }}>
        <text x={esquerda} y={22} fontSize={5} fontWeight={700} {...texto}>
          SEU VOTO PARA
        </text>
        <text x={MEIO_DA_TELA.x - (emBranco ? 0 : 18)} y={33} textAnchor="middle" fontSize={8} fontWeight={700} {...texto}>
          Formatura
        </text>
        {emBranco ? (
          <text x={MEIO_DA_TELA.x} y={MEIO_DA_TELA.y} dy=".36em" textAnchor="middle" fontSize={11} fontWeight={700} {...texto} style={aparece(T.primeira + 40)}>
            VOTO EM BRANCO
          </text>
        ) : (
          <>
            <text x={esquerda} y={50} fontSize={5} {...texto}>
              Número:
            </text>
            {['3', '2'].map((digito, i) => (
              <g key={digito}>
                <rect x={82 + i * 12} y={40.5} width={10} height={13} fill="#fff" stroke="#1d1d1f" strokeWidth={0.6} />
                <text
                  x={87 + i * 12}
                  y={47}
                  dy=".36em"
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  {...texto}
                  style={{ animation: `urna-digito 140ms ease-out ${(i ? T.segunda : T.primeira) + 20}ms both` }}
                >
                  {digito}
                </text>
              </g>
            ))}
            <g style={aparece(completo)}>
              <text x={esquerda} y={66} fontSize={5} {...texto}>
                Nome:
              </text>
              <text x={esquerda + 17} y={66} fontSize={6.5} fontWeight={700} {...texto}>
                Turma 32
              </text>
              <rect x={166} y={21} width={34} height={41} fill="#fff" stroke="#1d1d1f" strokeWidth={0.5} />
              <image href={LOGO} x={168} y={23} width={30} height={37} preserveAspectRatio="xMidYMid meet" />
            </g>
          </>
        )}
        <g style={aparece(completo)}>
          <path d={`M${TELA.x} 78 H${TELA.x + TELA.largura}`} stroke="#1d1d1f" strokeWidth={0.4} />
          <text x={esquerda} y={85} fontSize={4.2} {...texto}>
            Aperte a tecla:
          </text>
          <text x={esquerda + 4} y={91} fontSize={4.2} {...texto}>
            <tspan fontWeight={700}>VERDE</tspan> para CONFIRMAR este voto
          </text>
          <text x={esquerda + 4} y={97} fontSize={4.2} {...texto}>
            <tspan fontWeight={700}>LARANJA</tspan> para REINICIAR este voto
          </text>
        </g>
      </g>
      <text
        x={MEIO_DA_TELA.x}
        y={MEIO_DA_TELA.y}
        dy=".36em"
        textAnchor="middle"
        fontSize={36}
        fontWeight={700}
        {...texto}
        style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `urna-fim 520ms cubic-bezier(.2,.8,.3,1) ${T.fim}ms both` }}
      >
        FIM
      </text>
    </>
  );
}
