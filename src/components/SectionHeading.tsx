import type { ReactNode } from 'react';
import { useReveal } from '../lib/useReveal';

/**
 * The small line above a headline that says what the section is about —
 * Apple's "eyebrow": accent-colored, sentence case, no rule or caps.
 */
export function SectionEyebrowRule({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-body-lg)',
        fontWeight: 600,
        letterSpacing: '-.01em',
        color: 'var(--accent)',
      }}
    >
      {children}
    </span>
  );
}

export function CountdownRow({
  dias,
  horas,
  min,
  seg,
  size = 40,
}: {
  dias: string;
  horas: string;
  min: string;
  seg: string;
  size?: number;
}) {
  // clamp() so four two-digit numbers plus gaps always fit a narrow phone;
  // the big (home page) one is sized to the width so all four stay on one
  // line even on a 320px phone.
  const fontSize = size > 40 ? `clamp(36px, 13vw, ${size}px)` : `clamp(28px, ${(size / 5).toFixed(2)}vw, ${size}px)`;
  const gapSize = size > 40 ? 'clamp(12px, 4vw, 56px)' : 'clamp(16px, 4vw, 36px)';

  const cell = (value: string, label: string) => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: size > 40 ? 'center' : undefined }}>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '-.03em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{label}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: gapSize, flexWrap: 'wrap', justifyContent: size > 40 ? 'center' : undefined }}>
      {cell(dias, 'dias')}
      {cell(horas, 'horas')}
      {cell(min, 'minutos')}
      {cell(seg, 'segundos')}
    </div>
  );
}

export function PageHeader({ eyebrow, title, id }: { eyebrow: string; title: ReactNode; id?: string }) {
  const reveal = useReveal<HTMLDivElement>(id);
  return (
    <div
      ref={reveal.ref}
      className={reveal.className}
      id={id}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-7)' }}
    >
      <SectionEyebrowRule>{eyebrow}</SectionEyebrowRule>
      <h1
        className="texto-prata"
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 'var(--fs-display-3)',
          lineHeight: 'var(--lh-tight)',
          letterSpacing: 'var(--tracking-display)',
          textWrap: 'balance' as never,
        }}
      >
        {title}
      </h1>
    </div>
  );
}
