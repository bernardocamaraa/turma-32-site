import type { CSSProperties, ReactNode } from 'react';

type Tone = 'neutral' | 'ice' | 'gild' | 'ok' | 'error' | 'accent';

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: 'rgba(244,247,250,.1)', fg: 'var(--chalk-050)', bd: 'var(--stroke-muted)' },
  ice: { bg: 'rgba(169,211,232,.16)', fg: 'var(--ice-300)', bd: 'rgba(169,211,232,.5)' },
  accent: { bg: 'rgba(169,211,232,.16)', fg: 'var(--ice-300)', bd: 'rgba(169,211,232,.5)' },
  gild: { bg: 'rgba(201,169,106,.16)', fg: 'var(--gild-300)', bd: 'rgba(201,169,106,.55)' },
  ok: { bg: 'rgba(127,185,138,.14)', fg: 'var(--state-ok)', bd: 'rgba(127,185,138,.5)' },
  error: { bg: 'rgba(216,117,106,.14)', fg: 'var(--state-error)', bd: 'rgba(216,117,106,.5)' },
};

export function Badge({
  tone = 'neutral',
  children,
  style,
}: {
  tone?: Tone;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        background: t.bg,
        color: t.fg,
        border: '1px solid ' + t.bd,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
