import { useState, type CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'solid' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export function IconButton({
  name,
  label,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  onClick,
  style,
}: {
  name: IconName;
  label: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 56 : 44;
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const solid = variant === 'solid';

  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      // Hover from a mouse only, as in Button: a tap would leave it lit.
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHover(true);
      }}
      onPointerLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        background: solid ? 'var(--chalk-050)' : hover && !disabled ? 'rgba(244,247,250,.08)' : 'transparent',
        color: solid ? 'var(--ink-900)' : 'var(--chalk-050)',
        border: variant === 'ghost' ? '2px solid transparent' : '2px solid ' + (solid ? 'var(--chalk-050)' : 'var(--stroke-muted)'),
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        transform: press && !disabled ? 'scale(.94)' : 'none',
        transition:
          'transform var(--dur-fast) var(--ease-out),background var(--dur-fast) var(--ease-out),border-color var(--dur-fast) var(--ease-out)',
        ...style,
      }}
    >
      <Icon name={name} size={size === 'sm' ? 15 : size === 'lg' ? 22 : 18} />
    </button>
  );
}
