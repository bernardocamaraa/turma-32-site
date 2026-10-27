import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Search } from 'lucide-react';
import { AbasArea } from '../components/AbasArea';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/SectionHeading';
import { lerCodigo, salvarCodigo } from '../lib/codigoComissao';
import type { AcessoMesas } from '../lib/mesas';
import { buscarVotacao, type AcaoVotacao, type DadosVotacao, type Pergunta, type Resultado, type TipoPergunta } from '../lib/votacao';
import { useIsMobile } from '../lib/useViewport';

const POLL_MS = 20000;

const texto = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * The class vote. Two ways in, like the table map:
 * - /votacao/<link>: a formando's personal link. Votes once per question;
 *   sees a result once the committee releases it.
 * - /votacao: the committee, with its code. Creates questions, follows who
 *   still has to vote, closes them and releases the results.
 */
export function Votacao() {
  const { link } = useParams<{ link?: string }>();
  const [codigo, setCodigo] = useState(() => (link ? '' : lerCodigo()));
  const [dados, setDados] = useState<DadosVotacao | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const acesso: AcessoMesas = link ? { link } : { codigo: codigo.trim() };

  async function entrar() {
    setEntrando(true);
    setErroAcesso(null);
    try {
      setDados(await buscarVotacao(acesso));
      if (!link) salvarCodigo(codigo.trim());
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
      if (!link) salvarCodigo(null);
    } finally {
      setEntrando(false);
    }
  }

  // A personal link logs in by itself; the committee too, with a saved code.
  useEffect(() => {
    if (link || codigo) entrar();
  }, [link]);

  // Results get released and classmates vote from their own phones —
  // refresh now and then so this screen catches up.
  const logado = dados !== null;
  useEffect(() => {
    if (!logado) return;
    let ativo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const novo = await buscarVotacao(acesso);
        if (ativo) setDados(novo);
      } catch (e) {
        console.error(e);
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [logado, link, codigo]);

  /** Runs an action and returns the error message to show, or null if it worked. */
  async function agir(acao: AcaoVotacao): Promise<string | null> {
    setSalvando(true);
    try {
      setDados(await buscarVotacao(acesso, acao));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Não foi possível salvar agora.';
    } finally {
      setSalvando(false);
    }
  }

  function sair() {
    salvarCodigo(null);
    setDados(null);
    setCodigo('');
  }

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
      <PageHeader eyebrow={dados?.comissao ? 'Área da comissão' : 'Área dos formandos'} title="Votação." />
      <AbasArea link={link} />

      {!dados && link ? (
        <Card padding="var(--space-7)">
          <p style={{ ...texto, fontSize: 'var(--fs-body-lg)', color: erroAcesso ? 'var(--state-error)' : 'var(--text-muted)' }}>
            {erroAcesso ?? 'Abrindo a votação…'}
          </p>
          {erroAcesso && !entrando ? (
            <div style={{ display: 'flex', marginTop: 'var(--space-5)' }}>
              <Button variant="secondary" onClick={entrar}>
                Tentar de novo
              </Button>
            </div>
          ) : null}
        </Card>
      ) : !dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={texto}>
              Cada formando vota pelo link pessoal que recebeu da comissão. Se você é formando, abra o seu link. Esta
              entrada é só da comissão.
            </p>
            <Input
              label="Código da comissão"
              placeholder="••••••"
              type="password"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setErroAcesso(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && codigo.trim() && !entrando) entrar();
              }}
            />
            {erroAcesso ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erroAcesso}</span> : null}
            <div style={{ display: 'flex' }}>
              <Button size="lg" disabled={!codigo.trim() || entrando} onClick={entrar}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Button>
            </div>
          </div>
        </Card>
      ) : dados.comissao ? (
        <>
          <NovaPergunta salvando={salvando} agir={agir} />
          {dados.perguntas.length === 0 ? (
            <p style={texto}>Nenhuma votação criada ainda.</p>
          ) : (
            dados.perguntas
              .slice()
              .reverse()
              .map((p) => <PerguntaComissao key={p.id} p={p} total={dados.formandos.length} salvando={salvando} agir={agir} />)
          )}
          <div style={{ display: 'flex' }}>
            <Button variant="ghost" onClick={sair}>
              Sair
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: '40rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.1 }}>
                Olá, {dados.voce?.split(' ')[0]}.
              </span>
              <p style={texto}>
                Seu voto é secreto: ninguém vê em quem você votou, nem a comissão. O site só guarda que você já votou e a
                contagem de cada opção. Por isso, depois de confirmado, o voto não dá para trocar.
              </p>
            </div>
          </Card>
          {dados.perguntas.length === 0 ? (
            <p style={texto}>A comissão ainda não abriu nenhuma votação. Volte por aqui mais tarde.</p>
          ) : (
            dados.perguntas.map((p) => (
              <PerguntaFormando key={p.id} p={p} voce={dados.voce ?? ''} formandos={dados.formandos} salvando={salvando} agir={agir} />
            ))
          )}
        </>
      )}
    </main>
  );
}

/** What a question's state means, as a small pill next to it. */
function Situacao({ p, paraComissao }: { p: Pergunta; paraComissao?: boolean }) {
  if (p.resultadoLiberado) return <Badge tone="gild">Resultado</Badge>;
  if (!p.aberta) return <Badge>{paraComissao ? 'Encerrada · só a comissão vê' : 'Encerrada'}</Badge>;
  if (p.jaVotou) return <Badge tone="ok">Você já votou</Badge>;
  return <Badge tone="ice">Aberta</Badge>;
}

function CabecalhoPergunta({ p, paraComissao, extra }: { p: Pergunta; paraComissao?: boolean; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Situacao p={p} paraComissao={paraComissao} />
        {extra}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h2)',
          fontWeight: 700,
          letterSpacing: '-.025em',
          lineHeight: 1.15,
          textWrap: 'balance' as never,
        }}
      >
        {p.pergunta}
      </h2>
    </div>
  );
}

/** One question, as a formando sees it: choose and confirm, or see that you voted, or the result. */
function PerguntaFormando({
  p,
  voce,
  formandos,
  salvando,
  agir,
}: {
  p: Pergunta;
  voce: string;
  formandos: string[];
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [escolha, setEscolha] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Nobody votes for themselves on the "formandos" questions.
  const opcoes = p.tipo === 'formandos' ? formandos.filter((f) => f !== voce) : p.opcoes;
  const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visiveis = busca ? opcoes.filter((o) => normalizar(o).includes(normalizar(busca))) : opcoes;

  async function votar() {
    if (!escolha) return;
    setErro(null);
    setErro(await agir({ acao: 'votar', id: p.id, opcao: escolha }));
  }

  return (
    <Card padding="clamp(24px, 4vw, 40px)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPergunta p={p} />

        {p.resultado ? (
          <Barras resultado={p.resultado} votaram={p.votaram} />
        ) : p.jaVotou ? (
          <Aviso icone>Seu voto foi registrado. O resultado aparece aqui quando a comissão liberar.</Aviso>
        ) : !p.aberta ? (
          <Aviso>Essa votação foi encerrada. O resultado aparece aqui quando a comissão liberar.</Aviso>
        ) : (
          <>
            {p.tipo === 'formandos' ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  height: 44,
                  padding: '0 var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--ink-800)',
                  border: '1px solid var(--stroke-hair)',
                  maxWidth: 360,
                }}
              >
                <Search size={16} strokeWidth={1.8} aria-hidden style={{ color: 'var(--text-faint)' }} />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Procurar um nome"
                  aria-label="Procurar um nome"
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--fs-body)' }}
                />
              </label>
            ) : null}

            <div role="radiogroup" aria-label={p.pergunta} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {visiveis.map((o) => {
                const ativa = escolha === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={ativa}
                    onClick={() => setEscolha(ativa ? null : o)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 44,
                      padding: '0 18px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid ' + (ativa ? 'var(--chalk-050)' : 'var(--stroke-hair)'),
                      background: ativa ? 'var(--chalk-050)' : 'rgba(245,245,247,.06)',
                      color: ativa ? '#000' : 'var(--text-primary)',
                      fontSize: 'var(--fs-body)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
                      transform: ativa ? 'scale(1.03)' : 'none',
                    }}
                  >
                    {ativa ? <Check size={16} strokeWidth={2.4} aria-hidden /> : null}
                    {o}
                  </button>
                );
              })}
              {visiveis.length === 0 ? <span style={pequeno}>Nenhum nome encontrado.</span> : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <Button size="lg" disabled={!escolha || salvando} onClick={votar}>
                {salvando && escolha ? 'Votando…' : escolha ? `Votar em ${escolha}` : 'Escolha uma opção'}
              </Button>
              <span style={pequeno}>O voto é secreto e não dá para trocar depois.</span>
            </div>
          </>
        )}
        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}
      </div>
    </Card>
  );
}

function Aviso({ children, icone }: { children: ReactNode; icone?: boolean }) {
  return (
    <p style={{ ...texto, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      {icone ? (
        <span
          aria-hidden
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(127,185,138,.16)',
            color: 'var(--state-ok)',
          }}
        >
          <Check size={16} strokeWidth={2.4} />
        </span>
      ) : null}
      {children}
    </p>
  );
}

/**
 * The tally as bars that grow to size when they appear, most voted first;
 * the winner (or the tied winners) in gold.
 */
function Barras({ resultado, votaram }: { resultado: Resultado[]; votaram: number | null }) {
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheio(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const total = resultado.reduce((s, r) => s + r.votos, 0);
  const maximo = Math.max(...resultado.map((r) => r.votos), 0);

  if (total === 0) return <Aviso>Ninguém votou nessa pergunta.</Aviso>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {resultado.map((r, i) => {
        const vencedor = r.votos === maximo && maximo > 0;
        const fracao = r.votos / total;
        return (
          <div key={r.opcao} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 'var(--fs-body)' }}>
              <span style={{ fontWeight: vencedor ? 600 : 400, color: vencedor ? 'var(--gild-300)' : 'var(--text-primary)' }}>{r.opcao}</span>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {plural(r.votos, 'voto', 'votos')} · {Math.round(fracao * 100)}%
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(245,245,247,.08)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: cheio ? `${Math.max(fracao * 100, r.votos ? 2 : 0)}%` : '0%',
                  borderRadius: 4,
                  background: vencedor ? 'var(--gild-400)' : 'var(--ice-400)',
                  transition: `width 1100ms var(--ease-out) ${i * 70}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
      {votaram !== null ? <span style={pequeno}>{plural(votaram, 'formando votou', 'formandos votaram')}.</span> : null}
    </div>
  );
}

/** The committee's form for a new question. */
function NovaPergunta({ salvando, agir }: { salvando: boolean; agir: (a: AcaoVotacao) => Promise<string | null> }) {
  const mobile = useIsMobile();
  const [pergunta, setPergunta] = useState('');
  const [tipo, setTipo] = useState<TipoPergunta>('formandos');
  const [opcoes, setOpcoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const lista = opcoes.split('\n').map((o) => o.trim()).filter(Boolean);
  const pronta = pergunta.trim().length >= 3 && (tipo === 'formandos' || lista.length >= 2);

  async function criar() {
    setErro(null);
    const falha = await agir({ acao: 'criar', texto: pergunta, tipo, opcoes: lista });
    setErro(falha);
    if (!falha) {
      setPergunta('');
      setOpcoes('');
    }
  }

  return (
    <Card padding={mobile ? 'var(--space-6)' : 'var(--space-7)'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: '40rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>Nova votação</span>
        <Input label="Pergunta" placeholder="Ex.: Quem vai ficar rico primeiro?" value={pergunta} maxLength={200} onChange={(e) => setPergunta(e.target.value)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 500, color: 'var(--text-muted)' }}>Opções</span>
          <div
            role="radiogroup"
            aria-label="Tipo de pergunta"
            style={{ display: 'inline-flex', alignSelf: 'flex-start', flexWrap: 'wrap', gap: 2, padding: 3, borderRadius: 'var(--radius-pill)', background: 'rgba(245,245,247,.08)' }}
          >
            {(
              [
                ['formandos', 'Os formandos'],
                ['opcoes', 'Escritas por vocês'],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={tipo === valor}
                onClick={() => setTipo(valor)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  fontSize: 'var(--fs-body-sm)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: tipo === valor ? '#000' : 'var(--text-muted)',
                  background: tipo === valor ? 'var(--chalk-050)' : 'transparent',
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {tipo === 'formandos' ? (
            <span style={pequeno}>Cada formando escolhe um colega da turma (ninguém vota em si mesmo).</span>
          ) : (
            <>
              <textarea
                value={opcoes}
                onChange={(e) => setOpcoes(e.target.value)}
                rows={5}
                placeholder={'Uma opção por linha\nEx.: Música A\nMúsica B'}
                aria-label="Opções, uma por linha"
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--ink-800)',
                  border: '1px solid var(--stroke-hair)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-core)',
                  fontSize: 'var(--fs-body)',
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />
              <span style={pequeno}>
                {lista.length < 2 ? 'Escreva pelo menos 2 opções, uma por linha.' : `${lista.length} opções.`}
              </span>
            </>
          )}
        </div>

        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}
        <div style={{ display: 'flex' }}>
          <Button size="lg" disabled={!pronta || salvando} onClick={criar}>
            {salvando ? 'Criando…' : 'Criar votação'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** One question, as the committee sees it: who voted, the result once closed, and what to do next. */
function PerguntaComissao({
  p,
  total,
  salvando,
  agir,
}: {
  p: Pergunta;
  total: number;
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const votaram = p.votaram ?? 0;

  async function fazer(acao: 'encerrar' | 'liberar' | 'esconder' | 'excluir', confirmacao?: string) {
    if (confirmacao && !window.confirm(confirmacao)) return;
    setErro(null);
    setErro(await agir({ acao, id: p.id }));
  }

  return (
    <Card padding="clamp(24px, 4vw, 40px)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPergunta
          p={p}
          paraComissao
          extra={<span style={pequeno}>{p.tipo === 'formandos' ? 'Entre os formandos' : plural(p.opcoes.length, 'opção', 'opções')}</span>}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 'var(--fs-body)' }}>
            <span>
              {votaram} de {total} formandos votaram
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{total ? Math.round((votaram / total) * 100) : 0}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(245,245,247,.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${total ? (votaram / total) * 100 : 0}%`, background: 'var(--ice-300)', transition: 'width var(--dur-slow) var(--ease-out)' }} />
          </div>
          {p.aberta && p.faltam && p.faltam.length > 0 ? (
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-body-sm)', color: 'var(--accent)' }}>
                Quem ainda não votou ({p.faltam.length})
              </summary>
              <p style={{ ...texto, fontSize: 'var(--fs-body-sm)', marginTop: 'var(--space-3)' }}>{p.faltam.join(', ')}</p>
            </details>
          ) : null}
        </div>

        {p.resultado ? (
          <Barras resultado={p.resultado} votaram={null} />
        ) : (
          <p style={{ ...pequeno, margin: 0 }}>
            A contagem aparece para vocês quando encerrarem a votação. Enquanto ela está aberta, ninguém vê, para que
            não dê para descobrir o voto de alguém comparando quem acabou de votar com quem ganhou um voto.
          </p>
        )}

        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          {p.aberta ? (
            <Button
              variant="secondary"
              disabled={salvando}
              onClick={() =>
                fazer('encerrar', 'Encerrar não tem volta: depois disso ninguém mais vota nessa pergunta, e vocês passam a ver a contagem. Encerrar?')
              }
            >
              Encerrar votação
            </Button>
          ) : null}
          {!p.resultadoLiberado ? (
            <Button
              disabled={salvando}
              onClick={() =>
                fazer(
                  'liberar',
                  p.aberta
                    ? 'Isso encerra a votação (sem volta) e mostra o resultado para a turma toda. Continuar?'
                    : 'Mostrar o resultado para a turma toda?',
                )
              }
            >
              Mostrar resultado para a turma
            </Button>
          ) : (
            <Button variant="secondary" disabled={salvando} onClick={() => fazer('esconder')}>
              Esconder resultado
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={salvando}
            onClick={() => fazer('excluir', `Excluir "${p.pergunta}" e todos os votos dela? Não dá para desfazer.`)}
            style={{ color: 'var(--state-error)' }}
          >
            Excluir
          </Button>
        </div>
      </div>
    </Card>
  );
}
