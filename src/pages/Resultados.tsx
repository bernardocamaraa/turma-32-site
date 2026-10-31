import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { PageHeader } from '../components/SectionHeading';
import { lerCodigo } from '../lib/codigoComissao';
import { Revela, Titulo } from '../components/Cena';
import { usePrefersReducedMotion } from '../lib/useViewport';
import { buscarVotacao, chaveDoNome, resultadoDaTurma, type AcessoVotacao, type DadosVotacao } from '../lib/votacao';
import { ConfeteDourado, POLL_MS, Pulpito, REVELA, useRevelacao } from './Votacao';

type Lugar = { chave: string; nome: string; votos: number | null; cargo: string };

/**
 * The places the class sees, in the ballot's order: each released result's
 * names (the server already cut them down to what shows), or — for the
 * committee — what each closed question would show once released
 * (resultadoDaTurma, as in its preview on the vote's tab).
 */
function lugaresDe(dados: DadosVotacao): Lugar[] {
  return dados.perguntas.flatMap((p) => {
    if (!p.resultado) return [];
    if (dados.comissao && (p.aberta || p.pronta)) return [];
    const mostra = dados.comissao ? resultadoDaTurma(p.resultado, p.exibicao, p.eleitosEmOutra) : p.resultado;
    return mostra.map((r) => ({ chave: `${p.id}:${r.opcao}`, nome: r.opcao, votos: r.votos, cargo: p.cargo ?? p.pergunta }));
  });
}

/**
 * /resultados: the whole vote's result on one stage — it's one vote with
 * several questions, so every winner stands over their pulpit, the role
 * written on each, one under the other, each revealed as it comes into view. Not linked from
 * the site: the committee sends the link to the class. Whoever opens it
 * sees each result once the committee releases it, no WhatsApp needed. On
 * a committee phone (its code saved by the committee area) it's a preview
 * of every closed question, released or not.
 */
export function Resultados() {
  const [codigo] = useState(lerCodigo);
  const [dados, setDados] = useState<DadosVotacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const acesso: AcessoVotacao = codigo ? { codigo } : {};

  async function carregar() {
    setErro(null);
    try {
      setDados(await buscarVotacao(acesso));
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
        setDados(await buscarVotacao(acesso));
      } catch (e) {
        console.error(e);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pronto]);

  const lugares = dados ? lugaresDe(dados) : [];
  const naoLiberadas = dados?.comissao ? dados.perguntas.filter((p) => !p.aberta && !p.pronta && !p.resultadoLiberado).length : 0;

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
          {dados.comissao ? (
            <Card padding="var(--space-6) var(--space-7)">
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
                Prévia da comissão: aqui aparece tudo o que já foi encerrado, como a turma vai ver.
                {naoLiberadas > 0
                  ? ` ${naoLiberadas === 1 ? '1 resultado ainda não foi mostrado' : `${naoLiberadas} resultados ainda não foram mostrados`} para a turma: cada um aparece para eles quando vocês mostrarem na aba Votação.`
                  : ''}
              </p>
            </Card>
          ) : null}

          {lugares.length > 0 ? (
            <>
              <Palco lugares={lugares} />
              <DicaDeRolar />
              <Agradecimento nomes={candidatosDe(dados)} />
            </>
          ) : (
            <Card padding="var(--space-7)">
              <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
                {dados.comissao
                  ? 'Nenhuma votação foi encerrada ainda.'
                  : 'Os resultados ainda não saíram. Esta página mostra cada um assim que a comissão liberar.'}
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
  const noPalco = dados.perguntas.filter((p) => p.resultado && (!dados.comissao || (!p.aberta && !p.pronta)));
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
 * Every place on one stage, one pulpit under the other, well apart, so each
 * winner gets the stage to themselves.
 */
function Palco({ lugares }: { lugares: Lugar[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-10)' }}>
      {lugares.map((l) => (
        <LugarNoPalco key={l.chave} lugar={l} />
      ))}
    </div>
  );
}

/**
 * One pulpit, revealed when it scrolls into view — further down the page,
 * the ones below would otherwise play to nobody: the pulpit rises, the
 * light comes on, the name comes out, and gold confetti bursts over it.
 */
function LugarNoPalco({ lugar }: { lugar: Lugar }) {
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
      style={{ position: 'relative', width: '100%', overflowX: 'clip' }}
    >
      <ol ref={lista} style={{ listStyle: 'none', margin: 0, padding: 'var(--space-8) 0 0', display: 'flex', justifyContent: 'center' }}>
        <Pulpito nome={lugar.nome} votos={lugar.votos} cargo={lugar.cargo} atraso={REVELA.primeiro} lado={false} />
      </ol>
      {estado === 'agora' && centro ? <ConfeteDourado meio={centro.meio} altura={centro.altura} atraso={fim - 80} /> : null}
    </div>
  );
}
