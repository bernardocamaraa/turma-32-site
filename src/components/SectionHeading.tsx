import type { ReactNode } from 'react';
import { useReveal } from '../lib/useReveal';

export function SectionEyebrowRule({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        style={{
          fontFamily: 'var(--font-core)',
          fontSize: 'var(--fs-label)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--accent)',
        }}
      >
        {children}
      </span>
      <div
        style={{
          width: 56,
          height: 2,
          background: 'var(--accent)',
          transformOrigin: 'left',
          animation: 'om-rule 620ms var(--ease-out) 120ms both',
        }}
      />
    </>
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
  const cell = (value: string, label: string, tone?: string) => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: size > 40 ? 'center' : undefined }}>
      <span
        key={tone ? value : undefined}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1,
          color: tone,
          animation: tone ? 'om-tick 900ms var(--ease-out)' : undefined,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: size > 40 ? 'var(--space-7)' : 'var(--space-6)' }}>
      {cell(dias, 'dias')}
      {cell(horas, 'horas')}
      {cell(min, 'min')}
      {cell(seg, 'seg', 'var(--accent)')}
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
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-7)' }}
    >
      <SectionEyebrowRule>{eyebrow}</SectionEyebrowRule>
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'var(--fs-display-3)',
          lineHeight: 'var(--lh-tight)',
          letterSpacing: 'var(--tracking-display)',
        }}
      >
        {title}
      </h1>
    </div>
  );
}
