import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Check, CircleX, Search, TriangleAlert } from 'lucide-react';
import { Badge } from '../components/Badge';
import { BotoesLink } from '../components/BotoesLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { PageHeader } from '../components/SectionHeading';
import { desligarAvisos, inscricaoAtual, ligarAvisos, situacaoAvisos } from '../lib/avisos';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { precarregarUrna, UrnaVoto } from '../components/UrnaVoto';
import {
  buscarVotacao,
  chaveDoNome,
  formatarWhatsapp,
  nomesDaPergunta,
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
 * - The "Votação" tab of the committee area (/comissao/votacao), with
 *   `codigoComissao`: shares the link, fills in each formando's number,
 *   creates questions (open right away, or ready to open later), opens
 *   them, follows who still has to vote, closes them and releases the
 *   results.
 */
export function Votacao({ codigoComissao }: { codigoComissao?: string }) {
  const paraComissao = codigoComissao !== undefined;
  const [eleitor, setEleitor] = useState(() => (paraComissao ? null : lerEleitor()));
  const [dados, setDados] = useState<DadosVotacao | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const acesso: AcessoVotacao = paraComissao ? { codigo: codigoComissao } : eleitor ?? {};

  /** Loads with `com` and returns what came back, or null if it failed (the error is shown). */
  async function carregar(com: AcessoVotacao): Promise<DadosVotacao | null> {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const novo = await buscarVotacao(com);
      setDados(novo);
      return novo;
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
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

  // Load right away: formandos with the remembered number, if any.
  useEffect(() => {
    carregar(acesso).then((novo) => {
      if (novo && eleitor) conferirEleitor(novo);
    });
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
  }, [pronto, codigoComissao, eleitor]);

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
    salvarEleitor(null);
    setEleitor(null);
    carregar({});
  }

  // The committee's tab sits inside the committee area, which has the page
  // title, the way in and the way out.
  if (paraComissao) {
    const prontas = dados?.perguntas.filter((p) => p.pronta) ?? [];
    const conferir: Conferir = (abrindo, ids) => conferirAbertura(abrindo, ids, dados!);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        {!dados ? (
          <CarregandoSecao erro={erroAcesso} onTentar={() => carregar(acesso)} />
        ) : (
          <>
            <LinkDaVotacao />
            <AvisoDaVotacao chavePush={dados.chavePush ?? null} aparelhos={dados.aparelhosAvisados ?? null} agir={agir} />
            <EleitoresDaVotacao eleitores={dados.eleitores ?? []} salvando={salvando} agir={agir} />
            <FormularioPergunta conferir={conferir} salvando={salvando} agir={agir} />
            {prontas.length > 1 ? <AbrirProntas prontas={prontas} conferir={conferir} salvando={salvando} agir={agir} /> : null}
            {dados.perguntas.length === 0 ? (
              <p style={texto}>Nenhuma votação criada ainda.</p>
            ) : (
              dados.perguntas
                .slice()
                .reverse()
                .map((p) => (
                  <PerguntaComissao key={p.id} p={p} total={dados.formandos.length} conferir={conferir} salvando={salvando} agir={agir} />
                ))
            )}
          </>
        )}
      </div>
    );
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
      <PageHeader eyebrow="Turma 32" title="Votação da turma." />

      {!eleitor || !dados?.voce ? (
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
              {dados.perguntas.some((p) => p.aberta && !p.jaVotou) ? (
                <p style={texto}>Escolha uma opção em cada pergunta e, no fim da página, envie todos os votos de uma vez.</p>
              ) : null}
              {/* The no-repeat rule only matters with more than one question to answer. */}
              {dados.perguntas.filter((p) => p.aberta && !p.jaVotou).length > 1 ? (
                <>
                  <p role="note" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-warn)' }}>
                    <TriangleAlert size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
                    <span>Atenção: o voto não pode se repetir. Você não pode escolher a mesma pessoa em duas perguntas.</span>
                  </p>
                </>
              ) : null}
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
            <Cedula perguntas={dados.perguntas} voce={dados.voce} formandos={dados.formandos} salvando={salvando} agir={agir} />
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
  if (p.pronta) return <Badge>Pronta · a turma ainda não vê</Badge>;
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

/**
 * The formando's ballot: every question, a choice to make on each open one
 * they haven't voted on, and all of it sent together at the end. Sending is
 * blocked until each of those has a choice and no option is picked in two
 * of them; the server checks both again (votar_cedula in votacao.sql).
 */
function Cedula({
  perguntas,
  voce,
  formandos,
  salvando,
  agir,
}: {
  perguntas: Pergunta[];
  voce: string;
  formandos: string[];
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  // The options picked on each question; null means a blank vote.
  const [escolhas, setEscolhas] = useState<Record<string, string[] | null>>({});
  const [erro, setErro] = useState<string | null>(null);
  // Set once the server took the ballot in: plays it dropping into the box.
  const [naUrna, setNaUrna] = useState<{ quantos: number; emBranco: boolean } | null>(null);

  useEffect(() => {
    precarregarUrna();
  }, []);

  const de = (id: string) => escolhas[id] ?? [];
  const emBranco = (id: string) => escolhas[id] === null;
  const pendentes = perguntas.filter((p) => p.aberta && !p.jaVotou);
  const faltam = pendentes.filter((p) => !emBranco(p.id) && de(p.id).length === 0);
  const outras = (p: Pergunta) => pendentes.filter((q) => q.id !== p.id);
  // Options picked in `p` that are also picked in another question, and where
  // — the same name however it's spelled there (chaveDoNome).
  const repetidas = (p: Pergunta) =>
    de(p.id).flatMap((opcao) =>
      outras(p)
        .filter((q) => de(q.id).some((o) => chaveDoNome(o) === chaveDoNome(opcao)))
        .map((q) => ({ opcao, em: q })),
    );
  const comRepeticao = pendentes.filter((p) => repetidas(p).length > 0);
  const pronta = pendentes.length > 0 && faltam.length === 0 && comRepeticao.length === 0;

  function escolher(id: string, opcoes: string[] | null) {
    setErro(null);
    setEscolhas((atual) => ({ ...atual, [id]: opcoes }));
  }

  function irPara(id: string) {
    document.getElementById(`pergunta-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function enviar() {
    if (!pronta) return;
    const resumo = pendentes.map((p) => `• ${p.pergunta}\n   ${emBranco(p.id) ? 'Em branco' : de(p.id).join(', ')}`).join('\n');
    if (!window.confirm(`Confirmar os seus votos?\n\n${resumo}\n\nDepois de enviados, não dá para trocar.`)) return;
    const votos = Object.fromEntries(pendentes.map((p) => [p.id, emBranco(p.id) ? null : de(p.id)]));
    const cedula = { quantos: pendentes.length, emBranco: pendentes.every((p) => emBranco(p.id)) };
    const falha = await agir({ acao: 'votarTudo', votos });
    setErro(falha);
    if (!falha) {
      setEscolhas({});
      setNaUrna(cedula);
    }
  }

  return (
    <>
      {naUrna ? <UrnaVoto quantos={naUrna.quantos} emBranco={naUrna.emBranco} onFim={() => setNaUrna(null)} /> : null}
      {perguntas.map((p) => (
        <PerguntaFormando
          key={p.id}
          p={p}
          voce={voce}
          formandos={formandos}
          escolhidas={de(p.id)}
          emBranco={emBranco(p.id)}
          usadasEmOutras={outras(p).flatMap((q) => de(q.id).map(chaveDoNome))}
          repetidas={repetidas(p)}
          onEscolher={(opcoes) => escolher(p.id, opcoes)}
        />
      ))}

      {pendentes.length > 0 ? (
        <Card padding="clamp(24px, 4vw, 40px)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>
                Enviar os seus votos
              </span>
              <span style={{ ...texto, color: 'var(--text-muted)' }}>
                Você escolheu em {pendentes.length - faltam.length} de {plural(pendentes.length, 'pergunta', 'perguntas')}.
              </span>
            </div>

            {faltam.length > 0 ? (
              <ListaDePerguntas titulo="Falta escolher em:" perguntas={faltam} cor="var(--state-warn)" onIr={irPara} />
            ) : null}
            {comRepeticao.length > 0 ? (
              <ListaDePerguntas
                titulo="Essas perguntas estão com a mesma escolha, e o voto não pode se repetir:"
                perguntas={comRepeticao}
                cor="var(--state-error)"
                onIr={irPara}
              />
            ) : null}
            {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <Button size="lg" disabled={!pronta || salvando} onClick={enviar}>
                {salvando ? 'Enviando…' : 'Enviar meus votos'}
              </Button>
              <span style={pequeno}>
                {pronta ? 'O voto é secreto e não dá para trocar depois.' : 'O botão libera quando todas as perguntas tiverem uma escolha.'}
              </span>
            </div>
          </div>
        </Card>
      ) : null}
    </>
  );
}

/** Questions named in the ballot's footer, each one a link that scrolls to it. */
function ListaDePerguntas({
  titulo,
  perguntas,
  cor,
  onIr,
}: {
  titulo: string;
  perguntas: Pergunta[];
  cor: string;
  onIr: (id: string) => void;
}) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 600, color: cor }}>{titulo}</span>
      <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {perguntas.map((p) => (
          <li key={p.id} style={{ color: cor }}>
            <button
              type="button"
              onClick={() => onIr(p.id)}
              style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-primary)', fontSize: 'var(--fs-body-sm)', textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
            >
              {p.pergunta}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One question of the ballot: the options to pick from (one, or up to the
 * question's `maximo`) or a blank vote, or that you voted, or the result.
 */
function PerguntaFormando({
  p,
  voce,
  formandos,
  escolhidas,
  emBranco,
  usadasEmOutras,
  repetidas,
  onEscolher,
}: {
  p: Pergunta;
  voce: string;
  formandos: string[];
  escolhidas: string[];
  emBranco: boolean;
  /** What's picked in the other questions right now, as chaveDoNome keys. */
  usadasEmOutras: string[];
  /** Options picked here that are also picked in another question — an error to fix before sending. */
  repetidas: { opcao: string; em: Pergunta }[];
  /** The options now picked, or null for a blank vote. */
  onEscolher: (opcoes: string[] | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const varias = p.maximo > 1;
  const cheia = varias && escolhidas.length >= p.maximo;

  // One choice: picking another replaces it. Several: each tap adds or
  // removes one, until the limit — then a name has to be unpicked first.
  function alternar(o: string) {
    if (emBranco) onEscolher([o]);
    else if (escolhidas.includes(o)) onEscolher(escolhidas.filter((x) => x !== o));
    else if (!varias) onEscolher([o]);
    else if (!cheia) onEscolher([...escolhidas, o]);
  }

  // Nobody votes for themselves on the "formandos" questions.
  const opcoes = p.tipo === 'formandos' ? formandos.filter((f) => f !== voce) : p.opcoes;
  const visiveis = busca ? opcoes.filter((o) => chaveDoNome(o).includes(chaveDoNome(busca))) : opcoes;

  return (
    <Card id={`pergunta-${p.id}`} padding="clamp(24px, 4vw, 40px)" style={{ scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPergunta p={p} />

        {p.resultado ? (
          <Barras resultado={p.resultado} brancos={p.brancos} votaram={p.votaram} />
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

            {varias ? (
              <span aria-live="polite" style={{ ...pequeno, color: cheia || emBranco ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                {emBranco
                  ? 'Voto em branco. Para votar em alguém, toque num nome.'
                  : cheia
                    ? `${p.maximo} escolhidos, o máximo. Para trocar, desmarque um.`
                    : `Escolha até ${p.maximo} · ${escolhidas.length === 1 ? '1 escolhido' : `${escolhidas.length} escolhidos`}`}
              </span>
            ) : null}

            <div role={varias ? 'group' : 'radiogroup'} aria-label={p.pergunta} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {visiveis.map((o) => {
                const ativa = escolhidas.includes(o);
                // Picked in another question: still clickable (the error below
                // explains why it can't stay), but marked so it's seen first.
                const usada = !ativa && usadasEmOutras.includes(chaveDoNome(o));
                const bloqueada = cheia && !ativa;
                return (
                  <button
                    key={o}
                    type="button"
                    role={varias ? 'checkbox' : 'radio'}
                    aria-checked={ativa}
                    aria-disabled={bloqueada || undefined}
                    onClick={() => alternar(o)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 44,
                      padding: '0 18px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid ' + (ativa ? 'var(--chalk-050)' : 'var(--stroke-hair)'),
                      background: ativa ? 'var(--chalk-050)' : 'rgba(245,245,247,.06)',
                      color: ativa ? '#000' : usada ? 'var(--text-faint)' : 'var(--text-primary)',
                      fontSize: 'var(--fs-body)',
                      fontWeight: 500,
                      cursor: bloqueada ? 'not-allowed' : 'pointer',
                      // With a blank vote the names fade, but a tap still picks one.
                      opacity: bloqueada ? 0.4 : emBranco ? 0.55 : 1,
                      transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out), opacity var(--dur) var(--ease-out)',
                      transform: ativa ? 'scale(1.03)' : 'none',
                    }}
                  >
                    {ativa ? <Check size={16} strokeWidth={2.4} aria-hidden /> : null}
                    {o}
                    {usada ? <span style={{ fontSize: 'var(--fs-caption)' }}>· já escolhido</span> : null}
                  </button>
                );
              })}
              {visiveis.length === 0 ? <span style={pequeno}>Nenhum nome encontrado.</span> : null}
            </div>

            <div>
              <button
                type="button"
                aria-pressed={emBranco}
                onClick={() => onEscolher(emBranco ? [] : null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  padding: '0 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: emBranco ? '1px solid var(--chalk-050)' : '1px dashed var(--stroke-muted)',
                  background: emBranco ? 'var(--chalk-050)' : 'transparent',
                  color: emBranco ? '#000' : 'var(--text-muted)',
                  fontSize: 'var(--fs-body)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)',
                }}
              >
                {emBranco ? <Check size={16} strokeWidth={2.4} aria-hidden /> : null}
                {emBranco ? 'Em branco' : 'Votar em branco'}
              </button>
            </div>

            {repetidas.length > 0 ? (
              <p role="alert" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-error)' }}>
                <CircleX size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
                <span>
                  Você já escolheu {repetidas.map((r) => `${r.opcao} em "${r.em.pergunta}"`).join(' e ')}. O voto não pode se
                  repetir: escolha outra opção aqui ou lá.
                </span>
              </p>
            ) : null}
          </>
        )}
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
 * the winner (or the tied winners) in gold. Blank votes are counted below,
 * apart: the percentages are of the votes given to an option.
 */
function Barras({ resultado, brancos, votaram }: { resultado: Resultado[]; brancos: number | null; votaram: number | null }) {
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheio(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const total = resultado.reduce((s, r) => s + r.votos, 0);
  const maximo = Math.max(...resultado.map((r) => r.votos), 0);

  if (total === 0 && !brancos) return <Aviso>Ninguém votou nessa pergunta.</Aviso>;
  const rodape = [
    votaram !== null ? plural(votaram, 'formando votou', 'formandos votaram') : null,
    brancos ? plural(brancos, 'voto em branco', 'votos em branco') : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {(total > 0 ? resultado : []).map((r, i) => {
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
      {total === 0 ? <Aviso>Todos os votos foram em branco.</Aviso> : null}
      {rodape.length > 0 ? <span style={pequeno}>{rodape.join(' · ')}.</span> : null}
    </div>
  );
}

/** "How many can each formando pick", as the committee reads it; position + 1 is the number. */
const QUANTAS_ESCOLHAS = ['Só uma', 'Até 2', 'Até 3', 'Até 4', 'Até 5'];

/**
 * The committee's form for a new question — or, with `editando`, for
 * changing a ready one (text, options, how many picks), which nobody has
 * seen yet. `onFechar`: leaves the editing.
 */
function FormularioPergunta({
  editando,
  onFechar,
  conferir,
  salvando,
  agir,
}: {
  editando?: Pergunta;
  onFechar?: () => void;
  conferir: Conferir;
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const mobile = useIsMobile();
  const [pergunta, setPergunta] = useState(editando?.pergunta ?? '');
  const [tipo, setTipo] = useState<TipoPergunta>(editando?.tipo ?? 'formandos');
  const [opcoes, setOpcoes] = useState(editando?.opcoes.join('\n') ?? '');
  const [maximo, setMaximo] = useState(editando?.maximo ?? 1);
  const [erro, setErro] = useState<string | null>(null);
  // Which of the two buttons was pressed, for its "Criando…".
  const [deixandoPronta, setDeixandoPronta] = useState(false);

  const lista = opcoes.split('\n').map((o) => o.trim()).filter(Boolean);
  // Picking every option would count for nobody in particular.
  const opcoesDemais = tipo === 'opcoes' && lista.length >= 2 && maximo >= lista.length;
  const preenchida = pergunta.trim().length >= 3 && (tipo === 'formandos' || lista.length >= 2) && !opcoesDemais;

  /** `pronta`: leave it for later — the class doesn't see it until it's opened. */
  async function criar(pronta: boolean) {
    // Opening right away only asks when a name runs into another question.
    let mesmoAssim = false;
    if (!pronta) {
      const sim = confirmarAbertura(`Abrir "${pergunta.trim()}" agora? A turma passa a ver e votar nela.`, conferir([{ tipo, opcoes: lista }], []), true);
      if (!sim) return;
      mesmoAssim = sim.mesmoAssim;
    }
    setErro(null);
    setDeixandoPronta(pronta);
    const falha = await agir({ acao: 'criar', texto: pergunta, tipo, opcoes: lista, maximo, pronta, mesmoAssim });
    setErro(falha);
    if (!falha) {
      setPergunta('');
      setOpcoes('');
      setMaximo(1);
    }
  }

  async function salvar() {
    if (!editando) return;
    setErro(null);
    const falha = await agir({ acao: 'editar', id: editando.id, texto: pergunta, tipo, opcoes: lista, maximo });
    setErro(falha);
    if (!falha) onFechar?.();
  }

  return (
    <Card padding={mobile ? 'var(--space-6)' : 'var(--space-7)'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: '40rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>
          {editando ? 'Editar pergunta pronta' : 'Nova votação'}
        </span>
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

        <div style={{ maxWidth: 240 }}>
          <Select
            label="Quantas escolhas cada formando faz"
            options={QUANTAS_ESCOLHAS}
            value={QUANTAS_ESCOLHAS[maximo - 1]}
            onChange={(e) => setMaximo(QUANTAS_ESCOLHAS.indexOf(e.target.value) + 1)}
          />
        </div>
        {opcoesDemais ? (
          <span style={{ ...pequeno, color: 'var(--state-warn)' }}>
            Com {lista.length} opções, dá para deixar escolher no máximo {lista.length - 1}.
          </span>
        ) : maximo > 1 ? (
          <span style={pequeno}>Cada formando escolhe de 1 a {maximo} opções nessa pergunta.</span>
        ) : null}

        <span style={pequeno}>
          {editando
            ? 'A turma ainda não vê essa pergunta, então dá para mudar tudo. Depois de aberta, ela não muda mais. Escreva cada nome igual nas outras perguntas (acento e maiúscula não contam), para o site saber que é a mesma pessoa.'
            : `"Deixar pronta" guarda a pergunta aqui: a turma não vê nem vota até vocês abrirem, e dá para editar até lá. O formando não pode escolher o mesmo nome em duas perguntas (acento e maiúscula não contam), e o site confere isso nas perguntas que ele envia juntas. Então perguntas com nomes em comum precisam abrir juntas, antes de a turma votar: depois, o site não abre outra com algum desses nomes, a não ser que vocês confirmem abrir mesmo assim.`}
        </span>

        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {editando ? (
            <>
              <Button size="lg" disabled={!preenchida || salvando} onClick={salvar}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button size="lg" variant="ghost" disabled={salvando} onClick={onFechar}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" disabled={!preenchida || salvando} onClick={() => criar(false)}>
                {salvando && !deixandoPronta ? 'Criando…' : 'Criar e abrir agora'}
              </Button>
              <Button size="lg" variant="secondary" disabled={!preenchida || salvando} onClick={() => criar(true)}>
                {salvando && deixandoPronta ? 'Criando…' : 'Deixar pronta'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/** What opening some questions runs into, by the names they share with the other questions. */
type Abertura = {
  /**
   * A name also in a question the class already voted on. Whoever voted
   * there votes on these apart, with nothing left to compare their choice
   * with, so the server only opens them when told to (abrir_perguntas in
   * votacao.sql).
   */
  repete: { nome: string; em: Pergunta } | null;
  /** Other ready questions with a name in common, which should open together with these. */
  juntas: Pergunta[];
};

/** conferirAbertura with the committee's current data: the questions being opened, and their ids (none for a new one). */
type Conferir = (abrindo: Pick<Pergunta, 'tipo' | 'opcoes'>[], ids: string[]) => Abertura;

function conferirAbertura(abrindo: Pick<Pergunta, 'tipo' | 'opcoes'>[], ids: string[], dados: DadosVotacao): Abertura {
  const nomes = new Map(abrindo.flatMap((p) => nomesDaPergunta(p, dados.formandos)).map((n) => [chaveDoNome(n), n]));
  const emComum = (p: Pergunta) => nomesDaPergunta(p, dados.formandos).map(chaveDoNome).find((c) => nomes.has(c));
  const outras = dados.perguntas.filter((p) => !ids.includes(p.id) && emComum(p) !== undefined);
  const votada = outras.find((p) => !p.pronta && (p.votaram ?? 0) > 0);
  return {
    repete: votada ? { nome: nomes.get(emComum(votada)!)!, em: votada } : null,
    juntas: outras.filter((p) => p.pronta),
  };
}

/**
 * What opening questions means, for the committee to confirm, with what it
 * runs into (see Abertura). Returns null to stop, or whether to open past a
 * repeated name. `soComAviso`: don't ask when there's nothing to warn about.
 */
function confirmarAbertura(oQue: string, { repete, juntas }: Abertura, soComAviso = false): { mesmoAssim: boolean } | null {
  const avisos = [
    juntas.length > 0
      ? `${juntas.length === 1 ? `A pergunta pronta "${juntas[0].pergunta}" tem` : `Outras ${juntas.length} perguntas prontas têm`} nomes em comum com esta. Para o site conferir que ninguém repete um nome, abram todas juntas, antes de a turma votar.`
      : null,
    repete
      ? `Atenção: "${repete.nome}" também está em "${repete.em.pergunta}", que já recebeu votos. Quem votou lá vai votar aqui à parte, e o site não tem como conferir se a pessoa repetiu o nome, porque o voto é secreto e não fica guardado.`
      : null,
  ].filter((a): a is string => a !== null);
  if (soComAviso && avisos.length === 0) return { mesmoAssim: false };
  const texto = [`${oQue} Não tem como voltar a deixar pronta.`, ...avisos, ...(repete ? ['Abrir mesmo assim?'] : [])].join('\n\n');
  return window.confirm(texto) ? { mesmoAssim: repete !== null } : null;
}

/** Opens every ready question at once, so each formando gets them in the same ballot. */
function AbrirProntas({
  prontas,
  conferir,
  salvando,
  agir,
}: {
  prontas: Pergunta[];
  conferir: Conferir;
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    const sim = confirmarAbertura(
      `Abrir as ${prontas.length} perguntas prontas? A turma passa a ver e votar em todas.`,
      conferir(prontas, prontas.map((p) => p.id)),
    );
    if (!sim) return;
    setErro(null);
    setErro(await agir({ acao: 'abrirProntas', ...sim }));
  }

  return (
    <Card padding="var(--space-6) var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '40rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>
          {plural(prontas.length, 'pergunta pronta', 'perguntas prontas')}
        </span>
        <p style={texto}>
          A turma ainda não vê essas perguntas. Abrindo todas juntas, cada formando vota nelas de uma vez, e o site
          confere que ninguém repete a mesma escolha.
        </p>
        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}
        <div style={{ display: 'flex' }}>
          <Button disabled={salvando} onClick={abrir}>
            Abrir as {prontas.length} agora
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * One question, as the committee sees it: who voted, the result once
 * closed, and what to do next — or, while it's ready, the way to open or
 * edit it.
 */
function PerguntaComissao({
  p,
  total,
  conferir,
  salvando,
  agir,
}: {
  p: Pergunta;
  total: number;
  conferir: Conferir;
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  // Only a ready question can be edited (see FormularioPergunta).
  const [editando, setEditando] = useState(false);
  const votaram = p.votaram ?? 0;

  async function fazer(acao: 'encerrar' | 'liberar' | 'esconder' | 'excluir', confirmacao?: string) {
    if (confirmacao && !window.confirm(confirmacao)) return;
    setErro(null);
    setErro(await agir({ acao, id: p.id }));
  }

  async function abrir() {
    const sim = confirmarAbertura(`Abrir "${p.pergunta}"? A turma passa a ver e votar nela.`, conferir([p], [p.id]));
    if (!sim) return;
    setErro(null);
    setErro(await agir({ acao: 'abrir', id: p.id, ...sim }));
  }

  if (editando && p.pronta) {
    return <FormularioPergunta editando={p} onFechar={() => setEditando(false)} conferir={conferir} salvando={salvando} agir={agir} />;
  }

  return (
    <Card padding="clamp(24px, 4vw, 40px)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPergunta
          p={p}
          paraComissao
          extra={
            <span style={pequeno}>
              {p.tipo === 'formandos' ? 'Entre os formandos' : plural(p.opcoes.length, 'opção', 'opções')}
              {p.maximo > 1 ? ` · até ${p.maximo} escolhas por formando` : ''}
            </span>
          }
        />

        {p.pronta ? (
          <p style={texto}>
            A turma ainda não vê essa pergunta e não dá para votar nela. Quando vocês abrirem, ela aparece na página da
            votação para todo mundo.
          </p>
        ) : (
          <>
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
              <Barras resultado={p.resultado} brancos={p.brancos} votaram={null} />
            ) : (
              <p style={{ ...pequeno, margin: 0 }}>
                A contagem aparece para vocês quando encerrarem a votação. Enquanto ela está aberta, ninguém vê, para que
                não dê para descobrir o voto de alguém comparando quem acabou de votar com quem ganhou um voto.
              </p>
            )}
          </>
        )}

        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          {p.pronta ? (
            <>
              <Button disabled={salvando} onClick={abrir}>
                Abrir votação
              </Button>
              <Button
                variant="secondary"
                disabled={salvando}
                onClick={() => {
                  setErro(null);
                  setEditando(true);
                }}
              >
                Editar
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
          <Button
            variant="ghost"
            disabled={salvando}
            onClick={() =>
              fazer('excluir', p.pronta ? `Excluir "${p.pergunta}"? Não dá para desfazer.` : `Excluir "${p.pergunta}" e todos os votos dela? Não dá para desfazer.`)
            }
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
 * The committee's phone gets a notification (the browser's own) the moment
 * everyone has voted on a question, instead of checking this page. On an
 * iPhone that only works with the site on the home screen.
 */
function AvisoDaVotacao({
  chavePush,
  aparelhos,
  agir,
}: {
  chavePush: string | null;
  aparelhos: number | null;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [situacao, setSituacao] = useState(situacaoAvisos);
  // null while checking whether it's already on here.
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  useEffect(() => {
    inscricaoAtual()
      .then((i) => setLigado(i !== null))
      .catch(() => setLigado(false));
  }, []);

  async function fazer(acao: () => Promise<string | null>) {
    setOcupado(true);
    setErro(null);
    setFeito(null);
    try {
      setFeito(await acao());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível agora. Tente de novo.');
    } finally {
      setSituacao(situacaoAvisos());
      setOcupado(false);
    }
  }

  const ligar = () =>
    fazer(async () => {
      const inscricao = await ligarAvisos(chavePush!);
      const falha = await agir({ acao: 'avisar', inscricao });
      if (falha) {
        await desligarAvisos().catch(() => null);
        throw new Error(falha);
      }
      setLigado(true);
      return 'Pronto! Uma notificação de teste acabou de ser mandada para este aparelho.';
    });

  const desligar = () =>
    fazer(async () => {
      const endpoint = await desligarAvisos();
      setLigado(false);
      if (endpoint) {
        const falha = await agir({ acao: 'naoAvisar', endpoint });
        if (falha) throw new Error(falha);
      }
      return null;
    });

  const testar = () =>
    fazer(async () => {
      const inscricao = await inscricaoAtual();
      if (!inscricao) {
        setLigado(false);
        return null;
      }
      const falha = await agir({ acao: 'testarAviso', endpoint: inscricao.endpoint });
      if (falha) throw new Error(falha);
      return 'Notificação de teste enviada.';
    });

  return (
    <Card padding="var(--space-6) var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' }}>
          Aviso no celular
        </span>
        {situacao === 'iphone-tela-inicio' ? (
          <p style={texto}>
            No iPhone, o aviso só funciona com o site na Tela de Início. Toque em Compartilhar (o quadrado com a seta),
            depois em “Adicionar à Tela de Início”. Abra o site pelo ícone novo, entre aqui com o código e ligue o aviso.
            Precisa do iOS 16.4 ou mais novo.
          </p>
        ) : situacao === 'sem-suporte' ? (
          <p style={texto}>
            Este navegador não mostra notificações de sites. No Android ou no computador, abra esta página no Chrome; no
            iPhone, pela Tela de Início.
          </p>
        ) : situacao === 'bloqueado' ? (
          <p style={texto}>
            As notificações deste site estão bloqueadas neste aparelho. Libere nas configurações do navegador (permissões
            do site) e recarregue a página.
          </p>
        ) : ligado ? (
          // Keyed so turning it on doesn't reuse the big button (and its hover) for the small ones.
          <Fragment key="ligado">
            <p style={texto}>Este aparelho recebe uma notificação assim que todo mundo votar numa pergunta.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginLeft: -12 }}>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={testar}>
                Mandar um teste
              </Button>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={desligar}>
                Parar de avisar
              </Button>
            </div>
          </Fragment>
        ) : (
          <Fragment key="desligado">
            <p style={texto}>Receba uma notificação neste aparelho assim que todo mundo votar, sem precisar ficar conferindo.</p>
            {chavePush ? (
              <div style={{ display: 'flex' }}>
                <Button disabled={ocupado || ligado === null} onClick={ligar}>
                  {ocupado ? 'Ligando…' : 'Me avisar quando todos votarem'}
                </Button>
              </div>
            ) : (
              <span style={pequeno}>O aviso ainda não está pronto no servidor.</span>
            )}
          </Fragment>
        )}
        {feito ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-ok)' }}>{feito}</span> : null}
        {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
        {aparelhos ? <span style={pequeno}>{plural(aparelhos, 'aparelho da comissão recebe', 'aparelhos da comissão recebem')} o aviso.</span> : null}
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
