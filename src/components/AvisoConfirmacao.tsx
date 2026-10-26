import { Card } from './Card';
import { SectionEyebrowRule } from './SectionHeading';
import { useIsMobile } from '../lib/useViewport';

/**
 * A lista de convidados não é feita neste site: cada formando cadastra os
 * seus convidados no portal da casa de festas. O site só explica isso, para
 * ninguém tentar "confirmar presença" em dois lugares diferentes.
 */
export function AvisoConfirmacao({ compact = false }: { compact?: boolean }) {
  const mobile = useIsMobile();

  return (
    <Card padding={mobile ? 'var(--space-7) var(--space-6)' : 'var(--space-8)'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '40rem' }}>
        <SectionEyebrowRule>Confirmação de presença</SectionEyebrowRule>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: compact ? 'var(--fs-h2)' : 'var(--fs-h1)',
            lineHeight: 'var(--lh-snug)',
            letterSpacing: 'var(--tracking-display)',
          }}
        >
          Fale com quem te convidou.
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
          Quem confirma a sua presença é o formando que te mandou o convite: é ele quem
          cadastra os convidados dele. Não existe confirmação por este site.
        </p>
      </div>
    </Card>
  );
}
