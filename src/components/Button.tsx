import { useState, type CSSProperties, type MouseEventHandler, type PointerEvent, type ReactNode } from 'react';
import { Roda } from './Carregando';

type Variant = 'primary' | 'gild' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { h: string; px: number; fs: number }> = {
  sm: { h: 'var(--control-h-sm)', px: 16, fs: 14 },
  md: { h: 'var(--control-h)', px: 22, fs: 15 },
  lg: { h: 'var(--control-h-lg)', px: 28, fs: 17 },
};

// Pill buttons, Apple-style: one solid light pill for the main action, a
// translucent one for the alternative, and a plain text link for the rest.
const SKINS: Record<Variant, { background: string; hover: string; color: string; border: string }> = {
  primary: { background: 'var(--chalk-050)', hover: '#ffffff', color: '#000000', border: 'transparent' },
  gild: { background: 'var(--gild-400)', hover: 'var(--gild-300)', color: '#000000', border: 'transparent' },
  secondary: { background: 'rgba(245,245,247,.1)', hover: 'rgba(245,245,247,.16)', color: 'var(--chalk-050)', border: 'transparent' },
  ghost: { background: 'transparent', hover: 'transparent', color: 'var(--accent)', border: 'transparent' },
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  /** Working on it: the ring turns where the left icon goes, and it can't be pressed again meanwhile. */
  carregando?: boolean;
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
  disabled: desativado = false,
  carregando = false,
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
  const ghost = variant === 'ghost';
  // While it loads it's as unpressable as a disabled one, but stays at full
  // strength so the ring and the label ("Entrando…") read clearly.
  const disabled = desativado || carregando;

  const sharedStyle: CSSProperties = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: s.h,
    padding: ghost ? '0 4px' : '0 ' + s.px + 'px',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-core)',
    fontSize: s.fs + 'px',
    fontWeight: ghost ? 400 : 500,
    letterSpacing: '-.01em',
    whiteSpace: 'nowrap',
    textDecoration: ghost && hover && !disabled ? 'underline' : 'none',
    textUnderlineOffset: 3,
    background: hover && !disabled ? k.hover : k.background,
    color: k.color,
    border: '1px solid ' + k.border,
    borderRadius: 'var(--radius-pill)',
    transform: press && !disabled ? 'scale(.97)' : 'none',
    opacity: disabled && !carregando ? 0.38 : 1,
    cursor: carregando ? 'progress' : disabled ? 'not-allowed' : 'pointer',
    transition: 'transform var(--dur-fast) var(--ease-out), background var(--dur) var(--ease-out)',
    WebkitTapHighlightColor: 'transparent',
    ...style,
  };

  const handlers = {
    // A mouse only: a phone fakes a hover on every tap, and it would stay
    // lit after the finger is gone.
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') setHover(true);
    },
    onPointerLeave: () => {
      setHover(false);
      setPress(false);
    },
    onPointerDown: () => setPress(true),
    onPointerUp: () => setPress(false),
    onPointerCancel: () => setPress(false),
  };

  if (as === 'a') {
    return (
      <a href={href} target={target} rel={rel} onClick={onClick} aria-busy={carregando || undefined} {...handlers} style={sharedStyle}>
        {carregando ? <Roda daCorDoTexto /> : iconLeft}
        {children}
        {iconRight}
      </a>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      aria-busy={carregando || undefined}
      onClick={disabled ? undefined : onClick}
      {...handlers}
      style={sharedStyle}
    >
      {carregando ? <Roda daCorDoTexto /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
