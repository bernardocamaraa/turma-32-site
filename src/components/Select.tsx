import { useId, useState, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

export function Select({
  label,
  hint,
  options,
  placeholder = 'Selecione',
  id,
  ...rest
}: {
  label?: string;
  hint?: string;
  options: string[];
  placeholder?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const [focus, setFocus] = useState(false);
  const autoId = useId();
  const uid = id || autoId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
        </label>
      ) : null}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          height: 'var(--control-h)',
          background: 'rgba(244,247,250,.04)',
          border: '2px solid ' + (focus ? 'var(--chalk-050)' : 'var(--stroke-muted)'),
          borderRadius: 'var(--radius-sm)',
          opacity: rest.disabled ? 0.4 : 1,
          transition: 'border-color var(--dur-fast) var(--ease-out)',
        }}
      >
        <select
          id={uid}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            flex: 1,
            height: '100%',
            padding: '0 40px 0 var(--space-4)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: rest.value ? 'var(--text-primary)' : 'var(--text-faint)',
            fontFamily: 'var(--font-core)',
            fontSize: 'var(--fs-body)',
            cursor: rest.disabled ? 'not-allowed' : 'pointer',
          }}
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o} style={{ background: 'var(--ink-850)' }}>
              {o}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={16}
          style={{ position: 'absolute', right: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}
        />
      </div>
      {hint ? (
        <span style={{ fontFamily: 'var(--font-core)', fontSize: 'var(--fs-caption)', color: 'var(--text-faint)' }}>{hint}</span>
      ) : null}
    </div>
  );
}
