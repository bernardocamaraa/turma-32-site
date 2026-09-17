import { Card } from '../components/Card';
import { PageHeader } from '../components/SectionHeading';
import { FORMANDOS } from '../lib/formandos';
import { useIsMobile } from '../lib/useViewport';

/**
 * Nomes viram o slug dos arquivos em /assets/assinaturas (ex.: "Maria Luiza
 * Pires" → "maria-luiza-pires.png"). Só 29 dos 32 formandos têm assinatura
 * cadastrada até agora — os que faltam simplesmente não têm o arquivo, e a
 * lista mostra só o nome nesse caso.
 */
function slugAssinatura(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const COM_ASSINATURA = new Set([
  'anna-carolina-russo', 'anna-clara-ribeiro', 'arthur-caetano', 'arthur-oliveira',
  'bernardo-camara', 'bernardo-ignacio', 'caio-bezerra', 'carolina-warrak',
  'enzo-louro', 'geovanna-russo', 'guilherme-warrak', 'isabella-guimaraes',
  'isabella-monteiro', 'joao-pedro-jardim', 'lais-boldrim', 'laura-viana',
  'livia-whitaker', 'lorenzo-nunes', 'lucas-loyola', 'lucas-varejao',
  'luiza-goes', 'maian-costa', 'maria-clara-bispo', 'maria-eduarda-barroso',
  'maria-luiza-pires', 'matheus-veiga', 'pietra-machado', 'sophia-afonso',
  'susana-liu',
]);

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
          {FORMANDOS.map((nome, i) => {
            const slug = slugAssinatura(nome);
            const temAssinatura = COM_ASSINATURA.has(slug);
            return (
              <li
                key={nome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4) 0',
                  borderBottom: '1px solid var(--stroke-hair)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', flex: '0 0 auto', width: 24 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h4)', lineHeight: 'var(--lh-snug)' }}>{nome}</span>
                </span>
                {temAssinatura ? (
                  <img
                    src={`/assets/assinaturas/${slug}.png`}
                    alt={`Assinatura de ${nome}`}
                    style={{ flex: '0 0 auto', maxWidth: 110, maxHeight: 32, objectFit: 'contain' }}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>
    </main>
  );
}
