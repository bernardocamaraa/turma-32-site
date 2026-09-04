import type { CSSProperties, ReactNode } from 'react';
import { useReveal } from '../lib/useReveal';

export function Reveal({
  id,
  as: Tag = 'div',
  style,
  children,
}: {
  id?: string;
  as?: 'div' | 'section';
  style?: CSSProperties;
  children: ReactNode;
}) {
  const reveal = useReveal(id);
  return (
    <Tag ref={reveal.ref as never} className={reveal.className} id={id} style={style}>
      {children}
    </Tag>
  );
}
