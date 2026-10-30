import { useEffect, useRef, useState } from 'react';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { MensagemDaLivia } from '../components/MensagemDaLivia';
import { PageHeader } from '../components/SectionHeading';
import { lerCodigo } from '../lib/codigoComissao';
import { buscarVotacao, resultadoDaTurma, type AcessoVotacao, type DadosVotacao } from '../lib/votacao';
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
 * several questions, so every winner stands side by side over their pulpit,
 * the role written on each, revealed one after the other. Not linked from
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
            // Keyed by what's on stage, so a result released meanwhile plays the reveal again with it.
            <>
              <Palco key={lugares.map((l) => l.chave).join('|')} lugares={lugares} />
              {/* Her message explains part of the result, so it comes with it. */}
              <div style={{ marginTop: 'var(--space-8)' }}>
                <MensagemDaLivia />
              </div>
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
 * Every place on one stage: the pulpits rise together when the stage comes
 * into view, then the lights come on and the names come out one by one,
 * and gold confetti bursts over them as the last one lands.
 */
function Palco({ lugares }: { lugares: Lugar[] }) {
  const [ref, estado] = useRevelacao<HTMLDivElement>();
  const lista = useRef<HTMLOListElement>(null);
  const [centro, setCentro] = useState<{ meio: number; altura: number } | null>(null);
  const nome = (i: number) => REVELA.primeiro + i * REVELA.entre;
  const fim = nome(lugares.length - 1) + REVELA.nome * 0.6;

  useEffect(() => {
    const ol = lista.current;
    if (estado !== 'agora' || !ol) return;
    const nomes = [...ol.querySelectorAll('[data-nome]')].map((el) => el.getBoundingClientRect());
    if (nomes.length === 0) return;
    const caixa = ol.getBoundingClientRect();
    setCentro({
      meio: (Math.min(...nomes.map((r) => r.left)) + Math.max(...nomes.map((r) => r.right))) / 2 - caixa.left,
      altura: (Math.min(...nomes.map((r) => r.top)) + Math.max(...nomes.map((r) => r.bottom))) / 2 - caixa.top,
    });
  }, [estado]);

  return (
    <div
      ref={ref}
      className={estado === 'espera' ? 'revela-espera' : estado === 'agora' ? 'revela-agora' : undefined}
      // The lights spread past the outer pulpits: cut at the sides, so a phone doesn't scroll sideways.
      style={{ position: 'relative', overflowX: 'clip' }}
    >
      <ol
        ref={lista}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 'var(--space-8) 0 0',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 'var(--space-8) var(--space-5)',
        }}
      >
        {lugares.map((l, i) => (
          <Pulpito key={l.chave} nome={l.nome} votos={l.votos} cargo={l.cargo} atraso={nome(i)} lado />
        ))}
      </ol>
      {estado === 'agora' && centro ? <ConfeteDourado meio={centro.meio} altura={centro.altura} atraso={fim - 80} /> : null}
    </div>
  );
}
