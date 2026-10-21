import type { KeyboardEvent } from 'react';
import { ESCADA, PISTA, POSICOES_MESAS, type Mesa, type PosicaoMesa, type Reserva } from '../lib/mesas';

// Drawn in the same 602×336 space the venue's floor plan uses, so positions
// in lib/mesas.ts (stored as %) convert back with a single multiply.
const W = 602;
const H = 336;

const R_MESA = 15;
const R_LUGARES = 21;
const R_LUGAR = 3.2;

type EstadoLugar = 'meu' | 'outro' | 'livre';

const COR_LUGAR: Record<EstadoLugar, { fill: string; stroke: string }> = {
  meu: { fill: 'var(--gild-400)', stroke: 'var(--gild-400)' },
  outro: { fill: 'var(--ice-300)', stroke: 'var(--ice-300)' },
  livre: { fill: 'transparent', stroke: 'var(--stroke-muted)' },
};

/** Where each seat dot goes: a ring around round tables, two rows along rectangles. */
function posicoesLugares(p: PosicaoMesa, capacidade: number): { x: number; y: number }[] {
  const cx = (p.x / 100) * W;
  const cy = (p.y / 100) * H;
  if (p.formato === 'retangular') {
    const porLado = Math.ceil(capacidade / 2);
    const passo = 80 / porLado;
    return Array.from({ length: capacidade }, (_, i) => {
      const lado = i < porLado ? -1 : 1;
      const k = i % porLado;
      return { x: cx + lado * 20, y: cy - 40 + passo * (k + 0.5) };
    });
  }
  return Array.from({ length: capacidade }, (_, i) => {
    const a = (i / capacidade) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * R_LUGARES, y: cy + Math.sin(a) * R_LUGARES };
  });
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
  onSelecionar: (id: string) => void;
}) {
  const porId = new Map(mesas.map((m) => [m.id, m]));

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
      style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }}
    >
      <rect
        x={(PISTA.x / 100) * W}
        y={(PISTA.y / 100) * H}
        width={(PISTA.w / 100) * W}
        height={(PISTA.h / 100) * H}
        style={{ fill: 'rgba(169,211,232,.08)', stroke: 'var(--stroke-muted)', strokeWidth: 1.5 }}
      />
      <text
        x={((PISTA.x + PISTA.w / 2) / 100) * W}
        y={((PISTA.y + PISTA.h / 2) / 100) * H}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 26 }}
      >
        Pista
      </text>

      <text
        x={(ESCADA.x / 100) * W}
        y={(ESCADA.y / 100) * H}
        textAnchor="middle"
        style={{ fill: 'var(--text-faint)', fontFamily: 'var(--font-core)', fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase' }}
      >
        Escada
      </text>
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} style={{ fill: 'var(--stroke-muted)' }}>
          <circle cx={30 + i * 35} cy={276 - i * 8} r={2} />
          <circle cx={30 + i * 35} cy={318} r={2} />
        </g>
      ))}

      {POSICOES_MESAS.map((p) => {
        const mesa = porId.get(p.id);
        if (!mesa) return null;
        const daMesa = reservas
          .filter((r) => r.mesa === p.id)
          // Own seats first so they read as one block of gold on the ring.
          .sort((a, b) => (a.formando === formando ? -1 : b.formando === formando ? 1 : a.formando.localeCompare(b.formando, 'pt-BR')));
        const lugares: EstadoLugar[] = daMesa.flatMap((r) => Array<EstadoLugar>(r.lugares).fill(r.formando === formando ? 'meu' : 'outro'));
        const ocupados = lugares.length;
        while (lugares.length < mesa.capacidade) lugares.push('livre');
        const cheia = ocupados >= mesa.capacidade;
        const ativa = selecionada === p.id;
        const minha = daMesa.some((r) => r.formando === formando);
        const cx = (p.x / 100) * W;
        const cy = (p.y / 100) * H;
        const rotulo =
          mesa.reservada_para === 'professores' ? 'Professores' : mesa.reservada_para === 'comissao' ? 'Comissão' : null;

        return (
          <g
            key={p.id}
            role="button"
            tabIndex={0}
            aria-pressed={ativa}
            aria-label={`Mesa ${p.id}${rotulo ? ` (${rotulo})` : ''}: ${ocupados} de ${mesa.capacidade} lugares ocupados`}
            onClick={() => onSelecionar(p.id)}
            onKeyDown={(e) => teclado(e, p.id)}
            style={{ cursor: 'pointer', outline: 'none' }}
          >
            {/* Invisible hit area larger than the drawing, so small tables are easy to tap. */}
            <rect x={cx - 25} y={cy - (p.formato === 'retangular' ? 46 : 25)} width={50} height={p.formato === 'retangular' ? 92 : 50} style={{ fill: 'transparent' }} />
            {p.formato === 'retangular' ? (
              <rect
                x={cx - 13}
                y={cy - 42}
                width={26}
                height={84}
                rx={2}
                style={{
                  fill: cheia ? 'rgba(169,211,232,.22)' : 'var(--ink-800)',
                  stroke: ativa ? 'var(--chalk-050)' : minha ? 'var(--gild-400)' : 'var(--stroke-muted)',
                  strokeWidth: ativa ? 2.5 : 1.5,
                  strokeDasharray: mesa.reservada_para ? '4 3' : undefined,
                }}
              />
            ) : (
              <circle
                cx={cx}
                cy={cy}
                r={R_MESA}
                style={{
                  fill: cheia ? 'rgba(169,211,232,.22)' : 'var(--ink-800)',
                  stroke: ativa ? 'var(--chalk-050)' : minha ? 'var(--gild-400)' : 'var(--stroke-muted)',
                  strokeWidth: ativa ? 2.5 : 1.5,
                  strokeDasharray: mesa.reservada_para ? '4 3' : undefined,
                }}
              />
            )}
            {posicoesLugares(p, mesa.capacidade).map((pos, i) => (
              <circle
                key={i}
                cx={pos.x}
                cy={pos.y}
                r={R_LUGAR}
                style={{ fill: COR_LUGAR[lugares[i]].fill, stroke: COR_LUGAR[lugares[i]].stroke, strokeWidth: 1 }}
              />
            ))}
            <text
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}
            >
              {p.id}
            </text>
            <text
              x={cx}
              y={cy + 7}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: cheia ? 'var(--ice-300)' : 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 7 }}
            >
              {ocupados}/{mesa.capacidade}
            </text>
            {rotulo ? (
              // Above R1, below R2 and P — the gaps beside them are too
              // narrow (dance floor on one side, the next table on the other).
              <text
                x={cx}
                y={p.id === 'R1' ? cy - 52 : cy + (p.formato === 'retangular' ? 54 : 32)}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fill: 'var(--text-faint)', fontFamily: 'var(--font-core)', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase' }}
              >
                {rotulo}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
