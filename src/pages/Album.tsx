import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { CountdownRow } from '../components/SectionHeading';
import { useReveal } from '../lib/useReveal';
import { BAILE, useCountdown } from '../lib/countdown';
import { useIsMobile } from '../lib/useViewport';

const FOTOS_PLACEHOLDER: [string, string][] = [
  ['foto · entrada', '19h42'],
  ['foto · pista', '20h15'],
  ['foto · mesa 04', '20h31'],
  ['foto · valsa', '21h03'],
  ['foto · turma inteira', '21h20'],
  ['foto · bar', '21h48'],
  ['foto · pista', '22h05'],
  ['foto · varanda', '22h27'],
  ['foto · mesa 09', '22h51'],
  ['foto · pista', '23h14'],
  ['foto · palco', '23h39'],
  ['foto · saída', '00h12'],
];

export function Album() {
  const countdown = useCountdown();
  const mobile = useIsMobile();
  const aberto = useMemo(() => Date.now() >= BAILE.getTime(), []);
  const [dialogAberto, setDialogAberto] = useState(false);

  return (
    <main style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-9) var(--gutter-page) var(--space-10)', animation: 'om-fade-up 620ms var(--ease-out) both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-7)' }}>
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
          Álbum da festa
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'var(--fs-display-3)',
            lineHeight: 'var(--lh-tight)',
            letterSpacing: 'var(--tracking-display)',
          }}
        >
          {aberto ? 'Ao vivo, agora' : 'O álbum abre na noite do baile'}
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '60ch' }}>
          {aberto
            ? 'Quem está na festa envia; todo mundo vê. O álbum fica no ar até o fim da noite.'
            : 'O envio de fotos funciona só durante a festa, e as fotos ficam disponíveis enquanto ela acontece.'}
        </p>
      </div>

      {!aberto ? (
        <Card variant="tagged" padding={0} style={{ overflow: 'hidden' }}>
          <div
            style={{
              background: 'var(--wall-600)',
              backgroundImage: 'url(/assets/wall-texture.png)',
              backgroundSize: '520px',
              animation: 'om-drift 120s linear infinite',
              position: 'relative',
              padding: 'var(--space-10) var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(10,10,12,.9),rgba(10,10,12,.6),rgba(10,10,12,.9))' }} />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 520,
                height: 520,
                margin: '-260px 0 0 -260px',
                pointerEvents: 'none',
                background: 'radial-gradient(circle,rgba(169,211,232,.13),rgba(169,211,232,0) 66%)',
                animation: 'om-sheen 9s ease-in-out infinite',
              }}
            />
            <span style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Abre em
            </span>
            <div style={{ position: 'relative' }}>
              <CountdownRow {...countdown} size={48} />
            </div>
            <p style={{ position: 'relative', margin: 0, maxWidth: '44ch', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              No dia 10.12, às 19h, o botão de enviar foto aparece aqui para quem estiver na festa. As fotos ficam no ar durante a noite.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Badge tone="accent">AO VIVO NA FESTA</Badge>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                {FOTOS_PLACEHOLDER.length} fotos enviadas
              </span>
            </div>
            <Button iconLeft={<Icon name="camera" size={18} />} onClick={() => setDialogAberto(true)}>
              ENVIAR FOTO
            </Button>
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)' }}>
            {FOTOS_PLACEHOLDER.map((foto, i) => (
              <PhotoTile key={i} label={foto[0]} hora={foto[1]} delay={Math.min(i, 7) * 60} />
            ))}
          </div>
        </>
      )}

      <Dialog
        open={dialogAberto}
        title="Foto enviada"
        onClose={() => setDialogAberto(false)}
        footer={<Button onClick={() => setDialogAberto(false)}>FECHAR</Button>}
      >
        O envio de fotos ainda não está conectado — assim que o álbum tiver armazenamento, sua foto aparece aqui na hora.
      </Dialog>
    </main>
  );
}

function PhotoTile({ label, hora, delay }: { label: string; hora: string; delay: number }) {
  const reveal = useReveal<HTMLDivElement>(label, delay);
  return (
    <div
      ref={reveal.ref}
      className={reveal.className}
      style={{
        ...reveal.style,
        background: 'var(--wall-600)',
        backgroundImage: 'url(/assets/wall-texture.png)',
        backgroundSize: '300px',
        border: '1px solid var(--stroke-hair)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 2,
        padding: 'var(--space-4)',
        minHeight: 200,
        transition: 'border-color 120ms var(--ease-out),box-shadow 120ms var(--ease-out),transform 120ms var(--ease-out)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--text-faint)', opacity: 0.7 }}>{hora}</span>
    </div>
  );
}
