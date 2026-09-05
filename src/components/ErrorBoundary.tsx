import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { erro: Error | null };

/**
 * A crash inside any page (a bad API response, a bug) would otherwise
 * unmount the whole app and leave a blank dark page — indistinguishable
 * from "site down" since the background is already near-black. This catches
 * it and shows something a visitor can act on instead of a dead screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  componentDidCatch(erro: Error, info: { componentStack: string }) {
    console.error('Erro não tratado:', erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-5)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-core)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Algo deu errado
          </span>
          <p style={{ margin: 0, maxWidth: '48ch', color: 'var(--text-muted)' }}>
            Essa página travou de um jeito inesperado. Recarregar costuma resolver.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              height: 44,
              padding: '0 24px',
              background: 'var(--chalk-050)',
              color: 'var(--ink-900)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-core)',
              fontWeight: 600,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
