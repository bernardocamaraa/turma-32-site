import { Card } from './Card';
import { useIsMobile } from '../lib/useViewport';

/**
 * A lista de convidados não é feita neste site: cada formando cadastra os
 * seus convidados no portal da casa de festas. O site só explica isso, para
 * ninguém tentar "confirmar presença" em dois lugares diferentes.
 */
export function AvisoConfirmacao({ compact = false }: { compact?: boolean }) {
  const mobile = useIsMobile();

  return (
    <Card accent padding={0} style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: mobile ? 'var(--space-6)' : 'var(--space-7) var(--space-8)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-core)',
            fontSize: 'var(--fs-label)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          Confirmação de presença
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: compact ? 'var(--fs-h3)' : 'var(--fs-h2)',
            lineHeight: 'var(--lh-snug)',
          }}
        >
          Fale com quem te convidou
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '58ch' }}>
          Para confirmar presença, é só falar diretamente com o formando que te
          enviou o convite — é ele quem cadastra os convidados dele. Não existe
          confirmação por este site.
        </p>
        {!compact ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-body-sm)', lineHeight: 'var(--lh-normal)', color: 'var(--text-faint)', maxWidth: '58ch' }}>
            Este site é só informativo: aqui ficam a data, o local, o traje e as
            dúvidas mais comuns da noite.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
