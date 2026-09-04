import type { CSSProperties } from 'react';

export function Logo({
  size = 88,
  src = '/assets/logo-32.png',
  style,
}: {
  size?: number;
  src?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={src}
      alt="Turma 32"
      style={{
        height: size,
        width: 'auto',
        display: 'block',
        ...style,
      }}
    />
  );
}
