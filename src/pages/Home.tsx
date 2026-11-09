import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import { Button } from '../components/Button';
import { MAPS_LINK } from '../components/MapEmbed';
import { SectionEyebrowRule } from '../components/SectionHeading';
import { AvisoConfirmacao } from '../components/AvisoConfirmacao';
import { Bloco, Grande, LinkSeta, MapaInclinado, Pequeno, Revela, Titulo } from '../components/Cena';
import { EVENTO_ICS, LINK_GOOGLE_AGENDA } from '../lib/calendario';
import { useCountdown } from '../lib/countdown';
import { assinaturaDe, FORMANDOS } from '../lib/formandos';
import { trecho, useProgressoRolagem } from '../lib/motion';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

/**
 * The page builds up like the night itself: it opens in black with the ice
 * blue of the logo, the countdown glows bluer as the date gets closer, and
 * it closes in gold.
 */
export function Home() {
  return (
    <main className="com-grao">
      <Abertura />
      <TextoQueAcende />
      <FaixaDeAssinaturas />
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
 * Scene 1. The class logo sprayed onto the wall of signatures, then the
 * headline. A flashlight moves over the wall — following the mouse, or
 * wandering on its own on a phone — and lights up the signatures under it.
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
  const parede = useRef<HTMLDivElement>(null);
  // The light wanders until a mouse shows up, then stays with the mouse.
  const [seguindo, setSeguindo] = useState(false);

  const moverLuz = (e: PointerEvent<HTMLElement>) => {
    const el = parede.current;
    if (e.pointerType !== 'mouse' || !el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--luz-x', `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty('--luz-y', `${(e.clientY - r.top).toFixed(0)}px`);
    if (!seguindo) setSeguindo(true);
  };

  const mural: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url(/assets/assinaturas-mural.png)',
    backgroundSize: mobile ? '760px' : '1150px',
    animation: 'om-drift 90s linear infinite',
  };

  return (
    <section
      ref={ref}
      onPointerMove={moverLuz}
      style={{ height: reduzido ? 'auto' : mobile ? '130vh' : '140vh', position: 'relative' }}
    >
      <div className="cena-fixa" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* The signatures of the class, faint and drifting, fading to black at the edges. */}
        <div
          ref={parede}
          aria-hidden
          className={seguindo ? undefined : 'lanterna-auto'}
          style={{
            position: 'absolute',
            inset: '-10%',
            ['--luz-r' as string]: mobile ? '170px' : '260px',
            transform: `translateY(${(-p * 120).toFixed(1)}px) scale(${(1 + p * 0.08).toFixed(3)})`,
            opacity: 1 - saida * 0.6,
            WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ ...mural, opacity: 0.2 }} />
          {/* The light itself: a soft blue pool, and the wall at full strength
              inside it. Left out under reduced motion, where it would just
              stand still behind the headline. */}
          {reduzido ? null : (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle calc(var(--luz-r) * 1.4) at var(--luz-x) var(--luz-y), rgba(169,211,232,.12), transparent 70%)',
                }}
              />
              <div className="lanterna" style={{ ...mural, opacity: 0.85 }} />
            </>
          )}
        </div>
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
          {/* The entrance animations and the scroll-driven shrink live on
              different elements: an animation that holds its end state
              would otherwise override the inline transform. */}
          <div className="logo-neon">
            <div className="logo-spray">
              <img
                src="/assets/logo-32.png"
                alt="Turma 32"
                style={{
                  display: 'block',
                  height: mobile ? 168 : 240,
                  width: 'auto',
                  transform: `scale(${(1 - saida * 0.18).toFixed(3)})`,
                }}
              />
            </div>
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
              animation: 'om-rise 1600ms var(--ease-out) 700ms both',
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
              animation: 'om-rise 1600ms var(--ease-out) 1000ms both',
            }}
          >
            Baile de formatura da Turma 32
            {mobile ? <br /> : ' · '}
            <span style={{ whiteSpace: 'nowrap' }}>10 de dezembro de 2026</span>
          </p>
        </div>
        {/* "There's more below", gone as soon as the scroll starts. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 'max(28px, env(safe-area-inset-bottom))',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: 1 - trecho(p, 0, 0.06),
            pointerEvents: 'none',
          }}
        >
          <div style={{ animation: 'om-fade-in 900ms var(--ease-out) 2600ms both' }}>
            <ChevronDown
              size={28}
              strokeWidth={1.6}
              color="var(--text-muted)"
              style={{ display: 'block', animation: 'dica-rolar 2200ms var(--ease-in-out) infinite' }}
            />
          </div>
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
    <section ref={ref} style={{ height: reduzido ? 'auto' : mobile ? '170vh' : '190vh', position: 'relative' }}>
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

/**
 * Scene 3. A break between the opening and the night's facts: every
 * graduate's signature, in two rows running in opposite directions. Pauses under the
 * mouse; with reduced motion the rows stand still and scroll by hand.
 */
function FaixaDeAssinaturas() {
  const mobile = useIsMobile();
  const linhas = [FORMANDOS.filter((_, i) => i % 2 === 0), FORMANDOS.filter((_, i) => i % 2 === 1)];

  // The name stays as the image's text, for screen readers; one whose
  // signature hasn't arrived shows it written instead.
  const item = (nome: string) => {
    const assinatura = assinaturaDe(nome);
    return (
      <li
        key={nome}
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: mobile ? 140 : 190,
          height: mobile ? 72 : 96,
        }}
      >
        {assinatura ? (
          <img
            src={assinatura}
            alt={nome}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: 0.92 }}
          />
        ) : (
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{nome}</span>
        )}
      </li>
    );
  };

  const lista: CSSProperties = { display: 'flex', gap: mobile ? 24 : 40, margin: 0, padding: 0, paddingRight: mobile ? 24 : 40, listStyle: 'none' };

  return (
    <section style={{ padding: 'var(--space-8) 0' }}>
      <Revela style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 'var(--space-5)' : 'var(--space-6)' }}>
        {linhas.map((nomes, i) => (
          <div key={i} className="faixa">
            <div className={`faixa-trilho${i === 1 ? ' ao-contrario' : ''}`} style={{ ['--faixa-dur' as string]: mobile ? '70s' : '90s' }}>
              <ul style={lista} aria-label={i === 0 ? 'Os formandos' : undefined}>
                {nomes.map(item)}
              </ul>
              <ul style={lista} className="faixa-copia" aria-hidden>
                {nomes.map(item)}
              </ul>
            </div>
          </div>
        ))}
      </Revela>
    </section>
  );
}

/**
 * Scene 4. How long until the night, filling the screen. Each digit turns
 * over like a departures board when it changes, and the blue glow behind it
 * grows as it scrolls in — and stronger the closer the date is.
 */
function Contagem() {
  const mobile = useIsMobile();
  const countdown = useCountdown();
  const { ref, progresso } = useProgressoRolagem<HTMLElement>('passagem');
  const { dias, horas, min, seg } = countdown;
  const chegou = dias === '0' && horas === '00' && min === '00' && seg === '00';
  // A season's worth of days away the glow is faint; on the day, it's full.
  const proximidade = 1 - Math.min(Number(dias), 120) / 120;
  const brilho = trecho(progresso, 0.1, 0.45) * (0.45 + proximidade * 0.55);

  return (
    <section
      ref={ref}
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-10) var(--gutter-page)',
        textAlign: 'center',
        background: `radial-gradient(70% 55% at 50% 55%, rgba(75,150,189,${(0.38 * brilho).toFixed(3)}) 0%, rgba(75,150,189,0) 70%)`,
      }}
    >
      <Revela style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-7)', width: '100%' }}>
        <SectionEyebrowRule>{chegou ? 'Chegou o dia' : 'Faltam'}</SectionEyebrowRule>
        {chegou ? (
          <Titulo tamanho="var(--fs-display-1)">É hoje.</Titulo>
        ) : (
          <div
            role="timer"
            aria-label={`Faltam ${dias} dias, ${horas} horas e ${min} minutos`}
            style={{
              display: 'grid',
              gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
              gap: mobile ? 12 : 20,
              width: '100%',
              maxWidth: mobile ? 360 : 'var(--maxw-page)',
            }}
          >
            <Placa valor={dias} rotulo="dias" />
            <Placa valor={horas} rotulo="horas" />
            <Placa valor={min} rotulo="minutos" />
            <Placa valor={seg} rotulo="segundos" />
          </div>
        )}
        <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', color: 'var(--text-muted)' }}>
          Quinta-feira, 10 de dezembro, às 19h.
        </p>
        <AdicionarAoCalendario />
      </Revela>
    </section>
  );
}

/**
 * Saving the night in the guest's calendar: Google Calendar opens with the
 * event filled in; the Apple button opens the .ics file, which an iPhone or
 * Mac shows as "add to calendar" (and Outlook understands too).
 */
function AdicionarAoCalendario() {
  const icone = <CalendarPlus size={18} strokeWidth={1.8} aria-hidden />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Salve a data na sua agenda</span>
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button variant="secondary" size="lg" iconLeft={icone} as="a" href={LINK_GOOGLE_AGENDA} target="_blank" rel="noopener noreferrer">
          Google Agenda
        </Button>
        <Button variant="secondary" size="lg" iconLeft={icone} as="a" href={EVENTO_ICS}>
          Calendário da Apple
        </Button>
      </div>
    </div>
  );
}

/** One number of the countdown on its own tile, split across the middle like a flap display. */
function Placa({ valor, rotulo }: { valor: string; rotulo: string }) {
  const digitos = valor.split('');
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'clamp(20px, 3vw, 36px) 8px clamp(16px, 2.4vw, 28px)',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(180deg, #17171a 0%, var(--ink-850) 50%, #0c0c0e 50%, #0c0c0e 100%)',
        border: '1px solid var(--stroke-hair)',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'flex',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 'clamp(64px, 11vw, 148px)',
          lineHeight: 1,
          letterSpacing: '-.04em',
        }}
      >
        {/* Keyed by position and value, so only a digit that changed remounts and turns over. */}
        {digitos.map((d, i) => (
          <span key={`${digitos.length - i}-${d}`} className="digito">
            {d}
          </span>
        ))}
      </span>
      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>{rotulo}</span>
    </div>
  );
}

/** December 2026, with the night circled — set beside the date on a wide screen. */
function MiniCalendario() {
  const primeiroDia = new Date(2026, 11, 1).getDay();
  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({ length: 31 }, (_, i) => i + 1)];
  const celula: CSSProperties = { width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: '50%' };

  return (
    <div
      role="img"
      aria-label="Calendário de dezembro de 2026 com o dia 10 marcado"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 26px)', gap: 3, fontSize: 13, color: 'var(--text-faint)' }}
    >
      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
        <span key={`c${i}`} style={{ ...celula, color: 'var(--smoke-500)', fontSize: 11 }}>
          {d}
        </span>
      ))}
      {celulas.map((dia, i) =>
        dia === 10 ? (
          <span
            key={i}
            style={{ ...celula, background: 'var(--ice-300)', color: 'var(--accent-ink)', fontWeight: 700, boxShadow: '0 0 24px rgba(169,211,232,.5)' }}
          >
            {dia}
          </span>
        ) : (
          <span key={i} style={celula}>
            {dia}
          </span>
        ),
      )}
    </div>
  );
}

/** Scene 5. The practical facts of the night, as tiles that rise in one after another. */
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
          {/* The calendar drops under the date when the tile is too narrow for both. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-6)' }}>
            <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Pequeno>Quinta-feira</Pequeno>
              <Grande tamanho="clamp(52px, 5vw, 72px)">10 de dezembro</Grande>
              <Pequeno>de 2026</Pequeno>
            </div>
            {mobile ? null : <MiniCalendario />}
          </div>
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

// Where the sparks of the close sit, as % of the section, with each one's
// own pace — fixed, so the page looks the same on every visit.
const BRILHOS: [number, number, number, number][] = [
  [8, 22, 3.2, 0], [17, 64, 2.6, 1.1], [26, 38, 3.8, 0.4], [34, 80, 2.9, 2], [41, 16, 3.4, 1.6],
  [58, 20, 3, 0.7], [66, 72, 3.6, 1.9], [73, 34, 2.7, 0.2], [82, 58, 3.3, 1.3], [91, 26, 2.8, 0.9],
  [12, 86, 3.5, 2.4], [48, 90, 3.1, 0.6], [87, 84, 2.5, 1.7], [4, 50, 3.7, 1], [96, 48, 3.2, 2.2],
];

/** The close: the night turns gold, one line, and the way to everything else. */
function Fechamento() {
  const navigate = useNavigate();
  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        marginTop: 'var(--space-10)',
        padding: 'var(--space-11) var(--gutter-page)',
        textAlign: 'center',
        background: 'radial-gradient(90% 70% at 50% 100%, rgba(201,169,106,.22) 0%, rgba(201,169,106,.06) 45%, rgba(201,169,106,0) 75%)',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {BRILHOS.map(([x, y, dur, atraso], i) => (
          <span
            key={i}
            className="brilho"
            style={{ left: `${x}%`, top: `${y}%`, ['--dur-brilho' as string]: `${dur}s`, ['--atraso-brilho' as string]: `${atraso}s` }}
          />
        ))}
      </div>
      <Revela style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-7)' }}>
        <img
          src="/assets/logo-32-pequena.png"
          alt=""
          style={{ height: 72, width: 'auto', filter: 'drop-shadow(0 0 32px rgba(220,196,140,.35))' }}
        />
        <h2
          className="texto-ouro"
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--fs-display-1)',
            lineHeight: 'var(--lh-tight)',
            letterSpacing: '-.04em',
          }}
        >
          Até lá.
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button size="lg" variant="gild" onClick={() => navigate('/baile')}>
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
