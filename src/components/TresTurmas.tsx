import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { CHEGOU_ESTE_ANO, FORMANDOS, turmaDeOrigem, type TurmaDeOrigem } from '../lib/formandos';
import { trecho, useProgressoRolagem } from '../lib/motion';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

/**
 * "Three classes in one place", told with dots. Every graduate is a dot,
 * grouped by the class they came from (21, 22 and 23), each with its own
 * color. As the page scrolls, Isabella — who arrived this year — appears,
 * then everyone travels to their place in a big "32", the colors fade into
 * one, and Isabella lands last, right in the middle of the 3.
 *
 * Pinned like the other scenes (see lib/motion.ts); with reduced motion it
 * shows only its final state, the "32" already formed.
 */

type Ponto = [number, number];

const COR: Record<TurmaDeOrigem, string> = { 21: '#f2a6a0', 22: '#a9d3e8', 23: '#c3b4f7' };
const COR_FINAL = '#f5f5f7';

const rad = (graus: number) => (graus * Math.PI) / 180;
const naCircunferencia = (cx: number, cy: number, r: number, graus: number): Ponto => [cx + r * Math.cos(rad(graus)), cy + r * Math.sin(rad(graus))];

function arco(cx: number, cy: number, r: number, de: number, ate: number, passos = 40): Ponto[] {
  return Array.from({ length: passos + 1 }, (_, i) => naCircunferencia(cx, cy, r, de + ((ate - de) * i) / passos));
}

/** `n` points evenly spaced along a polyline, both ends included. */
function aoLongoDe(linha: Ponto[], n: number): Ponto[] {
  const trechos = linha.slice(1).map((p, i) => Math.hypot(p[0] - linha[i][0], p[1] - linha[i][1]));
  const total = trechos.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, k) => {
    let falta = (total * k) / (n - 1);
    for (let i = 0; i < trechos.length; i++) {
      if (falta <= trechos[i] || i === trechos.length - 1) {
        const t = trechos[i] ? Math.min(falta / trechos[i], 1) : 0;
        return [linha[i][0] + (linha[i + 1][0] - linha[i][0]) * t, linha[i][1] + (linha[i + 1][1] - linha[i][1]) * t];
      }
      falta -= trechos[i];
    }
    return linha[linha.length - 1];
  });
}

/**
 * The "32", drawn in a 170 × 118 box: the 3 as two bowls, the 2 as an arc,
 * a diagonal and a base. Returns the 30 places for the class, Isabella's
 * place (where the 3's bowls meet), and the strokes, to draw faintly under
 * the dots once they've arrived.
 */
function desenhoDo32() {
  const tres = [
    ...Array.from({ length: 6 }, (_, i) => naCircunferencia(40, 30, 28, -160 + (i * 250) / 6)),
    ...Array.from({ length: 8 }, (_, i) => naCircunferencia(40, 88, 32, -90 + ((i + 1) * 250) / 8)),
  ];
  const linhaDo2: Ponto[] = [...arco(140, 34, 30, -170, 40), [100, 120], [180, 120]];
  const tracos = [arco(40, 30, 28, -160, 90), arco(40, 88, 32, -90, 160), linhaDo2];
  return { lugares: [...tres, ...aoLongoDe(linhaDo2, 16)], meio: [40, 57] as Ponto, tracos };
}

/** Phyllotaxis — the sunflower pattern: a natural-looking round cluster. */
const noCacho = ([cx, cy]: Ponto, k: number): Ponto => {
  const r = 10 * Math.sqrt(k + 0.5);
  return [cx + r * Math.cos(k * 2.39996), cy + r * Math.sin(k * 2.39996)];
};

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function misturar(de: string, para: string, t: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [rgb(de), rgb(para)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

// The stage, in SVG units: wide on a computer (the classes side by side),
// tall on a phone (one above the other).
const PALCO = {
  largo: {
    w: 400, h: 260, escala: 1.35, centro: [200, 135] as Ponto,
    turmas: { 21: [70, 110], 22: [200, 110], 23: [330, 110] } as Record<TurmaDeOrigem, Ponto>,
    rotulos: { 21: [70, 180], 22: [200, 180], 23: [330, 180] } as Record<TurmaDeOrigem, Ponto>,
    novata: [200, 232] as Ponto,
  },
  alto: {
    w: 260, h: 400, escala: 1.2, centro: [130, 200] as Ponto,
    turmas: { 21: [130, 50], 22: [130, 175], 23: [130, 315] } as Record<TurmaDeOrigem, Ponto>,
    rotulos: { 21: [130, 78], 22: [130, 238], 23: [130, 365] } as Record<TurmaDeOrigem, Ponto>,
    novata: [222, 250] as Ponto,
  },
};

export function TresTurmas() {
  const mobile = useIsMobile();
  const reduzido = usePrefersReducedMotion();
  const { ref, progresso: p } = useProgressoRolagem<HTMLElement>('fixo');
  const palco = mobile ? PALCO.alto : PALCO.largo;

  const cena = useMemo(() => {
    const { lugares, meio, tracos } = desenhoDo32();
    // The 32 is drawn around (95, 61); place it at the stage's center.
    const noPalco = ([x, y]: Ponto): Ponto => [palco.centro[0] + (x - 95) * palco.escala, palco.centro[1] + (y - 61) * palco.escala];
    const naTurma: Record<TurmaDeOrigem, number> = { 21: 0, 22: 0, 23: 0 };
    const turma = FORMANDOS.filter((nome) => nome !== CHEGOU_ESTE_ANO);
    const pontos = turma.map((nome, i) => {
      const origem = turmaDeOrigem(nome) as TurmaDeOrigem;
      return {
        nome,
        origem,
        de: noCacho(palco.turmas[origem], naTurma[origem]++),
        // Places are dealt out of order (7 and 30 share no factor, so every
        // place is used once), so the classes end up mixed in the 32.
        para: noPalco(lugares[(i * 7) % turma.length]),
        // Each one sets off a little before or after the others, on a curve.
        atraso: (((i * 13) % 10) / 10) * 0.08,
        curva: (i % 2 ? 1 : -1) * (8 + ((i * 5) % 14)),
      };
    });
    const tracado = tracos.map((linha) => 'M' + linha.map((pt) => noPalco(pt).map((v) => v.toFixed(1)).join(' ')).join(' L')).join(' ');
    return { pontos, meio: noPalco(meio), tracado };
  }, [palco]);

  const raio = mobile ? 5.5 : 6;
  const entrada = trecho(p, 0, 0.1);
  const legendas = 1 - trecho(p, 0.3, 0.4);
  const novata = trecho(p, 0.32, 0.4);
  const chegadaDaNovata = suave(trecho(p, 0.5, 0.8));
  const formado = trecho(p, 0.74, 0.9);
  const [nx, ny] = [
    palco.novata[0] + (cena.meio[0] - palco.novata[0]) * chegadaDaNovata,
    palco.novata[1] + (cena.meio[1] - palco.novata[1]) * chegadaDaNovata,
  ];

  return (
    <section ref={ref} style={{ height: reduzido ? 'auto' : mobile ? '220vh' : '240vh', position: 'relative' }}>
      <div
        className={reduzido ? undefined : 'cena-fixa'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mobile ? 'var(--space-5)' : 'var(--space-7)',
          padding: reduzido ? 'var(--space-10) var(--gutter-page)' : '0 var(--gutter-page)',
        }}
      >
        {/* The three lines take turns in the same spot. */}
        <div style={{ display: 'grid', textAlign: 'center' }}>
          <Legenda opacidade={trecho(p, 0.02, 0.1) * (1 - trecho(p, 0.28, 0.34))}>Três turmas.</Legenda>
          <Legenda opacidade={trecho(p, 0.36, 0.42) * (1 - trecho(p, 0.62, 0.68))}>E a Isabella, que chegou este ano.</Legenda>
          <Legenda opacidade={formado}>Agora, uma turma só.</Legenda>
        </div>

        <svg
          aria-hidden
          viewBox={`0 0 ${palco.w} ${palco.h}`}
          style={{ display: 'block', width: '100%', maxWidth: mobile ? 420 : 900, height: mobile ? 'min(58svh, 520px)' : 'min(60svh, 585px)', overflow: 'visible' }}
        >
          <defs>
            <filter id="tres-turmas-brilho" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* The 32 itself, drawn faintly once everyone is in place. */}
          <path
            d={cena.tracado}
            fill="none"
            stroke="var(--ice-300)"
            strokeWidth={raio * 0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={formado * 0.22}
          />

          {(Object.keys(palco.rotulos) as unknown as TurmaDeOrigem[]).map((t) => (
            <text
              key={t}
              x={palco.rotulos[t][0]}
              y={palco.rotulos[t][1]}
              textAnchor="middle"
              fill={COR[t]}
              fontSize={mobile ? 11 : 10}
              fontWeight={600}
              style={{ fontFamily: 'var(--font-core)' }}
              opacity={entrada * legendas}
            >
              Turma {t}
            </text>
          ))}

          <g filter="url(#tres-turmas-brilho)">
            {cena.pontos.map((pt) => {
              const m = suave(trecho(p, 0.38 + pt.atraso, 0.7 + pt.atraso));
              const [dx, dy] = [pt.para[0] - pt.de[0], pt.para[1] - pt.de[1]];
              const comprimento = Math.hypot(dx, dy) || 1;
              const desvio = Math.sin(Math.PI * m) * pt.curva;
              const x = pt.de[0] + dx * m + (-dy / comprimento) * desvio;
              const y = pt.de[1] + dy * m + (dx / comprimento) * desvio;
              return (
                <circle
                  key={pt.nome}
                  cx={x.toFixed(2)}
                  cy={y.toFixed(2)}
                  r={raio * (0.6 + entrada * 0.4)}
                  fill={misturar(COR[pt.origem], COR_FINAL, m)}
                  opacity={entrada}
                />
              );
            })}

            {/* Isabella: a ring pulses around her until she's in place. */}
            <circle cx={nx.toFixed(2)} cy={ny.toFixed(2)} r={raio * (1 + 1.4 * (1 - chegadaDaNovata))} fill="none" stroke={COR_FINAL} strokeWidth={0.8} opacity={novata * (1 - chegadaDaNovata) * 0.6} />
            <circle cx={nx.toFixed(2)} cy={ny.toFixed(2)} r={raio} fill={COR_FINAL} opacity={novata} />
          </g>
        </svg>

        {reduzido ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', color: 'var(--text-muted)', textAlign: 'center' }}>
            A 21, a 22 e a 23, e a Isabella, que chegou este ano.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Legenda({ children, opacidade }: { children: ReactNode; opacidade: number }) {
  const estilo: CSSProperties = {
    gridArea: '1 / 1',
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 'var(--fs-h1)',
    lineHeight: 'var(--lh-snug)',
    letterSpacing: 'var(--tracking-display)',
    textWrap: 'balance' as never,
    opacity: opacidade,
    transform: `translateY(${((1 - opacidade) * 12).toFixed(1)}px)`,
  };
  return (
    <p className="texto-prata" style={estilo}>
      {children}
    </p>
  );
}
