import { Card } from '../components/Card';
import { PageHeader } from '../components/SectionHeading';
import { FORMANDOS } from '../lib/formandos';
import { useIsMobile } from '../lib/useViewport';

export function Turma() {
  const mobile = useIsMobile();

  return (
    <main
      style={{
        maxWidth: 'var(--maxw-page)',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        animation: 'om-fade-up 620ms var(--ease-out) both',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <PageHeader eyebrow="A turma" title={`Os ${FORMANDOS.length} formandos`} />
        <p style={{ margin: 0, marginTop: 'calc(-1 * var(--space-4))', fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '60ch' }}>
          Três anos juntos, uma turma inteira se formando na mesma noite. Quem
          te convidou está nesta lista.
        </p>
      </div>

      <Card
        padding={0}
        style={{
          overflow: 'hidden',
          background: 'var(--bg-elev)',
          backgroundImage: 'url(/assets/wall-texture.png)',
          backgroundSize: '520px',
          backgroundBlendMode: 'overlay',
        }}
      >
        <ol
          style={{
            margin: 0,
            padding: mobile ? 'var(--space-6)' : 'var(--space-7) var(--space-8)',
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill,minmax(240px,1fr))',
            columnGap: 'var(--space-7)',
            rowGap: 0,
          }}
        >
          {FORMANDOS.map((nome, i) => (
            <li
              key={nome}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-4)',
                padding: 'var(--space-4) 0',
                borderBottom: '1px solid var(--stroke-hair)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', flex: '0 0 auto', width: 24 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h4)', lineHeight: 'var(--lh-snug)' }}>{nome}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Assinaturas da turma
        </span>
        {/* The asset is a repeating texture: cropping it to one band keeps it
            as a signed detail at the end of the page instead of a huge, half
            duplicated block. */}
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            height: 200,
            overflow: 'hidden',
            // Fades the crop out instead of slicing signatures in half.
            maskImage: 'linear-gradient(to bottom,#000 62%,transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom,#000 62%,transparent 100%)',
          }}
        >
          <img
            src="/assets/assinaturas.png"
            alt="Assinaturas dos formandos da Turma 32"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', filter: 'invert(1)', opacity: 0.6 }}
          />
        </div>
      </div>
    </main>
  );
}
