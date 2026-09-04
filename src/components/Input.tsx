import { useId, useState, type CSSProperties, type InputHTMLAttributes } from 'react';

export function Input({
  label,
  hint,
  error,
  required = false,
  style,
  id,
  ...rest
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  style?: CSSProperties;
} & InputHTMLAttributes<HTMLInputElement>) {
  const [focus, setFocus] = useState(false);
  const autoId = useId();
  const uid = id || autoId;
  const bd = error ? 'var(--state-error)' : focus ? 'var(--chalk-050)' : 'var(--stroke-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }}>
      {label ? (
        <label
          htmlFor={uid}
          style={{
            fontFamily: 'var(--font-core)',
            fontSize: 'var(--fs-label)',
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
          {required ? <span style={{ color: 'var(--accent)' }}> *</span> : null}
        </label>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          height: 'var(--control-h)',
          padding: '0 var(--space-4)',
          background: 'rgba(244,247,250,.04)',
          border: '2px solid ' + bd,
          borderRadius: 'var(--radius-sm)',
          opacity: rest.disabled ? 0.4 : 1,
          boxShadow: focus ? 'var(--glow-spray-tight)' : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out),box-shadow var(--dur-fast) var(--ease-out)',
        }}
      >
        <input
          id={uid}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-core)',
            fontSize: 'var(--fs-body)',
            color: 'var(--text-primary)',
          }}
          {...rest}
        />
      </div>
      {error ? (
        <span style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--fs-caption)', color: 'var(--state-error)' }}>{error}</span>
      ) : hint ? (
        <span style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--fs-caption)', color: 'var(--text-faint)' }}>{hint}</span>
      ) : null}
    </div>
  );
}
