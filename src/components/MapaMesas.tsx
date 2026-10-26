import { useEffect, useId, type CSSProperties, type KeyboardEvent } from 'react';
import { FORMANDOS } from '../lib/formandos';
import { ESCADA, PISTA, POSICOES_MESAS, type Mesa, type PosicaoMesa, type Reserva } from '../lib/mesas';

// Drawn in the same 602×336 space the venue's floor plan uses, so positions
// in lib/mesas.ts (stored as %) convert back with a single multiply.
const W = 602;
const H = 336;

// At rest a table is just its outline, the names of who sits there and a
// fill that rises with occupancy. The seats only show on the open table.
const R_MESA = 21;
const RET = { w: 34, h: 84 };

// The open table: how much it grows, and where its seats sit (in the
// table's own coordinates, before scaling).
const ESCALA = { redonda: 1.9, retangular: 1.6 } as const;
const R_LUGARES = 27;
const R_LUGAR = 3;

type EstadoLugar = 'meu' | 'outro' | 'livre';

const COR_LUGAR: Record<EstadoLugar, { fill: string; stroke: string }> = {
  meu: { fill: 'var(--gild-400)', stroke: 'var(--gild-400)' },
  outro: { fill: 'var(--ice-300)', stroke: 'var(--ice-300)' },
  livre: { fill: 'var(--ink-900)', stroke: 'var(--smoke-400)' },
};

/**
 * The name shown on the map — the shortest form no classmate shares: the
 * first name ("Enzo"), else first name and surname initial ("Bernardo C."),
 * else first name and surname ("Maria Bispo" vs "Maria Barroso").
 */
function formasCurtas(nome: string): string[] {
  const partes = nome.split(' ');
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return [primeiro, `${primeiro} ${ultimo[0]}.`, `${primeiro} ${ultimo}`];
}

const APELIDOS = new Map(
  FORMANDOS.map((nome) => {
    const formas = formasCurtas(nome);
    const unica = formas.find((forma, i) => !FORMANDOS.some((outro) => outro !== nome && formasCurtas(outro)[i] === forma));
    return [nome, unica ?? nome];
  }),
);

const apelido = (nome: string) => APELIDOS.get(nome) ?? nome.split(' ')[0];

/** Seat positions around a table, centered on (0,0). */
function lugaresEmVolta(p: PosicaoMesa, capacidade: number): { x: number; y: number }[] {
  if (p.formato === 'retangular') {
    const porLado = Math.ceil(capacidade / 2);
    const passo = (RET.h - 12) / porLado;
    return Array.from({ length: capacidade }, (_, i) => {
      const lado = i < porLado ? -1 : 1;
      const k = i % porLado;
      return { x: lado * (RET.w / 2 + 7), y: -RET.h / 2 + 6 + passo * (k + 0.5) };
    });
  }
  return Array.from({ length: capacidade }, (_, i) => {
    const a = (i / capacidade) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(a) * R_LUGARES, y: Math.sin(a) * R_LUGARES };
  });
}

/** How far the open table reaches from its center, after scaling — used to keep it inside the map. */
function alcance(p: PosicaoMesa): { x: number; y: number } {
  const s = ESCALA[p.formato];
  if (p.formato === 'retangular') return { x: (RET.w / 2 + 11) * s, y: (RET.h / 2 + 4) * s };
  return { x: (R_LUGARES + R_LUGAR + 2) * s, y: (R_LUGARES + R_LUGAR + 2) * s };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

type MesaDesenhada = {
  p: PosicaoMesa;
  mesa: Mesa;
  cx: number;
  cy: number;
  /** Who sits here, own seats first. */
  daMesa: Reserva[];
  ocupados: number;
  minha: boolean;
};

/** The table itself: outline, rising fill and names. Drawn centered on (0,0). */
function CorpoMesa({ d, formando, clipId }: { d: MesaDesenhada; formando: string; clipId: string }) {
  const { p, mesa, daMesa, ocupados, minha } = d;
  const redonda = p.formato === 'redonda';
  const meiaAltura = redonda ? R_MESA : RET.h / 2;
  const nivel = Math.min(ocupados / mesa.capacidade, 1);
  const cheia = ocupados >= mesa.capacidade;
  const contorno: CSSProperties = {
    fill: 'none',
    stroke: minha ? 'var(--gild-400)' : cheia ? 'var(--ice-300)' : 'var(--stroke-muted)',
    strokeWidth: minha ? 1.6 : 1.2,
    strokeDasharray: mesa.reservada_para ? '3 3' : undefined,
  };

  // Up to three lines fit inside a round table; past that, "+N".
  const maxLinhas = redonda ? 3 : 6;
  const nomes = daMesa.length > maxLinhas ? daMesa.slice(0, maxLinhas - 1) : daMesa;
  const resto = daMesa.length - nomes.length;
  const linhas = [
    ...nomes.map((r) => ({ texto: apelido(r.formando), meu: r.formando === formando })),
    ...(resto > 0 ? [{ texto: `+${resto}`, meu: false }] : []),
  ];
  const passo = 8.5;

  return (
    <>
      <clipPath id={clipId}>
        {redonda ? <circle r={R_MESA} /> : <rect x={-RET.w / 2} y={-RET.h / 2} width={RET.w} height={RET.h} rx={3} />}
      </clipPath>
      {redonda ? (
        <circle r={R_MESA} style={{ fill: 'var(--ink-850)' }} />
      ) : (
        <rect x={-RET.w / 2} y={-RET.h / 2} width={RET.w} height={RET.h} rx={3} style={{ fill: 'var(--ink-850)' }} />
      )}
      {/* The table fills from the bottom as seats are taken. */}
      <rect
        clipPath={`url(#${clipId})`}
        x={-RET.w}
        y={meiaAltura - nivel * meiaAltura * 2}
        width={RET.w * 2}
        height={nivel * meiaAltura * 2}
        style={{ fill: minha ? 'rgba(201,169,106,.2)' : 'rgba(169,211,232,.16)', transition: 'y var(--dur-slow) var(--ease-out), height var(--dur-slow) var(--ease-out)' }}
      />
      {redonda ? (
        <circle r={R_MESA} style={contorno} />
      ) : (
        <rect x={-RET.w / 2} y={-RET.h / 2} width={RET.w} height={RET.h} rx={3} style={contorno} />
      )}
      {linhas.map((l, i) => (
        <text
          key={i}
          x={0}
          y={(i - (linhas.length - 1) / 2) * passo}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: l.meu ? 'var(--gild-300)' : 'var(--text-primary)',
            fontFamily: 'var(--font-core)',
            // Archivo's narrow width (the site loads its wdth axis) fits
            // names inside a table without shrinking them to unreadable.
            fontStretch: '72%',
            fontSize: 7.5,
            fontWeight: l.meu ? 600 : 500,
            // A dark halo keeps names readable over the fill and the outline.
            stroke: 'var(--ink-850)',
            strokeWidth: 2.4,
            paintOrder: 'stroke',
          }}
        >
          {l.texto}
        </text>
      ))}
    </>
  );
}

export function MapaMesas({
  mesas,
  reservas,
  formando,
  selecionada,
  onSelecionar,
}: {
  mesas: Mesa[];
  reservas: Reserva[];
  /** Whose seats to paint gold. */
  formando: string;
  selecionada: string | null;
  /** Called with a table id to open it, or null to close the open one. */
  onSelecionar: (id: string | null) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const porId = new Map(mesas.map((m) => [m.id, m]));

  const desenhadas: MesaDesenhada[] = POSICOES_MESAS.flatMap((p) => {
    const mesa = porId.get(p.id);
    if (!mesa) return [];
    const daMesa = reservas
      .filter((r) => r.mesa === p.id)
      .sort((a, b) => (a.formando === formando ? -1 : b.formando === formando ? 1 : a.formando.localeCompare(b.formando, 'pt-BR')));
    return [
      {
        p,
        mesa,
        cx: (p.x / 100) * W,
        cy: (p.y / 100) * H,
        daMesa,
        ocupados: daMesa.reduce((s, r) => s + r.lugares, 0),
        minha: daMesa.some((r) => r.formando === formando),
      },
    ];
  });
  const aberta = desenhadas.find((d) => d.p.id === selecionada) ?? null;

  useEffect(() => {
    if (!selecionada) return;
    const fechar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onSelecionar(null);
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [selecionada, onSelecionar]);

  function teclado(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelecionar(id);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label="Mapa das mesas"
      style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', overflow: 'visible' }}
    >
      <rect
        x={(PISTA.x / 100) * W}
        y={(PISTA.y / 100) * H}
        width={(PISTA.w / 100) * W}
        height={(PISTA.h / 100) * H}
        style={{ fill: 'rgba(169,211,232,.06)', stroke: 'var(--stroke-hair)', strokeWidth: 1 }}
      />
      <text
        x={((PISTA.x + PISTA.w / 2) / 100) * W}
        y={((PISTA.y + PISTA.h / 2) / 100) * H}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: 24 }}
      >
        Pista
      </text>

      <text
        x={(ESCADA.x / 100) * W}
        y={(ESCADA.y / 100) * H}
        textAnchor="middle"
        style={{ fill: 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: 13 }}
      >
        Escada
      </text>
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} style={{ fill: 'var(--stroke-muted)' }}>
          <circle cx={30 + i * 35} cy={276 - i * 8} r={1.6} />
          <circle cx={30 + i * 35} cy={318} r={1.6} />
        </g>
      ))}

      {desenhadas.map((d) => (
        <g
          key={d.p.id}
          role="button"
          tabIndex={0}
          aria-pressed={selecionada === d.p.id}
          aria-label={`Mesa ${d.p.id}${d.daMesa.length ? `: ${d.daMesa.map((r) => r.formando).join(', ')}` : ', vazia'}. ${d.ocupados} de ${d.mesa.capacidade} lugares ocupados.`}
          onClick={() => onSelecionar(d.p.id)}
          onKeyDown={(e) => teclado(e, d.p.id)}
          transform={`translate(${d.cx} ${d.cy})`}
          style={{ cursor: 'pointer', outline: 'none' }}
        >
          {/* Invisible hit area a little larger than the drawing, so small tables are easy to tap. */}
          <rect
            x={-25}
            y={d.p.formato === 'retangular' ? -46 : -25}
            width={50}
            height={d.p.formato === 'retangular' ? 92 : 50}
            style={{ fill: 'transparent' }}
          />
          <CorpoMesa d={d} formando={formando} clipId={`${uid}-${d.p.id}`} />
        </g>
      ))}

      <RotuloProfessores desenhadas={desenhadas} />

      {aberta ? <MesaAberta key={aberta.p.id} d={aberta} formando={formando} uid={uid} onFechar={() => onSelecionar(null)} /> : null}
    </svg>
  );
}

/** The teachers' table is the only one named on the map. */
function RotuloProfessores({ desenhadas }: { desenhadas: MesaDesenhada[] }) {
  const p = desenhadas.find((d) => d.mesa.reservada_para === 'professores');
  if (!p) return null;
  return (
    <text
      x={p.cx}
      y={p.cy + R_MESA + 12}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fill: 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: 11, pointerEvents: 'none' }}
    >
      Professores
    </text>
  );
}

/**
 * The open table: the rest of the map dims, the table grows from where it
 * sits (nudged inward if it would spill off the edge) and its seats pop in
 * one by one around it — gold for the viewer's, blue for classmates', empty
 * for free ones. Clicking the dimmed map closes it.
 */
function MesaAberta({ d, formando, uid, onFechar }: { d: MesaDesenhada; formando: string; uid: string; onFechar: () => void }) {
  const s = ESCALA[d.p.formato];
  const a = alcance(d.p);
  const x1 = clamp(d.cx, a.x + 4, W - a.x - 4);
  const y1 = clamp(d.cy, a.y + 4, H - a.y - 4);

  const estados: EstadoLugar[] = d.daMesa.flatMap((r) => Array<EstadoLugar>(r.lugares).fill(r.formando === formando ? 'meu' : 'outro'));
  while (estados.length < d.mesa.capacidade) estados.push('livre');

  return (
    <>
      <rect
        x={-20}
        y={-20}
        width={W + 40}
        height={H + 40}
        onClick={onFechar}
        style={{ fill: 'rgba(5,5,8,.72)', cursor: 'pointer', animation: 'om-fade-in 220ms var(--ease-out) both' }}
      />
      <g
        style={
          {
            '--x0': `${d.cx}px`,
            '--y0': `${d.cy}px`,
            transform: `translate(${x1}px, ${y1}px) scale(${s})`,
            animation: 'mesa-abre 420ms var(--ease-snap) both',
            pointerEvents: 'none',
          } as CSSProperties
        }
      >
        <CorpoMesa d={d} formando={formando} clipId={`${uid}-${d.p.id}-aberta`} />
        {lugaresEmVolta(d.p, d.mesa.capacidade).map((pos, i) => (
          <circle
            key={i}
            className="mesa-lugar"
            cx={pos.x}
            cy={pos.y}
            r={R_LUGAR}
            style={{
              fill: COR_LUGAR[estados[i]].fill,
              stroke: COR_LUGAR[estados[i]].stroke,
              strokeWidth: 0.8,
              animation: `mesa-lugar 260ms var(--ease-snap) ${180 + i * 35}ms backwards`,
            }}
          />
        ))}
      </g>
    </>
  );
}
