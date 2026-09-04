import { useState, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';

type Variant = 'primary' | 'gild' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { h: string; px: number; fs: number; off: number }> = {
  sm: { h: 'var(--control-h-sm)', px: 14, fs: 11, off: 3 },
  md: { h: 'var(--control-h)', px: 22, fs: 13, off: 4 },
  lg: { h: 'var(--control-h-lg)', px: 30, fs: 15, off: 5 },
};

const SKINS: Record<Variant, { background: string; color: string; border: string; shadow: string }> = {
  primary: { background: 'var(--chalk-050)', color: 'var(--ink-900)', border: '2px solid var(--chalk-050)', shadow: 'var(--ice-300)' },
  gild: { background: 'var(--gild-400)', color: 'var(--ink-900)', border: '2px solid var(--gild-400)', shadow: 'var(--ink-950)' },
  secondary: { background: 'transparent', color: 'var(--chalk-050)', border: '2px solid var(--chalk-050)', shadow: 'var(--ice-500)' },
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '2px solid transparent', shadow: 'transparent' },
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  as?: 'button' | 'a';
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit' | 'reset';
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  as = 'button',
  href,
  target,
  rel,
  type,
  onClick,
  style,
  children,
}: ButtonProps) {
  const s = SIZES[size] || SIZES.md;
  const k = SKINS[variant] || SKINS.primary;
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const lift = disabled ? 0 : press ? 0 : hover ? 1 : 0;
  const off = disabled ? 0 : press ? 0 : s.off;

  const sharedStyle: CSSProperties = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: s.h,
    padding: '0 ' + s.px + 'px',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-core)',
    fontSize: s.fs + 'px',
    fontWeight: 600,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    background: k.background,
    color: variant === 'ghost' && hover && !disabled ? 'var(--chalk-050)' : k.color,
    border: k.border,
    borderRadius: 'var(--radius-sm)',
    boxShadow: off ? off + 'px ' + off + 'px 0 ' + k.shadow : 'none',
    transform: `translate(${press ? s.off + 'px' : lift ? '-1px' : '0'},${press ? s.off + 'px' : lift ? '-1px' : '0'})`,
    opacity: disabled ? 0.38 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform var(--dur-fast) var(--ease-out),box-shadow var(--dur-fast) var(--ease-out),color var(--dur-fast) var(--ease-out)',
    ...style,
  };

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
  };

  if (as === 'a') {
    return (
      <a href={href} target={target} rel={rel} onClick={onClick} {...handlers} style={sharedStyle}>
        {iconLeft}
        {children}
        {iconRight}
      </a>
    );
  }

  return (
    <button type={type ?? 'button'} disabled={disabled} onClick={disabled ? undefined : onClick} {...handlers} style={sharedStyle}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
