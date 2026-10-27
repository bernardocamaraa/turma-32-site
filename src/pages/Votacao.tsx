import { useEffect, useState, type ReactNode } from 'react';
import { Check, Search } from 'lucide-react';
import { Badge } from '../components/Badge';
import { BotoesLink } from '../components/BotoesLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { PageHeader } from '../components/SectionHeading';
import { lerCodigo, salvarCodigo } from '../lib/codigoComissao';
import {
  buscarVotacao,
  formatarWhatsapp,
  normalizarWhatsapp,
  urlDaVotacao,
  type AcaoVotacao,
  type AcessoVotacao,
  type DadosVotacao,
  type Pergunta,
  type Resultado,
  type TipoPergunta,
} from '../lib/votacao';
import { useIsMobile } from '../lib/useViewport';

const POLL_MS = 20000;

const texto = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const CHAVE_ELEITOR = 'turma32-votacao-eleitor';

// Remembers who's voting on this phone, so the number isn't retyped on
// every visit. Storage can be blocked (private mode) — then the page just
// asks again.
function lerEleitor(): { whatsapp: string } | null {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ELEITOR) ?? 'null');
    return salvo && typeof salvo.whatsapp === 'string' ? { whatsapp: salvo.whatsapp } : null;
  } catch {
    return null;
  }
}

function salvarEleitor(valor: { whatsapp: string } | null) {
  try {
    if (valor) localStorage.setItem(CHAVE_ELEITOR, JSON.stringify(valor));
    else localStorage.removeItem(CHAVE_ELEITOR);
  } catch {
    // ignore — see lerEleitor
  }
}

/**
 * The class vote — its own page, apart from the table map, with one link
 * for everyone:
 * - /votacao: a formando types their WhatsApp and the site knows who they
 *   are (the committee fills the numbers in). A number not on the list
 *   picks a name that has none yet. Votes once per question; sees a result
 *   once the committee releases it.
 * - /votacao/comissao: the committee, with its code. Shares the link,
 *   fills in each formando's number, creates questions, follows who still
 *   has to vote, closes them and releases the results.
 */
export function Votacao({ paraComissao = false }: { paraComissao?: boolean }) {
  const [codigo, setCodigo] = useState(() => (paraComissao ? lerCodigo() : ''));
  const [eleitor, setEleitor] = useState(() => (paraComissao ? null : lerEleitor()));
  const [dados, setDados] = useState<DadosVotacao | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const acesso: AcessoVotacao = paraComissao ? { codigo: codigo.trim() } : eleitor ?? {};

  /** Loads with `com` and returns what came back, or null if it failed (the error is shown). */
  async function carregar(com: AcessoVotacao): Promise<DadosVotacao | null> {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const novo = await buscarVotacao(com);
      setDados(novo);
      if (paraComissao) salvarCodigo(codigo.trim());
      return novo;
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
      if (paraComissao) salvarCodigo(null);
      return null;
    } finally {
      setEntrando(false);
    }
  }

  // A remembered number that's no longer on the list (the committee changed
  // it): forget it, so the page asks again.
  function conferirEleitor(novo: DadosVotacao) {
    if (!paraComissao && !novo.voce) {
      salvarEleitor(null);
      setEleitor(null);
    }
  }

  // Formandos: load right away (with the remembered number, if any).
  // Committee: only with a saved code.
  useEffect(() => {
    if (!paraComissao || codigo) {
      carregar(acesso).then((novo) => {
        if (novo && eleitor) conferirEleitor(novo);
      });
    }
  }, [paraComissao]);

  /**
   * Enters with a number — and the name picked, when the number isn't on
   * the list. Returns whether it worked, or 'semNome' if the number isn't
   * on the list and a name is needed.
   */
  async function identificar(whatsapp: string, nome?: string): Promise<boolean | 'semNome'> {
    const novo = await carregar(nome ? { whatsapp, nome } : { whatsapp });
    if (!novo) return false;
    if (!novo.voce) return 'semNome';
    salvarEleitor({ whatsapp });
    setEleitor({ whatsapp });
    return true;
  }

  // Results get released and classmates vote from their own phones —
  // refresh now and then so this screen catches up.
  const pronto = dados !== null && (paraComissao || eleitor !== null);
  useEffect(() => {
    if (!pronto) return;
    let ativo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const novo = await buscarVotacao(acesso);
        if (!ativo) return;
        setDados(novo);
        conferirEleitor(novo);
      } catch (e) {
        console.error(e);
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [pronto, codigo, eleitor]);

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
    if (paraComissao) {
      salvarCodigo(null);
      setCodigo('');
      setDados(null);
    } else {
      salvarEleitor(null);
      setEleitor(null);
      carregar({});
    }
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
      <PageHeader eyebrow={paraComissao ? 'Comissão · Turma 32' : 'Turma 32'} title="Votação da turma." />

      {paraComissao && !dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={texto}>Esta entrada é só da comissão. Os formandos votam pelo link da votação.</p>
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
                if (e.key === 'Enter' && codigo.trim() && !entrando) carregar({ codigo: codigo.trim() });
              }}
            />
            {erroAcesso ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erroAcesso}</span> : null}
            <div style={{ display: 'flex' }}>
              <Button size="lg" disabled={!codigo.trim() || entrando} onClick={() => carregar({ codigo: codigo.trim() })}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Button>
            </div>
          </div>
        </Card>
      ) : paraComissao && dados ? (
        <>
          <LinkDaVotacao />
          <EleitoresDaVotacao eleitores={dados.eleitores ?? []} salvando={salvando} agir={agir} />
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
      ) : !eleitor || !dados?.voce ? (
        <Identificacao livres={dados?.livres ?? []} entrando={entrando} erro={erroAcesso} onEntrar={identificar} />
      ) : (
        <>
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: '40rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.1 }}>
                Olá, {dados.voce.split(' ')[0]}.
              </span>
              <p style={texto}>
                Seu voto é secreto: ninguém vê em quem você votou, nem a comissão. O site só guarda que você já votou e a
                contagem de cada opção. Por isso, depois de confirmado, o voto não dá para trocar.
              </p>
              <div style={{ display: 'flex' }}>
                <Button variant="ghost" onClick={sair} style={{ paddingLeft: 0 }}>
                  Não é você? Trocar
                </Button>
              </div>
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

/**
 * The way in for a formando: their WhatsApp. When the committee already
 * has the number, that's all; otherwise they pick their name among the
 * ones with no number yet, and the number gets tied to it.
 */
function Identificacao({
  livres,
  entrando,
  erro,
  onEntrar,
}: {
  livres: string[];
  entrando: boolean;
  erro: string | null;
  onEntrar: (whatsapp: string, nome?: string) => Promise<boolean | 'semNome'>;
}) {
  const [numero, setNumero] = useState('');
  const [erroNumero, setErroNumero] = useState<string | null>(null);
  // Set once the number turned out not to be on the list.
  const [pedirNome, setPedirNome] = useState(false);
  const [nome, setNome] = useState('');
  const whatsapp = normalizarWhatsapp(numero);

  async function enviar() {
    if (!whatsapp) {
      setErroNumero('Esse número não parece um WhatsApp. Confira, por exemplo (21) 99999-9999.');
      return;
    }
    if (pedirNome && !nome) return;
    const resultado = await onEntrar(whatsapp, pedirNome ? nome : undefined);
    if (resultado === 'semNome') setPedirNome(true);
  }

  function corrigir() {
    setPedirNome(false);
    setNome('');
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
        <p style={texto}>
          Digite o seu WhatsApp para entrar. É por ele que o site sabe quem você é e garante um voto por pessoa;
          ninguém vê em quem você votou.
        </p>
        <Input
          label="Seu WhatsApp"
          placeholder="(21) 99999-9999"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={numero}
          disabled={pedirNome}
          error={erroNumero ?? undefined}
          onChange={(e) => {
            setNumero(e.target.value);
            setErroNumero(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && numero.trim() && !entrando) enviar();
          }}
        />
        {pedirNome ? (
          livres.length > 0 ? (
            <>
              <p style={texto}>Esse número não está na lista da turma. Se ele estiver certo, escolha o seu nome:</p>
              <Select label="Seu nome" placeholder="Escolha o seu nome" options={livres} value={nome} onChange={(e) => setNome(e.target.value)} />
            </>
          ) : (
            <p style={texto}>Esse número não está na lista da turma. Confira se digitou certo ou fale com a comissão.</p>
          )
        ) : null}
        {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {!pedirNome || livres.length > 0 ? (
            <Button size="lg" disabled={!numero.trim() || (pedirNome && !nome) || entrando} onClick={enviar}>
              {entrando ? 'Entrando…' : 'Entrar para votar'}
            </Button>
          ) : null}
          {pedirNome ? (
            <Button size="lg" variant="ghost" onClick={corrigir}>
              Corrigir o número
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
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

/** The one link the whole class votes through, for the committee to share in the group. */
function LinkDaVotacao() {
  return (
    <Card padding="var(--space-6) var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' }}>Link da votação</span>
        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--accent)', wordBreak: 'break-all' }}>{urlDaVotacao()}</span>
        <span style={pequeno}>É o mesmo para a turma toda: cada formando entra com o próprio WhatsApp.</span>
        <BotoesLink url={urlDaVotacao()} mensagem="A votação da turma está aberta! Entre com o seu WhatsApp. O voto é secreto:" />
      </div>
    </Card>
  );
}

/**
 * Each formando's WhatsApp. With it, the formando enters the vote without
 * picking a name, and the table map's "Mandar no WhatsApp" opens their
 * chat. The committee fills the numbers in and fixes a wrong one; clearing
 * a number frees the name. Votes already cast stay as they are, since
 * nothing records them.
 */
function EleitoresDaVotacao({
  eleitores,
  salvando,
  agir,
}: {
  eleitores: { formando: string; whatsapp: string | null }[];
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const comNumero = eleitores.filter((e) => e.whatsapp).length;

  async function editar(formando: string, atual: string | null) {
    const digitado = window.prompt(
      `WhatsApp de ${formando} (sem DDD, vale o 21). Deixe vazio para tirar o número.`,
      atual ? formatarWhatsapp(atual) : '',
    );
    if (digitado === null) return;
    if (!digitado.trim()) {
      setErro(await agir({ acao: 'definirWhatsapp', formando, whatsapp: null }));
      return;
    }
    const whatsapp = normalizarWhatsapp(digitado);
    if (!whatsapp) {
      setErro(`"${digitado}" não parece um número de WhatsApp.`);
      return;
    }
    setErro(await agir({ acao: 'definirWhatsapp', formando, whatsapp }));
  }

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <details>
        <summary
          style={{
            cursor: 'pointer',
            padding: 'var(--space-6) var(--space-7)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-h4)',
            fontWeight: 600,
            letterSpacing: '-.015em',
          }}
        >
          WhatsApp dos formandos ({comNumero} de {eleitores.length})
          <span style={{ display: 'block', marginTop: 'var(--space-2)', fontFamily: 'var(--font-core)', fontSize: 'var(--fs-body-sm)', fontWeight: 400, color: 'var(--text-faint)' }}>
            Com o número aqui, o formando entra na votação só digitando o WhatsApp, e o botão "Mandar no WhatsApp" das
            mesas abre a conversa dele direto.
          </span>
        </summary>
        {erro ? <p style={{ ...texto, color: 'var(--state-error)', padding: '0 var(--space-7) var(--space-4)' }}>{erro}</p> : null}
        {eleitores.map((e) => (
          <div
            key={e.formando}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-7)',
              borderTop: '1px solid var(--stroke-hair)',
            }}
          >
            <span style={{ fontSize: 'var(--fs-body)' }}>{e.formando}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <span style={{ fontSize: 'var(--fs-body-sm)', color: e.whatsapp ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                {e.whatsapp ? formatarWhatsapp(e.whatsapp) : 'Sem número'}
              </span>
              <Button variant="ghost" size="sm" disabled={salvando} onClick={() => editar(e.formando, e.whatsapp)}>
                {e.whatsapp ? 'Editar' : 'Adicionar'}
              </Button>
            </span>
          </div>
        ))}
      </details>
    </Card>
  );
}
