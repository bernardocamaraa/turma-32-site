import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { MapEmbed, MAPS_LINK } from '../components/MapEmbed';
import { CountdownRow, SectionEyebrowRule } from '../components/SectionHeading';
import { Reveal } from '../components/Reveal';
import { useCountdown } from '../lib/countdown';
import { useIsMobile, usePrefersReducedMotion, useScrollY } from '../lib/useViewport';

export function Home() {
  const navigate = useNavigate();
  const countdown = useCountdown();
  const mobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const parallaxOn = !mobile && !reducedMotion;
  const y = useScrollY(parallaxOn);

  return (
    <main>
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid var(--stroke-hair)',
          background: 'var(--wall-600)',
          backgroundImage: 'url(/assets/wall-texture.png)',
          backgroundSize: '520px',
          animation: 'om-drift 120s linear infinite',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg,rgba(10,10,12,.92) 0%,rgba(10,10,12,.62) 55%,rgba(10,10,12,.9) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '-8%',
            bottom: '-30%',
            width: 620,
            height: 620,
            pointerEvents: 'none',
            background: 'radial-gradient(circle,rgba(169,211,232,.12),rgba(169,211,232,0) 66%)',
            animation: 'om-sheen 13s ease-in-out infinite',
            transform: parallaxOn ? `translateY(${(y * 0.16).toFixed(1)}px)` : undefined,
          }}
        />
        <div
          style={{
            maxWidth: 'var(--maxw-page)',
            margin: '0 auto',
            position: 'relative',
            ...(mobile
              ? { display: 'flex', flexDirection: 'column-reverse' as const, gap: 'var(--space-7)', padding: 'var(--space-9) var(--gutter-page)' }
              : {
                  display: 'grid',
                  gridTemplateColumns: '1.15fr .85fr',
                  gap: 'var(--space-9)',
                  alignItems: 'center',
                  padding: 'var(--space-10) var(--gutter-page)',
                }),
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-6)',
              animation: 'om-fade-up 620ms var(--ease-out) both',
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
                animation: 'om-fade-up 560ms var(--ease-out) 60ms both',
              }}
            >
              Turma 32 · Formatura 2026
            </span>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                lineHeight: 'var(--lh-tight)',
                letterSpacing: 'var(--tracking-display)',
                textWrap: 'pretty' as never,
                fontSize: mobile ? 'var(--fs-h1)' : 'var(--fs-display-2)',
                animation: 'om-fade-up 640ms var(--ease-out) 120ms both',
              }}
            >
              Três anos.
              <br />
              Em apenas
              <br />
              uma noite.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--fs-body-lg)',
                lineHeight: 'var(--lh-normal)',
                color: 'var(--text-muted)',
                maxWidth: '42ch',
                animation: 'om-fade-up 640ms var(--ease-out) 200ms both',
              }}
            >
              Tudo sobre a noite mais aguardada do ano em um só lugar
            </p>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-5)',
                flexWrap: 'wrap',
                animation: 'om-fade-up 640ms var(--ease-out) 280ms both',
                ...(mobile ? { flexDirection: 'column' as const, alignItems: 'stretch' as const } : { alignItems: 'center' as const }),
              }}
            >
              <Button size="lg" onClick={() => navigate('/rsvp')}>
                CONFIRMAR PRESENÇA
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/baile')}>
                SAIBA MAIS
              </Button>
            </div>
            <div
              style={{
                marginTop: 'var(--space-5)',
                paddingTop: 'var(--space-6)',
                borderTop: '1px solid var(--stroke-hair)',
                display: 'flex',
                gap: 'var(--space-6)',
                animation: 'om-fade-up 640ms var(--ease-out) 360ms both',
              }}
            >
              <CountdownRow {...countdown} />
            </div>
          </div>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'om-fade-in 900ms var(--ease-out) 200ms both',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 520,
                height: 520,
                margin: '-260px 0 0 -260px',
                pointerEvents: 'none',
                background: 'radial-gradient(circle,rgba(169,211,232,.26),rgba(169,211,232,.08) 42%,rgba(169,211,232,0) 70%)',
                animation: 'om-sheen 9s ease-in-out infinite',
                transform: parallaxOn ? `translateY(${(y * 0.1).toFixed(1)}px)` : undefined,
              }}
            />
            <div
              style={{
                position: 'relative',
                display: 'flex',
                animation: 'om-glow 7s ease-in-out infinite',
                transform: parallaxOn ? `translateY(${(y * -0.05).toFixed(1)}px)` : undefined,
              }}
            >
              <Logo size={mobile ? 220 : 340} />
            </div>
          </div>
        </div>
      </section>

      <Reveal
        id="evento"
        as="section"
        style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-10) var(--gutter-page) 0' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-7)' }}>
          <SectionEyebrowRule>O evento</SectionEyebrowRule>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-snug)' }}>
            O dia mais esperado de todos
          </h2>
        </div>
        <Card variant="tagged" padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.1fr .9fr' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex' }}>
                <Badge tone="gild">TRAJE PASSEIO COMPLETO</Badge>
              </div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  fontSize: mobile ? 'var(--fs-h1)' : 'var(--fs-display-3)',
                  lineHeight: 'var(--lh-tight)',
                  letterSpacing: 'var(--tracking-display)',
                }}
              >
                Baile de formatura
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '34ch' }}>
                Uma noite só, com a turma inteira reunida pela última vez.
              </p>
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--stroke-hair)', display: 'flex', gap: 'var(--space-6)' }}>
                <CountdownRow {...countdown} />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 'var(--space-5)',
                padding: 'var(--space-8)',
                background: 'var(--wall-500)',
                backgroundImage: 'url(/assets/wall-texture.png)',
                backgroundSize: '420px',
                backgroundBlendMode: 'overlay',
                ...(mobile ? { borderTop: '1px solid var(--stroke-hair)' } : { borderLeft: '1px solid var(--stroke-hair)' }),
              }}
            >
              <Field label="Data" value="10 de dezembro" />
              <Field label="Horário" value="19h" />
              <Field label="Local" value="Ballroom Casa de Festas" />
              <div style={{ marginTop: 'var(--space-3)', display: 'flex' }}>
                <Button variant="secondary" as="a" href={MAPS_LINK} target="_blank" rel="noopener noreferrer" iconLeft={<Icon name="map-pin" size={16} />}>
                  Como chegar
                </Button>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--stroke-hair)' }}>
            <MapEmbed height={320} />
          </div>
        </Card>
      </Reveal>

      <Reveal id="album" as="section" style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-10) var(--gutter-page) 0' }}>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.1fr .9fr' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-8)' }}>
              <SectionEyebrowRule>Álbum da festa</SectionEyebrowRule>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-snug)' }}>
                Olha você curtindo!
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '52ch' }}>
                Publique aqui suas fotos curtindo nossa festa! Abre durante o baile (<span style={{ fontFamily: 'var(--font-mono)' }}>10.12.2026</span>) e fecha no fim da noite.
              </p>
              <div style={{ marginTop: 'var(--space-3)', display: 'flex' }}>
                <Button variant="ghost" onClick={() => navigate('/album')}>
                  VER O ÁLBUM
                </Button>
              </div>
            </div>
            <div
              style={{
                background: 'var(--wall-500)',
                backgroundImage: 'url(/assets/wall-texture.png)',
                backgroundSize: '420px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-8)',
                ...(mobile ? { borderTop: '1px solid var(--stroke-hair)' } : { borderLeft: '1px solid var(--stroke-hair)' }),
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                fechado até a festa
              </span>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal
        id="confirmar"
        as="section"
        style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-10) var(--gutter-page)', position: 'relative', overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 760,
            height: 420,
            margin: '-210px 0 0 -380px',
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse,rgba(169,211,232,.13),rgba(169,211,232,0) 68%)',
            animation: 'om-sheen 11s ease-in-out infinite',
          }}
        />
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--space-7)',
              padding: 'var(--space-8)',
              ...(mobile ? { flexDirection: 'column' as const, alignItems: 'stretch' as const } : { alignItems: 'center' as const }),
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <SectionEyebrowRule>Confirmação de presença</SectionEyebrowRule>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h2)', lineHeight: 'var(--lh-snug)' }}>
                Confirme a sua presença por aqui!
              </h2>
            </div>
            <Button size="lg" onClick={() => navigate('/rsvp')}>
              CONFIRMAR PRESENÇA
            </Button>
          </div>
        </Card>
      </Reveal>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--fs-h4)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
