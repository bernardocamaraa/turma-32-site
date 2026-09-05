import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

type Variant = 'wall' | 'outline' | 'invert' | 'tagged';

const SKINS: Record<Variant, { background: string; border: string; color: string }> = {
  wall: { background: 'var(--bg-elev)', border: '1px solid var(--stroke-hair)', color: 'var(--text-primary)' },
  outline: { background: 'transparent', border: '2px solid var(--chalk-050)', color: 'var(--text-primary)' },
  invert: { background: 'var(--chalk-050)', border: '2px solid var(--chalk-050)', color: 'var(--ink-900)' },
  tagged: { background: 'var(--bg-elev)', border: '2px solid var(--chalk-050)', color: 'var(--text-primary)' },
};

export function Card({
  variant = 'wall',
  accent = false,
  interactive = false,
  padding = 'var(--space-6)',
  style,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  accent?: boolean;
  interactive?: boolean;
  padding?: string | number;
  style?: CSSProperties;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const [hover, setHover] = useState(false);
  const k = SKINS[variant] || SKINS.wall;
  const off = variant === 'tagged' ? 6 : 0;

  return (
    <div
      className={[variant === 'tagged' ? 'card-tag-shadow' : '', className].filter(Boolean).join(' ') || undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding,
        borderRadius: 'var(--radius-sm)',
        ...k,
        boxShadow: off ? (interactive && hover ? '8px 8px 0 var(--ice-300)' : '6px 6px 0 var(--ice-300)') : 'none',
        transform: interactive && hover ? 'translate(-2px,-2px)' : 'none',
        borderLeft: accent ? '3px solid var(--accent)' : k.border,
        transition: 'transform var(--dur) var(--ease-out),box-shadow var(--dur) var(--ease-out),border-color var(--dur) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
