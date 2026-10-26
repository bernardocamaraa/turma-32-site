import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { MAPS_LINK } from '../components/MapEmbed';
import { CountdownRow, SectionEyebrowRule } from '../components/SectionHeading';
import { AvisoConfirmacao } from '../components/AvisoConfirmacao';
import { Bloco, Grande, LinkSeta, MapaInclinado, Pequeno, Revela, Titulo } from '../components/Cena';
import { useCountdown } from '../lib/countdown';
import { trecho, useProgressoRolagem } from '../lib/motion';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

export function Home() {
  return (
    <main>
      <Abertura />
      <TextoQueAcende />
      <Contagem />
      <ANoite />
      <section style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-10) var(--gutter-page) 0' }}>
        <MapaInclinado />
      </section>
      <section style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-10) var(--gutter-page) 0' }}>
        <Revela>
          <AvisoConfirmacao />
        </Revela>
      </section>
      <Fechamento />
    </main>
  );
}

/**
 * Scene 1. The class logo over the wall of signatures, then the headline.
 * The section is taller than the screen and its content is pinned, so the
 * first stretch of scrolling plays the scene: the logo shrinks back and
 * fades, the signatures drift up, and the page hands over to scene 2.
 */
function Abertura() {
  const mobile = useIsMobile();
  const reduzido = usePrefersReducedMotion();
  const { ref, progresso } = useProgressoRolagem<HTMLElement>('fixo');
  // Under reduced motion the scene stays in its opening, readable state.
  const p = reduzido ? 0 : progresso;
  const saida = trecho(p, 0.1, 0.75);

  return (
    <section ref={ref} style={{ height: reduzido ? 'auto' : mobile ? '150vh' : '170vh', position: 'relative' }}>
      <div className="cena-fixa" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* The signatures of the class, faint and drifting, fading to black at the edges. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-10%',
            backgroundImage: 'url(/assets/assinaturas-mural.png)',
            backgroundSize: mobile ? '760px' : '1150px',
            opacity: 0.22 * (1 - saida * 0.6),
            transform: `translateY(${(-p * 120).toFixed(1)}px) scale(${(1 + p * 0.08).toFixed(3)})`,
            WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)',
            animation: 'om-drift 90s linear infinite',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: mobile ? 'var(--space-6)' : 'var(--space-7)',
            padding: '0 var(--gutter-page)',
            transform: `translateY(${(-saida * 80).toFixed(1)}px)`,
            opacity: 1 - saida,
          }}
        >
          {/* The entrance animation and the scroll-driven shrink live on
              different elements: an animation that holds its end state
              would otherwise override the inline transform. */}
          <div style={{ animation: 'om-rise 1600ms var(--ease-out) 100ms both' }}>
            <img
              src="/assets/logo-32.png"
              alt="Turma 32"
              style={{
                display: 'block',
                height: mobile ? 168 : 240,
                width: 'auto',
                transform: `scale(${(1 - saida * 0.18).toFixed(3)})`,
                filter: 'drop-shadow(0 0 60px rgba(169,211,232,.18))',
              }}
            />
          </div>
          <h1
            className="texto-prata"
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'var(--fs-display-1)',
              lineHeight: 0.98,
              letterSpacing: '-.035em',
              animation: 'om-rise 1600ms var(--ease-out) 450ms both',
            }}
          >
            Três anos.
            <br />
            Uma noite.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--fs-body-lg)',
              color: 'var(--text-muted)',
              animation: 'om-rise 1600ms var(--ease-out) 800ms both',
            }}
          >
            Baile de formatura da Turma 32 · 10 de dezembro de 2026
          </p>
        </div>
      </div>
    </section>
  );
}

const FRASE =
  'Três turmas diferentes em um lugar só, uma mistura que tinha tudo pra dar errado mas deu muito certo. Agora, vamos celebrar essa união e fim de ciclo da melhor maneira possível!';

/**
 * Scene 2. A paragraph that lights up word by word as you scroll through
 * it — Apple's way of making you read one sentence slowly.
 */
function TextoQueAcende() {
  const mobile = useIsMobile();
  const reduzido = usePrefersReducedMotion();
  const { ref, progresso } = useProgressoRolagem<HTMLElement>('fixo');
  const palavras = FRASE.split(' ');
  const acesas = Math.round(trecho(progresso, 0.05, 0.85) * palavras.length);

  return (
    <section ref={ref} style={{ height: reduzido ? 'auto' : mobile ? '220vh' : '260vh', position: 'relative' }}>
      <div
        className={reduzido ? undefined : 'cena-fixa'}
        style={{ display: 'flex', alignItems: 'center', padding: reduzido ? 'var(--space-10) 0' : undefined }}
      >
        <p
          style={{
            maxWidth: 'var(--maxw-page)',
            margin: '0 auto',
            padding: '0 var(--gutter-page)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: mobile ? 32 : 'clamp(40px, 4.6vw, 64px)',
            lineHeight: 1.12,
            letterSpacing: '-.03em',
          }}
        >
          {palavras.map((palavra, i) => (
            <span
              key={i}
              style={{
                color: i < acesas ? 'var(--chalk-050)' : '#2c2c2e',
                transition: 'color 400ms var(--ease-out)',
              }}
            >
              {palavra}{' '}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/** Scene 3. How long until the night, as large as the page allows. */
function Contagem() {
  const countdown = useCountdown();
  return (
    <section style={{ padding: 'var(--space-10) var(--gutter-page)', textAlign: 'center' }}>
      <Revela style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-7)' }}>
        <SectionEyebrowRule>Contagem regressiva</SectionEyebrowRule>
        <CountdownRow {...countdown} size={96} />
        <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', color: 'var(--text-muted)' }}>
          Até quinta-feira, 10 de dezembro, às 19h.
        </p>
      </Revela>
    </section>
  );
}

/** Scene 4. The practical facts of the night, as tiles that rise in one after another. */
function ANoite() {
  const mobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <section style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-9) var(--gutter-page) 0' }}>
      <Revela style={{ marginBottom: 'var(--space-8)' }}>
        <Titulo>A noite, em resumo.</Titulo>
      </Revela>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(6, 1fr)', gap: mobile ? 12 : 20 }}>
        <Bloco atraso={0} coluna={mobile ? undefined : 'span 4'} destaque>
          <Pequeno>Quinta-feira</Pequeno>
          <Grande tamanho="clamp(56px, 8vw, 104px)">10 de dezembro</Grande>
          <Pequeno>de 2026</Pequeno>
        </Bloco>
        <Bloco atraso={100} coluna={mobile ? undefined : 'span 2'}>
          <Pequeno>Convidados a partir das</Pequeno>
          <Grande tamanho="clamp(56px, 7vw, 88px)">19h</Grande>
          <Pequeno>Formandos chegam às 18h30.</Pequeno>
        </Bloco>
        <Bloco atraso={0} coluna={mobile ? undefined : 'span 3'}>
          <Pequeno>Local</Pequeno>
          <Grande tamanho="clamp(32px, 3.6vw, 44px)">Ballroom Casa de Festas</Grande>
          <Pequeno>Nova Iguaçu</Pequeno>
          <LinkSeta href={MAPS_LINK}>Como chegar</LinkSeta>
        </Bloco>
        <Bloco atraso={100} coluna={mobile ? undefined : 'span 3'}>
          <Pequeno>Traje</Pequeno>
          <Grande tamanho="clamp(32px, 3.6vw, 44px)">Passeio completo</Grande>
          <Pequeno>É uma noite de gala: vale caprichar.</Pequeno>
          <LinkSeta onClick={() => navigate('/baile#traje')}>Ver o traje</LinkSeta>
        </Bloco>
        <Bloco atraso={0} coluna={mobile ? undefined : 'span 6'}>
          <Pequeno>Colação de grau</Pequeno>
          <Grande tamanho="clamp(28px, 3vw, 40px)">Na mesma noite, no mesmo salão, durante o baile.</Grande>
        </Bloco>
      </div>
    </section>
  );
}

/** The close: one line, and the way to everything else. */
function Fechamento() {
  const navigate = useNavigate();
  return (
    <section style={{ padding: 'var(--space-11) var(--gutter-page)', textAlign: 'center' }}>
      <Revela style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
        <h2
          className="texto-gelo"
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--fs-display-2)',
            lineHeight: 'var(--lh-tight)',
            letterSpacing: '-.035em',
          }}
        >
          Até lá.
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button size="lg" onClick={() => navigate('/baile')}>
            Detalhes da noite
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/baile#duvidas')}>
            Perguntas frequentes
          </Button>
        </div>
      </Revela>
    </section>
  );
}

