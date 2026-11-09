import type { CSSProperties, ReactNode } from 'react';

type Tone = 'neutral' | 'ice' | 'gild' | 'ok' | 'error' | 'accent';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'rgba(245,245,247,.1)', fg: 'var(--chalk-050)' },
  ice: { bg: 'rgba(169,211,232,.14)', fg: 'var(--ice-300)' },
  accent: { bg: 'rgba(169,211,232,.14)', fg: 'var(--ice-300)' },
  gild: { bg: 'rgba(201,169,106,.16)', fg: 'var(--gild-300)' },
  ok: { bg: 'rgba(127,185,138,.14)', fg: 'var(--state-ok)' },
  error: { bg: 'rgba(255,105,97,.14)', fg: 'var(--state-error)' },
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
        height: 26,
        padding: '0 12px',
        background: t.bg,
        color: t.fg,
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-core)',
        fontSize: 13,
        fontWeight: 500,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
