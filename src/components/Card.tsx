import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

type Variant = 'wall' | 'outline' | 'invert' | 'tagged';

// Rounded tiles on a raised surface, the way Apple's dark pages group
// content. 'tagged' (the old graffiti-sticker card) now reads as the same
// tile with a slightly brighter edge, so existing callers keep working.
const SKINS: Record<Variant, { background: string; border: string; color: string }> = {
  wall: { background: 'var(--ink-850)', border: '1px solid var(--stroke-hair)', color: 'var(--text-primary)' },
  outline: { background: 'transparent', border: '1px solid var(--stroke-muted)', color: 'var(--text-primary)' },
  invert: { background: 'var(--chalk-050)', border: '1px solid var(--chalk-050)', color: '#000000' },
  tagged: { background: 'var(--ink-850)', border: '1px solid var(--stroke-muted)', color: 'var(--text-primary)' },
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
  /** Marks the card as the one to act on: a hairline of the accent color around it. */
  accent?: boolean;
  interactive?: boolean;
  padding?: string | number;
  style?: CSSProperties;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const [hover, setHover] = useState(false);
  const k = SKINS[variant] || SKINS.wall;

  return (
    <div
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding,
        borderRadius: 'var(--radius-lg)',
        ...k,
        border: accent ? '1px solid rgba(169,211,232,.45)' : k.border,
        transform: interactive && hover ? 'scale(1.015)' : 'none',
        boxShadow: interactive && hover ? '0 24px 60px rgba(0,0,0,.5)' : 'none',
        transition: 'transform var(--dur-slow) var(--ease-out), box-shadow var(--dur-slow) var(--ease-out), border-color var(--dur) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
