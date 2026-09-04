import type { ReactNode } from 'react';
import { IconButton } from './IconButton';

export function Dialog({
  open,
  title,
  eyebrow,
  onClose,
  footer,
  width = 520,
  children,
}: {
  open: boolean;
  title?: string;
  eyebrow?: string;
  onClose?: () => void;
  footer?: ReactNode;
  width?: number;
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        background: 'var(--overlay-scrim)',
        backdropFilter: 'var(--blur-scrim)',
        WebkitBackdropFilter: 'var(--blur-scrim)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '100%',
          background: 'var(--ink-850)',
          border: '2px solid var(--chalk-050)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '8px 8px 0 var(--ice-300),var(--shadow-overlay)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-5)',
            padding: 'var(--space-6) var(--space-6) 0',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {eyebrow ? (
              <span
                style={{
                  fontFamily: 'var(--font-core)',
                  fontSize: 'var(--fs-label)',
                  letterSpacing: 'var(--tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                }}
              >
                {eyebrow}
              </span>
            ) : null}
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: 'var(--fs-h3)',
                lineHeight: 'var(--lh-snug)',
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </h2>
          </div>
          {onClose ? <IconButton name="x" label="Fechar" variant="ghost" size="sm" onClick={onClose} /> : null}
        </div>
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            fontFamily: 'var(--font-core)',
            fontSize: 'var(--fs-body)',
            lineHeight: 'var(--lh-normal)',
            color: 'var(--text-muted)',
          }}
        >
          {children}
        </div>
        {footer ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-4)',
              padding: 'var(--space-5) var(--space-6) var(--space-6)',
              borderTop: '1px solid var(--stroke-hair)',
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
