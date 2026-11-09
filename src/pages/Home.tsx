import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, ChevronDown } from 'lucide-react';
import { Button } from '../components/Button';
import { MAPS_LINK } from '../components/MapEmbed';
import { SectionEyebrowRule } from '../components/SectionHeading';
import { AvisoConfirmacao } from '../components/AvisoConfirmacao';
import { Bloco, Grande, LinkSeta, MapaInclinado, NomeComPincelada, Pequeno, Revela, Titulo } from '../components/Cena';
import { EVENTO_ICS, LINK_GOOGLE_AGENDA } from '../lib/calendario';
import { useCountdown } from '../lib/countdown';
import { assinaturaDe, FORMANDOS } from '../lib/formandos';
import { trecho, useProgressoRolagem } from '../lib/motion';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

/**
 * The page opens as the class's printed invitation and keeps its paper,
 * serif and navy all the way down.
 */
export function Home() {
  return (
    <main>
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
 * Scene 1. The invitation itself, as the class printed it: the signatures of
 * the class faint on paper, a name in brush script underlined in navy, the
 * classic serif for the date, the italic navy time, the address in spaced
 * small caps and the logo, small and gray, at the foot.
 */
function Abertura() {
  const mobile = useIsMobile();
  const entra = (atraso: number): CSSProperties => ({ animation: `om-rise 1400ms var(--ease-out) ${atraso}ms both` });

  return (
    <section
      className="papel-assinaturas"
      style={{
        position: 'relative',
        minHeight: 'calc(100svh - 52px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${mobile ? 'var(--space-9)' : 'var(--space-10)'} var(--gutter-page)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: 760,
        }}
      >
        <h1 style={{ margin: 0, ...entra(100) }}>
          <NomeComPincelada tamanho={mobile ? 'clamp(64px, 19vw, 96px)' : 'clamp(96px, 11vw, 150px)'}>Turma 32</NomeComPincelada>
        </h1>
        <p
          style={{
            margin: `${mobile ? 'var(--space-6)' : 'var(--space-7)'} 0 0`,
            maxWidth: 560,
            fontFamily: 'var(--font-display)',
            fontSize: mobile ? 21 : 26,
            lineHeight: 1.4,
            color: 'var(--text-primary)',
            textWrap: 'balance' as never,
            ...entra(500),
          }}
        >
          Com muito carinho, os formandos da Turma 32 convidam você para a cerimônia de formatura, no dia
        </p>
        <p
          className="numeros-antigos"
          style={{
            margin: 'var(--space-6) 0 0',
            fontFamily: 'var(--font-display)',
            fontSize: mobile ? 'clamp(38px, 11vw, 48px)' : 'clamp(52px, 6vw, 76px)',
            lineHeight: 1.05,
            color: 'var(--text-primary)',
            textWrap: 'balance' as never,
            ...entra(750),
          }}
        >
          10 de dezembro de 2026
        </p>
        <p
          style={{
            margin: 'var(--space-3) 0 0',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: mobile ? 24 : 30,
            color: 'var(--accent)',
            ...entra(900),
          }}
        >
          às 19 horas
        </p>
        <address
          className="versalete"
          style={{ margin: `${mobile ? 'var(--space-7)' : 'var(--space-8)'} 0 0`, fontStyle: 'normal', lineHeight: 1.9, ...entra(1050) }}
        >
          Ballroom Casa de Festas
          <br />
          R. Dr. Barros Júnior, 1301
          <br />
          Moquetá, Nova Iguaçu - RJ
        </address>
        <p className="versalete" style={{ margin: 'var(--space-5) 0 0', ...entra(1150) }}>
          Traje passeio completo
        </p>
        <img
          src="/assets/logo-32-pequena.png"
          alt=""
          className="logo-carimbo"
          style={{ height: mobile ? 64 : 76, width: 'auto', marginTop: mobile ? 'var(--space-8)' : 'var(--space-9)', ...entra(1300) }}
        />
      </div>
      {/* "There's more below". */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 'max(20px, env(safe-area-inset-bottom))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ animation: 'om-fade-in 900ms var(--ease-out) 2200ms both' }}>
          <ChevronDown
            size={26}
            strokeWidth={1.4}
            color="var(--text-faint)"
            style={{ display: 'block', animation: 'dica-rolar 2200ms var(--ease-in-out) infinite' }}
          />
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
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: mobile ? 30 : 'clamp(38px, 4.2vw, 58px)',
            lineHeight: 1.22,
            letterSpacing: '-.01em',
            textAlign: 'center',
          }}
        >
          {palavras.map((palavra, i) => (
            <span
              key={i}
              style={{
                color: i < acesas ? 'var(--text-primary)' : 'var(--wall-500)',
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
            className="assinatura-tinta"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
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
        background: `radial-gradient(70% 55% at 50% 55%, rgba(31,63,91,${(0.12 * brilho).toFixed(3)}) 0%, rgba(31,63,91,0) 70%)`,
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
        background: 'linear-gradient(180deg, var(--ink-850) 0%, var(--ink-850) 50%, #f4f2ed 50%, #f4f2ed 100%)',
        boxShadow: '0 1px 2px rgba(46,46,46,.06), 0 12px 32px -18px rgba(46,46,46,.25)',
        border: '1px solid var(--stroke-hair)',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'flex',
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(64px, 11vw, 148px)',
          lineHeight: 1,
          letterSpacing: '-.02em',
        }}
      >
        {/* Keyed by position and value, so only a digit that changed remounts and turns over. */}
        {digitos.map((d, i) => (
          <span key={`${digitos.length - i}-${d}`} className="digito">
            {d}
          </span>
        ))}
      </span>
      <span className="versalete" style={{ fontSize: 12 }}>{rotulo}</span>
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
            style={{ ...celula, background: 'var(--ice-300)', color: 'var(--accent-ink)', fontWeight: 700 }}
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
      <Revela style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
        <NomeComPincelada tamanho="var(--fs-display-3)" como="h2">A noite, em resumo</NomeComPincelada>
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

/** The close: the class's sign-off, in the invitation's script, and the way to everything else. */
function Fechamento() {
  const navigate = useNavigate();
  return (
    <section
      className="papel-assinaturas"
      style={{
        position: 'relative',
        marginTop: 'var(--space-10)',
        padding: 'var(--space-11) var(--gutter-page)',
        textAlign: 'center',
      }}
    >
      <Revela style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-7)' }}>
        <h2 style={{ margin: 0 }}>
          <NomeComPincelada tamanho="var(--fs-display-1)">Até lá</NomeComPincelada>
        </h2>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'var(--fs-body-lg)', color: 'var(--text-muted)' }}>
          Com carinho, os formandos da Turma 32.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button size="lg" onClick={() => navigate('/baile')}>
            Detalhes da noite
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/baile#duvidas')}>
            Perguntas frequentes
          </Button>
        </div>
        <img src="/assets/logo-32-pequena.png" alt="" className="logo-carimbo" style={{ height: 64, width: 'auto' }} />
      </Revela>
    </section>
  );
}
