import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { PageHeader } from '../components/SectionHeading';
import { Revela, Titulo } from '../components/Cena';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';
import { buscarVotacao, chaveDoNome, type DadosVotacao } from '../lib/votacao';
import { ConfeteDourado, POLL_MS, Pulpito, REVELA, useRevelacao } from './Votacao';

type Lugar = { chave: string; nome: string; votos: number | null; cargo: string };

/**
 * The places, in the ballot's order: each released result's names (the
 * server already cut them down to what the class sees).
 */
function lugaresDe(dados: DadosVotacao): Lugar[] {
  return dados.perguntas.flatMap((p) =>
    (p.resultado ?? []).map((r) => ({ chave: `${p.id}:${r.opcao}`, nome: r.opcao, votos: r.votos, cargo: p.cargo ?? p.pergunta })),
  );
}

/**
 * /resultados: the whole vote's result on one stage — it's one vote with
 * several questions, so every winner stands over their pulpit, the role
 * written on each, one under the other, each revealed as it comes into
 * view. Not linked from the site: the committee sends the link to the
 * class. Whoever opens it — the committee too — sees each result once the
 * committee releases it, no WhatsApp needed; the committee previews a
 * result before releasing it on the vote's tab.
 */
export function Resultados() {
  const [dados, setDados] = useState<DadosVotacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    try {
      setDados(await buscarVotacao({}));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir agora.');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Results come out while the page is open: check now and then.
  const pronto = dados !== null;
  useEffect(() => {
    if (!pronto) return;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        setDados(await buscarVotacao({}));
      } catch (e) {
        console.error(e);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pronto]);

  const lugares = dados ? lugaresDe(dados) : [];

  return (
    <main
      style={{
        maxWidth: 'var(--maxw-page)',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-7)',
      }}
    >
      <PageHeader eyebrow="Turma 32" title="Resultado da votação." />

      {!dados ? (
        <CarregandoSecao erro={erro} onTentar={carregar} />
      ) : (
        <>
          {lugares.length > 0 ? (
            <>
              <Palco lugares={lugares} />
              <DicaDeRolar />
              <Agradecimento nomes={candidatosDe(dados)} />
            </>
          ) : (
            <Card padding="var(--space-7)">
              <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
                Os resultados ainda não saíram. Esta página mostra cada um assim que a comissão liberar.
              </p>
            </Card>
          )}
        </>
      )}
    </main>
  );
}

/**
 * Everyone who ran in the questions on stage, each once (a name can be an
 * option in several), in alphabetical order.
 */
function candidatosDe(dados: DadosVotacao): string[] {
  const noPalco = dados.perguntas.filter((p) => p.resultado);
  const nomes = new Map<string, string>();
  for (const p of noPalco) for (const o of p.tipo === 'opcoes' ? p.opcoes : []) if (!nomes.has(chaveDoNome(o))) nomes.set(chaveDoNome(o), o);
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** At the bottom of the page: thanks to everyone who put their name forward, winners or not. */
function Agradecimento({ nomes }: { nomes: string[] }) {
  return (
    <Revela
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-5)',
        marginTop: 'var(--space-9)',
        paddingTop: 'var(--space-9)',
        borderTop: '1px solid var(--stroke-hair)',
        textAlign: 'center',
      }}
    >
      <Titulo tamanho="var(--fs-h1)">Obrigado a todos que se candidataram.</Titulo>
      <p style={{ margin: 0, maxWidth: '36rem', fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
        Colocar o nome à disposição da turma não é pouca coisa. Cada candidatura fez desta votação uma escolha de verdade, e
        qualquer um de vocês faria bonito em cima daquele púlpito.
      </p>
      {nomes.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxWidth: '40rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 'var(--space-2) var(--space-5)',
            fontSize: 'var(--fs-body)',
            color: 'var(--gild-300)',
          }}
        >
          {nomes.map((n) => (
            <li key={n} style={{ whiteSpace: 'nowrap' }}>
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>Comissão de formatura da Turma 32</span>
    </Revela>
  );
}

/**
 * "There's more below": with one pulpit under the other, most of the stage
 * starts off screen. Pinned to the bottom of the screen, gone once the
 * page's end is in sight (and back if it scrolls up again).
 */
function DicaDeRolar() {
  const reduzido = usePrefersReducedMotion();
  const [mais, setMais] = useState(false);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      raf = 0;
      setMais(window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 240);
    };
    const agendar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    return () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        display: 'flex',
        justifyContent: 'center',
        padding: '48px 0 max(20px, env(safe-area-inset-bottom))',
        // A fade from the page's black, so the hint reads over whatever is under it.
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.85) 70%)',
        opacity: mais ? 1 : 0,
        transition: 'opacity var(--dur-slow) var(--ease-out)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'var(--text-muted)', fontSize: 'var(--fs-body-sm)' }}>
        Role para ver todos
        <ChevronDown size={24} strokeWidth={1.8} style={{ animation: reduzido ? undefined : 'dica-rolar 2200ms var(--ease-in-out) infinite' }} />
      </div>
    </div>
  );
}

/**
 * Every place on one stage, well apart, so each winner gets room of their
 * own: on a phone one pulpit under the other; on a wider screen side by
 * side (three across on a computer), the last row centred.
 */
function Palco({ lugares }: { lugares: Lugar[] }) {
  const mobile = useIsMobile();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: mobile ? 'column' : 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: mobile ? 'center' : 'flex-end',
        gap: mobile ? 'var(--space-10)' : 'var(--space-9) var(--space-6)',
      }}
    >
      {lugares.map((l) => (
        <LugarNoPalco key={l.chave} lugar={l} largura={mobile ? '100%' : 'min(310px, 100%)'} />
      ))}
    </div>
  );
}

/**
 * One pulpit, revealed when it scrolls into view — further down the page,
 * the ones below would otherwise play to nobody: the pulpit rises, the
 * light comes on, the name comes out, and gold confetti bursts over it.
 */
function LugarNoPalco({ lugar, largura }: { lugar: Lugar; largura: string }) {
  const [ref, estado] = useRevelacao<HTMLDivElement>();
  const lista = useRef<HTMLOListElement>(null);
  const [centro, setCentro] = useState<{ meio: number; altura: number } | null>(null);
  const fim = REVELA.primeiro + REVELA.nome * 0.6;

  useEffect(() => {
    const ol = lista.current;
    const nome = ol?.querySelector('[data-nome]');
    if (estado !== 'agora' || !ol || !nome) return;
    const caixa = ol.getBoundingClientRect();
    const r = nome.getBoundingClientRect();
    setCentro({ meio: (r.left + r.right) / 2 - caixa.left, altura: (r.top + r.bottom) / 2 - caixa.top });
  }, [estado]);

  return (
    <div
      ref={ref}
      className={estado === 'espera' ? 'revela-espera' : estado === 'agora' ? 'revela-agora' : undefined}
      // The light spreads past the pulpit: cut at the sides, so a phone doesn't scroll sideways.
      style={{ position: 'relative', width: largura, overflowX: 'clip' }}
    >
      <ol ref={lista} style={{ listStyle: 'none', margin: 0, padding: 'var(--space-8) 0 0', display: 'flex', justifyContent: 'center' }}>
        <Pulpito nome={lugar.nome} votos={lugar.votos} cargo={lugar.cargo} atraso={REVELA.primeiro} lado={false} />
      </ol>
      {estado === 'agora' && centro ? <ConfeteDourado meio={centro.meio} altura={centro.altura} atraso={fim - 80} /> : null}
    </div>
  );
}
