import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, CircleX, Eye, Plus, Search, TriangleAlert } from 'lucide-react';
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
  resultadoDaTurma,
  urlDaVotacao,
  type AcaoVotacao,
  type AcessoVotacao,
  type DadosVotacao,
  type Exibicao,
  type Pergunta,
  type Resultado,
  type TipoPergunta,
} from '../lib/votacao';
import { useIsMobile, usePrefersReducedMotion } from '../lib/useViewport';

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
    const conferirEdicao: ConferirEdicao = (p, nova) => conferirMudanca(p, nova, dados!);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        {!dados ? (
          <CarregandoSecao erro={erroAcesso} onTentar={() => carregar(acesso)} />
        ) : (
          <>
            <LinkDaVotacao />
            <AvisoDaVotacao chavePush={dados.chavePush ?? null} aparelhos={dados.aparelhosAvisados ?? null} agir={agir} />
            <EleitoresDaVotacao eleitores={dados.eleitores ?? []} salvando={salvando} agir={agir} />
            {/* Like a form editor: the ballot's outline, then each question in its order, then a new one at the end. */}
            {dados.perguntas.length > 0 ? (
              <OrdemDaCedula perguntas={dados.perguntas} formandos={dados.formandos} salvando={salvando} agir={agir} />
            ) : null}
            {prontas.length > 1 ? <AbrirProntas prontas={prontas} conferir={conferir} salvando={salvando} agir={agir} /> : null}
            {dados.perguntas.length === 0 ? (
              <p style={texto}>Nenhuma votação criada ainda.</p>
            ) : (
              dados.perguntas.map((p, i) => (
                <PerguntaComissao
                  key={p.id}
                  p={p}
                  numero={i + 1}
                  total={dados.formandos.length}
                  conferir={conferir}
                  conferirEdicao={conferirEdicao}
                  salvando={salvando}
                  agir={agir}
                />
              ))
            )}
            <div id="nova-pergunta" style={{ scrollMarginTop: 80 }}>
              <FormularioPergunta conferir={conferir} salvando={salvando} agir={agir} />
            </div>
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
            <Button size="lg" disabled={!numero.trim() || (pedirNome && !nome)} carregando={entrando} onClick={enviar}>
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
 * `previa`: the committee trying it out (PreviaDaCedula) — sending plays
 * the ballot box and says it would go through, but sends nothing.
 */
function Cedula({
  perguntas,
  voce,
  formandos,
  salvando,
  agir,
  previa = false,
}: {
  perguntas: Pergunta[];
  voce: string;
  formandos: string[];
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
  previa?: boolean;
}) {
  // The options picked on each question; null means a blank vote.
  const [escolhas, setEscolhas] = useState<Record<string, string[] | null>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviariaNaPrevia, setEnviariaNaPrevia] = useState(false);
  // Set once the server took the ballot in: plays it dropping into the box.
  const [naUrna, setNaUrna] = useState<{ quantos: number; emBranco: boolean } | null>(null);

  useEffect(() => {
    precarregarUrna();
  }, []);

  // A pick the committee has since taken out of the question (an edit before anyone voted) no longer counts.
  const de = (id: string) => {
    const p = perguntas.find((q) => q.id === id);
    const feitas = escolhas[id] ?? [];
    return p ? feitas.filter((o) => (p.tipo === 'formandos' ? formandos : p.opcoes).includes(o)) : feitas;
  };
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
    setEnviariaNaPrevia(false);
    setEscolhas((atual) => ({ ...atual, [id]: opcoes }));
  }

  function irPara(id: string) {
    document.getElementById(`pergunta-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function enviar() {
    if (!pronta) return;
    const resumo = pendentes.map((p) => `• ${p.pergunta}\n   ${emBranco(p.id) ? 'Em branco' : de(p.id).join(', ')}`).join('\n');
    const aviso = previa ? 'Prévia: nada vai ser enviado.\n\n' : '';
    if (!window.confirm(`${aviso}Confirmar os seus votos?\n\n${resumo}\n\nDepois de enviados, não dá para trocar.`)) return;
    const votos = Object.fromEntries(pendentes.map((p) => [p.id, emBranco(p.id) ? null : de(p.id)]));
    const cedula = { quantos: pendentes.length, emBranco: pendentes.every((p) => emBranco(p.id)) };
    // The preview plays it all the same — the ballot box included — and keeps the picks to try again.
    if (previa) {
      setEnviariaNaPrevia(true);
      setNaUrna(cedula);
      return;
    }
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
          naUrna={naUrna !== null}
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
            {enviariaNaPrevia ? (
              <p style={{ ...texto, color: 'var(--state-ok)' }}>Tudo certo: assim os votos seriam enviados. Como é uma prévia, nada foi enviado.</p>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <Button size="lg" disabled={!pronta} carregando={salvando} onClick={enviar}>
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
  naUrna,
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
  /** The ballot box is still on screen: a result waits for it to go before revealing. */
  naUrna: boolean;
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
          <ResultadoTurma
            resultado={p.resultado}
            exibicao={p.exibicao}
            validos={p.validos}
            brancos={p.brancos}
            maximo={p.maximo}
            segurar={naUrna}
          />
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

            {/* A paper ballot, like the one that drops into the box (UrnaVoto): a line per option, a box to mark, and blank at the end. */}
            <div
              style={{
                maxWidth: 560,
                borderRadius: 10,
                background: 'var(--chalk-050)',
                color: 'var(--ink-900)',
                boxShadow: '0 14px 40px rgba(0,0,0,.35)',
                overflow: 'hidden',
              }}
            >
              <div aria-hidden style={{ width: 36, height: 4, margin: '16px 20px 8px', borderRadius: 2, background: 'var(--ice-500)' }} />
              <div role={varias ? 'group' : 'radiogroup'} aria-label={p.pergunta}>
                {visiveis.map((o) => {
                  const ativa = escolhidas.includes(o);
                  // Picked in another question: still markable (the error below
                  // explains why it can't stay), but marked so it's seen first.
                  const usada = !ativa && usadasEmOutras.includes(chaveDoNome(o));
                  return (
                    <LinhaDaCedula
                      key={o}
                      papel={varias ? 'checkbox' : 'radio'}
                      marcada={ativa}
                      // With a blank vote the names fade, but a tap still picks one.
                      apagada={usada || emBranco}
                      bloqueada={cheia && !ativa}
                      nota={usada ? 'já escolhido' : undefined}
                      onClick={() => alternar(o)}
                    >
                      {o}
                    </LinhaDaCedula>
                  );
                })}
                {visiveis.length === 0 ? (
                  <span style={{ display: 'block', padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,.1)', color: 'rgba(0,0,0,.5)' }}>
                    Nenhum nome encontrado.
                  </span>
                ) : null}
              </div>
              <LinhaDaCedula papel="checkbox" marcada={emBranco} tracejada onClick={() => onEscolher(emBranco ? [] : null)}>
                Votar em branco
              </LinhaDaCedula>
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

/**
 * A line of the paper ballot: the box to mark, then the option — the box
 * fills in dark with a check, as on the ballot in UrnaVoto. The whole line
 * is the tap target.
 */
function LinhaDaCedula({
  papel,
  marcada,
  apagada = false,
  bloqueada = false,
  tracejada = false,
  nota,
  onClick,
  children,
}: {
  papel: 'radio' | 'checkbox';
  marcada: boolean;
  /** Faded: picked elsewhere, or a blank vote is marked. */
  apagada?: boolean;
  /** The question's limit is reached: unmark one first. */
  bloqueada?: boolean;
  /** Set apart from the names by a dashed line (the blank vote). */
  tracejada?: boolean;
  nota?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={papel}
      aria-checked={marcada}
      aria-disabled={bloqueada || undefined}
      onClick={onClick}
      className="linha-cedula"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        minHeight: 52,
        padding: '10px 20px',
        border: 'none',
        borderTop: tracejada ? '1px dashed rgba(0,0,0,.25)' : '1px solid rgba(0,0,0,.1)',
        background: marcada ? 'rgba(0,0,0,.05)' : undefined,
        color: apagada && !marcada ? 'rgba(0,0,0,.42)' : 'var(--ink-900)',
        fontSize: 'var(--fs-body)',
        fontWeight: marcada ? 600 : 500,
        textAlign: 'left',
        cursor: bloqueada ? 'not-allowed' : 'pointer',
        opacity: bloqueada ? 0.4 : 1,
        transition: 'background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)',
      }}
    >
      <span
        aria-hidden
        style={{
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 5,
          border: `2px solid ${marcada ? 'var(--ink-900)' : 'rgba(0,0,0,.4)'}`,
          background: marcada ? 'var(--ink-900)' : 'transparent',
          transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
        }}
      >
        {marcada ? <Check size={16} strokeWidth={3.2} color="var(--chalk-050)" style={{ animation: 'cedula-marca 220ms var(--ease-out) both' }} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
      {nota ? <span style={{ flex: '0 0 auto', fontSize: 'var(--fs-caption)', fontWeight: 500, color: 'rgba(0,0,0,.45)' }}>{nota}</span> : null}
    </button>
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

// The reveal of a result, in ms from when it comes into view: the caption
// first, then each name in turn (each taking `nome` to come out of the
// blur), and the totals counting up at the end.
const REVELA = { primeiro: 700, entre: 800, nome: 1100, contagem: 900 };

/**
 * When a result plays its reveal: 'espera' until it scrolls into view (and
 * isn't `segurar` — under the ballot box that just took the votes), then
 * 'agora'. 'pronto' with reduced motion (or no IntersectionObserver):
 * everything is just there.
 */
function useRevelacao<T extends HTMLElement>(segurar = false): [RefObject<T>, 'espera' | 'agora' | 'pronto'] {
  const ref = useRef<T>(null);
  const reduzido = usePrefersReducedMotion();
  const [estado, setEstado] = useState<'espera' | 'agora' | 'pronto'>(() =>
    reduzido || typeof IntersectionObserver === 'undefined' ? 'pronto' : 'espera',
  );

  useEffect(() => {
    if (reduzido) {
      setEstado('pronto');
      return;
    }
    const el = ref.current;
    if (estado !== 'espera' || !el || segurar) return;
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEstado('agora');
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -15% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduzido, estado, segurar]);

  return [ref, estado];
}

/** Counts from 0 up to `alvo`, `atraso` ms after `comecar` — or is just `alvo` when not `contar`. */
function useContagem(alvo: number, contar: boolean, comecar: boolean, atraso: number): number {
  const [n, setN] = useState(contar ? 0 : alvo);
  useEffect(() => {
    if (!contar) {
      setN(alvo);
      return;
    }
    if (!comecar) return;
    let raf = 0;
    const t = setTimeout(() => {
      const inicio = performance.now();
      const passo = (agora: number) => {
        const x = Math.min((agora - inicio) / REVELA.contagem, 1);
        setN(Math.round(alvo * (1 - (1 - x) ** 3)));
        if (x < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }, atraso);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [alvo, contar, comecar, atraso]);
  return n;
}

/** When a part of the reveal starts (`--atraso` in the .revela-* rules of global.css). */
const aos = (ms: number) => ({ '--atraso': `${Math.round(ms)}ms` }) as CSSProperties;

/**
 * A released result as the class sees it: only the most voted, in large
 * gold type, revealed when the result comes into view — one name after the
 * other out of a blur, a glint running across each, gold confetti as the
 * last one lands. Then each one's votes and the valid and blank votes, when
 * the committee shows them (Exibicao). `resultado` comes already cut down
 * to what shows: by the server for the class, by resultadoDaTurma in the
 * committee's preview. More names than `primeiros` means a tie for the
 * last place. `segurar`: wait to reveal (see useRevelacao).
 */
function ResultadoTurma({
  resultado,
  exibicao,
  validos,
  brancos,
  maximo,
  segurar = false,
}: {
  resultado: Resultado[];
  exibicao: Exibicao;
  validos: number | null;
  brancos: number | null;
  maximo: number;
  segurar?: boolean;
}) {
  const [ref, estado] = useRevelacao<HTMLDivElement>(segurar);
  const n = resultado.length;
  const nome = (i: number) => REVELA.primeiro + i * REVELA.entre;
  // The last name is in, all but settling.
  const fim = nome(Math.max(n - 1, 0)) + REVELA.nome * 0.6;

  // Where the confetti bursts from: the middle of the names, which may
  // fill only part of the row.
  const lista = useRef<HTMLOListElement>(null);
  const [meio, setMeio] = useState<number | null>(null);
  useEffect(() => {
    const ol = lista.current;
    if (estado !== 'agora' || !ol || ol.children.length === 0) return;
    const nomes = [...ol.children].map((li) => li.getBoundingClientRect());
    const esquerda = Math.min(...nomes.map((r) => r.left));
    const direita = Math.max(...nomes.map((r) => r.right));
    setMeio((esquerda + direita) / 2 - ol.getBoundingClientRect().left);
  }, [estado]);

  return (
    <div
      ref={ref}
      className={estado === 'espera' ? 'revela-espera' : estado === 'agora' ? 'revela-agora' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
      {n === 0 ? (
        <Aviso>{brancos ? 'Todos os votos foram em branco.' : 'Nenhuma opção recebeu voto.'}</Aviso>
      ) : (
        <>
          <span className="revela-parte" style={{ ...aos(0), fontSize: 'var(--fs-body)', fontWeight: 500, color: 'var(--text-muted)' }}>
            {n === 1 ? 'O mais votado' : `Os ${n} mais votados`}
          </span>
          <div style={{ position: 'relative' }}>
            <ol ref={lista} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5) var(--space-8)' }}>
              {resultado.map((r, i) => (
                <li key={r.opcao} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    className="revela-parte revela-nome"
                    style={{
                      ...aos(nome(i)),
                      display: 'block',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--fs-display-3)',
                      fontWeight: 700,
                      letterSpacing: '-.035em',
                      lineHeight: 1.05,
                      textWrap: 'balance' as never,
                    }}
                  >
                    {r.opcao}
                  </span>
                  {r.votos !== null ? (
                    <span className="revela-parte" style={{ ...aos(nome(i) + 600), fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
                      {plural(r.votos, 'voto', 'votos')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {estado === 'agora' && meio !== null ? <ConfeteDourado meio={meio} atraso={fim - 80} /> : null}
          </div>
          {n > exibicao.primeiros ? (
            <span className="revela-parte" style={{ ...aos(fim), ...pequeno }}>
              Houve empate, por isso aparecem {n} nomes em vez de {exibicao.primeiros}.
            </span>
          ) : null}
          {/* With several picks each, the names' votes add up to more than the valid votes. */}
          {exibicao.votos && maximo > 1 ? (
            <span className="revela-parte" style={{ ...aos(fim), ...pequeno }}>
              Cada formando podia escolher até {maximo} opções.
            </span>
          ) : null}
        </>
      )}
      {validos !== null && brancos !== null ? (
        <div className="revela-parte" style={aos(fim + 150)}>
          <Totais validos={validos} brancos={brancos} contar={estado !== 'pronto'} comecar={estado === 'agora'} atraso={fim + 150} />
        </div>
      ) : null}
    </div>
  );
}

const CORES_DOURADAS = ['var(--gild-200)', 'var(--gild-300)', 'var(--gild-400)', 'var(--chalk-050)'];

/** The confetti pieces, fixed so the reveal looks the same for everyone: fanned up and out from the names. */
const PECAS_DOURADAS = Array.from({ length: 26 }, (_, i) => {
  const angulo = (-172 + (164 / 25) * i) * (Math.PI / 180);
  const distancia = 70 + ((i * 37) % 80);
  const redondo = i % 3 === 0;
  return {
    dx: Math.round(Math.cos(angulo) * distancia * 1.4),
    dy: Math.round(Math.sin(angulo) * distancia) - 10,
    giro: (i % 2 ? 1 : -1) * (200 + ((i * 53) % 300)),
    largura: redondo ? 7 : 6,
    altura: redondo ? 7 : 12,
    redondo,
    cor: CORES_DOURADAS[i % CORES_DOURADAS.length],
    duracao: 1400 + ((i * 41) % 400),
    atraso: (i * 17) % 120,
  };
});

/**
 * Gold confetti bursting from the names (`meio`: px from the left of the
 * list), `atraso` ms after it mounts — the urna's confetti (urna-confete in
 * global.css), in gold. Its own clipped layer, so no piece widens the page
 * on a phone.
 */
function ConfeteDourado({ meio, atraso }: { meio: number; atraso: number }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: '-80px -8px -40px', overflow: 'hidden', pointerEvents: 'none' }}>
      {PECAS_DOURADAS.map((c, i) => (
        <span
          key={i}
          style={
            {
              position: 'absolute',
              // The layer reaches 8px past the list on each side, 80px above it and 40px below.
              left: meio + 8 - c.largura / 2,
              top: `calc(50% + 20px - ${c.altura / 2}px)`,
              width: c.largura,
              height: c.altura,
              borderRadius: c.redondo ? '50%' : 2,
              background: c.cor,
              opacity: 0,
              willChange: 'transform, opacity',
              '--dx': `${c.dx}px`,
              '--dy': `${c.dy}px`,
              '--giro': `${c.giro}deg`,
              animation: `urna-confete ${c.duracao}ms ${Math.round(atraso + c.atraso)}ms both`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * The full tally as bars that grow to size when they appear, most voted
 * first; the winner (or the tied winners) in gold. The committee's view:
 * the class sees ResultadoTurma. Blank votes aren't bars (see Totais): the
 * percentages are of the votes given to an option.
 */
function Barras({ resultado, brancos }: { resultado: Resultado[]; brancos: number | null }) {
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheio(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // The committee always gets the counts.
  const votos = (r: Resultado) => r.votos ?? 0;
  const total = resultado.reduce((s, r) => s + votos(r), 0);
  const maximo = Math.max(...resultado.map(votos), 0);

  if (total === 0) return <Aviso>{brancos ? 'Todos os votos foram em branco.' : 'Ninguém votou nessa pergunta.'}</Aviso>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {resultado.map((r, i) => {
        const vencedor = votos(r) === maximo && maximo > 0;
        const fracao = votos(r) / total;
        return (
          <div key={r.opcao} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 'var(--fs-body)' }}>
              <span style={{ fontWeight: vencedor ? 600 : 400, color: vencedor ? 'var(--gild-300)' : 'var(--text-primary)' }}>{r.opcao}</span>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {plural(votos(r), 'voto', 'votos')} · {Math.round(fracao * 100)}%
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(245,245,247,.08)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: cheio ? `${Math.max(fracao * 100, votos(r) ? 2 : 0)}%` : '0%',
                  borderRadius: 4,
                  background: vencedor ? 'var(--gild-400)' : 'var(--ice-400)',
                  transition: `width 1100ms var(--ease-out) ${i * 70}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The valid votes (ballots that picked someone) and the blank ones, side by
 * side. In the class's reveal (`contar`), they count up from 0 `atraso` ms
 * after it starts (`comecar`).
 */
function Totais({
  validos,
  brancos,
  contar = false,
  comecar = false,
  atraso = 0,
}: {
  validos: number;
  brancos: number;
  contar?: boolean;
  comecar?: boolean;
  atraso?: number;
}) {
  const totais = [
    { n: useContagem(validos, contar, comecar, atraso), rotulo: validos === 1 ? 'voto válido' : 'votos válidos' },
    { n: useContagem(brancos, contar, comecar, atraso), rotulo: brancos === 1 ? 'voto em branco' : 'votos em branco' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
      {totais.map(({ n, rotulo }) => (
        <div key={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {n}
          </span>
          <span style={pequeno}>{rotulo}</span>
        </div>
      ))}
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
  conferirEdicao,
  salvando,
  agir,
}: {
  editando?: Pergunta;
  onFechar?: () => void;
  conferir: Conferir;
  conferirEdicao?: ConferirEdicao;
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
  // An open question with votes in: only the text and new options can
  // change — votes are counted under each option's name (editar_pergunta
  // in votacao.sql).
  const aberta = editando !== undefined && !editando.pronta;
  const votaram = aberta ? (editando.votaram ?? 0) : 0;
  const travada = votaram > 0;
  const tiradas = travada && editando?.tipo === 'opcoes' ? editando.opcoes.filter((o) => !lista.includes(o)) : [];
  const preenchida = pergunta.trim().length >= 3 && (tipo === 'formandos' || lista.length >= 2) && !opcoesDemais && tiradas.length === 0;

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
    // An open one only asks when the change reaches past those who voted already.
    let mesmoAssim = false;
    if (aberta) {
      const novas = tipo === 'opcoes' ? lista.filter((o) => !editando.opcoes.includes(o)) : [];
      const repete = conferirEdicao?.(editando, { tipo, opcoes: lista }) ?? null;
      const avisos = [
        travada && novas.length > 0
          ? `${plural(votaram, 'formando já votou', 'formandos já votaram')} sem ${novas.length === 1 ? 'essa opção' : 'essas opções'}: ${novas.join(', ')}. Só quem ainda não votou vai ver.`
          : null,
        repete
          ? `Atenção: "${repete.nome}" também está em "${repete.em.pergunta}". Tem gente que já votou lá e ainda vai votar nesta, e o site não tem como conferir se a pessoa repetiu o nome.`
          : null,
      ].filter((a): a is string => a !== null);
      if (avisos.length > 0 && !window.confirm([...avisos, 'Salvar mesmo assim?'].join('\n\n'))) return;
      mesmoAssim = repete !== null;
    }
    setErro(null);
    const falha = await agir({ acao: 'editar', id: editando.id, texto: pergunta, tipo, opcoes: lista, maximo, mesmoAssim });
    setErro(falha);
    if (!falha) onFechar?.();
  }

  return (
    <Card padding={mobile ? 'var(--space-6)' : 'var(--space-7)'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: '40rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>
          {!editando ? 'Nova votação' : aberta ? 'Editar pergunta aberta' : 'Editar pergunta pronta'}
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
                disabled={travada && tipo !== valor}
                onClick={() => setTipo(valor)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  fontSize: 'var(--fs-body-sm)',
                  fontWeight: 500,
                  cursor: travada ? 'default' : 'pointer',
                  color: tipo === valor ? '#000' : 'var(--text-muted)',
                  background: tipo === valor ? 'var(--chalk-050)' : 'transparent',
                  opacity: travada && tipo !== valor ? 0.4 : 1,
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
              {tiradas.length > 0 ? (
                <span role="alert" style={{ ...pequeno, color: 'var(--state-error)' }}>
                  Já tem votos nessa pergunta, então {tiradas.length === 1 ? 'essa opção não pode sair nem mudar' : 'essas opções não podem sair nem mudar'}:{' '}
                  {tiradas.join(', ')}. Escreva de novo como estava.
                </span>
              ) : null}
            </>
          )}
        </div>

        <div style={{ maxWidth: 240 }}>
          <Select
            label="Quantas escolhas cada formando faz"
            options={QUANTAS_ESCOLHAS}
            value={QUANTAS_ESCOLHAS[maximo - 1]}
            disabled={travada}
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
          {travada
            ? `A votação está aberta e ${plural(votaram, 'formando já votou', 'formandos já votaram')}. Dá para corrigir o texto e acrescentar opções, que só quem ainda não votou vai ver. As opções que já estavam, o tipo e o número de escolhas não mudam mais, porque os votos são contados por eles.`
            : aberta
              ? 'A votação está aberta, mas ninguém votou ainda, então dá para mudar tudo. Quem estiver com a página aberta vê a mudança em alguns segundos.'
              : editando
                ? 'A turma ainda não vê essa pergunta, então dá para mudar tudo. Escreva cada nome igual nas outras perguntas (acento e maiúscula não contam), para o site saber que é a mesma pessoa.'
                : `"Deixar pronta" guarda a pergunta aqui: a turma não vê nem vota até vocês abrirem, e dá para editar até lá. O formando não pode escolher o mesmo nome em duas perguntas (acento e maiúscula não contam), e o site confere isso nas perguntas que ele envia juntas. Então perguntas com nomes em comum precisam abrir juntas, antes de a turma votar: depois, o site não abre outra com algum desses nomes, a não ser que vocês confirmem abrir mesmo assim.`}
        </span>

        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {editando ? (
            <>
              <Button size="lg" disabled={!preenchida} carregando={salvando} onClick={salvar}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button size="lg" variant="ghost" disabled={salvando} onClick={onFechar}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" disabled={!preenchida || salvando} carregando={salvando && !deixandoPronta} onClick={() => criar(false)}>
                {salvando && !deixandoPronta ? 'Criando…' : 'Criar e abrir agora'}
              </Button>
              <Button size="lg" variant="secondary" disabled={!preenchida || salvando} carregando={salvando && deixandoPronta} onClick={() => criar(true)}>
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

/** conferirMudanca with the committee's current data. */
type ConferirEdicao = (p: Pergunta, nova: Pick<Pergunta, 'tipo' | 'opcoes'>) => { nome: string; em: Pergunta } | null;

/**
 * A name an open question `p` gains in `nova` that's also in another
 * question someone voted on without having voted on `p` yet: they could
 * pick it twice, so the server refuses it unless told to (editar_pergunta
 * in votacao.sql). Who voted where comes from each question's `faltam`.
 */
function conferirMudanca(p: Pergunta, nova: Pick<Pergunta, 'tipo' | 'opcoes'>, dados: DadosVotacao): { nome: string; em: Pergunta } | null {
  const antes = new Set(nomesDaPergunta(p, dados.formandos).map(chaveDoNome));
  const novos = nomesDaPergunta(nova, dados.formandos).filter((n) => !antes.has(chaveDoNome(n)));
  const faltamAqui = new Set(p.faltam ?? []);
  for (const q of dados.perguntas) {
    if (q.id === p.id || q.pronta) continue;
    const faltamLa = new Set(q.faltam ?? dados.formandos);
    if (!dados.formandos.some((f) => !faltamLa.has(f) && faltamAqui.has(f))) continue;
    const la = new Set(nomesDaPergunta(q, dados.formandos).map(chaveDoNome));
    const nome = novos.find((n) => la.has(chaveDoNome(n)));
    if (nome) return { nome, em: q };
  }
  return null;
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
 * closed, and what to do next — or, while it's ready, the way to open it.
 * Editable until closed. `numero`: its place on the ballot.
 */
function PerguntaComissao({
  p,
  numero,
  total,
  conferir,
  conferirEdicao,
  salvando,
  agir,
}: {
  p: Pergunta;
  numero: number;
  total: number;
  conferir: Conferir;
  conferirEdicao: ConferirEdicao;
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  // A ready or open question can be edited; how far, see FormularioPergunta.
  const [editando, setEditando] = useState(false);
  const votaram = p.votaram ?? 0;

  async function fazer(acao: 'encerrar' | 'liberar' | 'esconder' | 'excluir' | 'duplicar', confirmacao?: string) {
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

  // Editable until it's closed (see FormularioPergunta).
  if (editando && (p.pronta || p.aberta)) {
    return (
      <div id={`comissao-${p.id}`} style={{ scrollMarginTop: 80 }}>
        <FormularioPergunta
          editando={p}
          onFechar={() => setEditando(false)}
          conferir={conferir}
          conferirEdicao={conferirEdicao}
          salvando={salvando}
          agir={agir}
        />
      </div>
    );
  }

  return (
    <Card id={`comissao-${p.id}`} padding="clamp(24px, 4vw, 40px)" style={{ scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPergunta
          p={p}
          paraComissao
          extra={
            <span style={pequeno}>
              Pergunta {numero} · {p.tipo === 'formandos' ? 'entre os formandos' : plural(p.opcoes.length, 'opção', 'opções')}
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
              <>
                <Barras resultado={p.resultado} brancos={p.brancos} />
                {p.validos !== null && p.brancos !== null ? <Totais validos={p.validos} brancos={p.brancos} /> : null}
                <ExibicaoResultado p={p} salvando={salvando} agir={agir} />
              </>
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
          {!p.pronta && p.aberta ? (
            <Button
              variant="ghost"
              disabled={salvando}
              onClick={() => {
                setErro(null);
                setEditando(true);
              }}
            >
              Editar
            </Button>
          ) : null}
          <Button variant="ghost" disabled={salvando} onClick={() => fazer('duplicar')}>
            Duplicar
          </Button>
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

/** "How many names show", as the committee reads it; position + 1 is the number. */
const QUANTOS_NOMES = ['Só o mais votado', 'Os 2 mais votados', 'Os 3 mais votados', 'Os 4 mais votados', 'Os 5 mais votados'];

/**
 * The committee chooses what the class sees of a closed question's result
 * (Exibicao) — the class never gets the full count above — with a preview
 * of exactly that, reveal included. Each change is saved right away.
 */
function ExibicaoResultado({
  p,
  salvando,
  agir,
}: {
  p: Pergunta;
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  // Shown at once while it saves; back to the saved one if that fails.
  const [exibicao, setExibicao] = useState(p.exibicao);
  const [erro, setErro] = useState<string | null>(null);
  const { primeiros, votos, totais } = p.exibicao;
  // Catches up with what's saved (another committee phone, the next refresh).
  useEffect(() => setExibicao({ primeiros, votos, totais }), [primeiros, votos, totais]);

  async function mudar(mudanca: Partial<Exibicao>) {
    const nova = { ...exibicao, ...mudanca };
    setExibicao(nova);
    setErro(null);
    const falha = await agir({ acao: 'exibir', id: p.id, exibicao: nova });
    if (falha) {
      setErro(falha);
      setExibicao(p.exibicao);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        padding: 'clamp(16px, 3vw, 24px)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--stroke-hair)',
        background: 'rgba(245,245,247,.03)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' }}>
          O que a turma vê do resultado
        </span>
        <span style={pequeno}>
          {p.resultadoLiberado
            ? 'A turma já está vendo este resultado: cada mudança aqui vale na hora.'
            : 'Vale quando vocês mostrarem o resultado para a turma.'}{' '}
          A turma vê só os mais votados, com os nomes sendo revelados um a um. A contagem completa acima fica só com
          vocês e nem chega ao celular de ninguém. Quem ainda tem pergunta aberta para votar só vê o resultado depois
          de enviar os votos.
        </span>
      </div>

      <div style={{ maxWidth: 260 }}>
        <Select
          label="Quantos nomes aparecem"
          options={QUANTOS_NOMES}
          value={QUANTOS_NOMES[exibicao.primeiros - 1]}
          disabled={salvando}
          onChange={(e) => mudar({ primeiros: QUANTOS_NOMES.indexOf(e.target.value) + 1 })}
        />
      </div>
      <span style={{ ...pequeno, marginTop: 'calc(-1 * var(--space-3))' }}>Se houver empate na última vaga, todos os empatados aparecem.</span>
      <Marcar marcado={exibicao.votos} disabled={salvando} onMudar={(v) => mudar({ votos: v })}>
        Mostrar quantos votos cada um teve
      </Marcar>
      <Marcar marcado={exibicao.totais} disabled={salvando} onMudar={(v) => mudar({ totais: v })}>
        Mostrar os votos válidos e em branco
      </Marcar>

      {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
        <span style={{ ...pequeno, fontWeight: 600 }}>Prévia do que a turma vê</span>
        <ResultadoTurma
          // Plays the reveal again on each change, as the class will see it.
          key={JSON.stringify(exibicao)}
          resultado={resultadoDaTurma(p.resultado ?? [], exibicao)}
          exibicao={exibicao}
          validos={exibicao.totais ? p.validos : null}
          brancos={exibicao.totais ? p.brancos : null}
          maximo={p.maximo}
        />
      </div>
    </div>
  );
}

/** A checkbox with its sentence, for the committee's settings. */
function Marcar({
  marcado,
  disabled,
  onMudar,
  children,
}: {
  marcado: boolean;
  disabled?: boolean;
  onMudar: (marcado: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: 'var(--space-3)', minHeight: 44, fontSize: 'var(--fs-body)', cursor: disabled ? 'default' : 'pointer' }}>
      <input
        type="checkbox"
        checked={marcado}
        disabled={disabled}
        onChange={(e) => onMudar(e.target.checked)}
        style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--chalk-050)', cursor: 'inherit' }}
      />
      {children}
    </label>
  );
}

/** A question's state in a word, for the ballot's outline. */
function estadoCurto(p: Pergunta): { texto: string; cor: string } {
  if (p.pronta) return { texto: 'Pronta', cor: 'var(--text-faint)' };
  if (p.resultadoLiberado) return { texto: 'Resultado liberado', cor: 'var(--gild-300)' };
  if (!p.aberta) return { texto: 'Encerrada', cor: 'var(--text-muted)' };
  return { texto: 'Aberta', cor: 'var(--accent)' };
}

/**
 * The ballot at a glance, like a form editor's outline: every question in
 * the order the class sees them, numbered, with arrows to move each up or
 * down (saved right away; the rows slide to their new places) and a tap on
 * one to go to its card. Also where to try the ballot as a formando sees it
 * (PreviaDaCedula) and to add a question, which goes at the end.
 */
function OrdemDaCedula({
  perguntas,
  formandos,
  salvando,
  agir,
}: {
  perguntas: Pergunta[];
  formandos: string[];
  salvando: boolean;
  agir: (a: AcaoVotacao) => Promise<string | null>;
}) {
  const mobile = useIsMobile();
  const salva = perguntas.map((p) => p.id);
  // Shown at once while it saves; back to the saved order if that fails.
  const [ordem, setOrdem] = useState(salva);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState(false);
  // Follows what's saved: after saving, the next refresh, another committee phone.
  useEffect(() => setOrdem(salva), [salva.join()]);

  const porId = new Map(perguntas.map((p) => [p.id, p]));
  // A question made or deleted on another phone shows as saved until the order catches up.
  const mesmas = ordem.length === salva.length && ordem.every((id) => porId.has(id));
  const lista = (mesmas ? ordem : salva).map((id) => porId.get(id)!);

  // Sliding rows (FLIP): where each row was before a move, then from there to where it is.
  const linhas = useRef(new Map<string, HTMLLIElement>());
  const antes = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    for (const [id, li] of linhas.current) {
      const de = antes.current.get(id);
      const dy = de === undefined ? 0 : de - li.getBoundingClientRect().top;
      if (!dy) continue;
      li.style.transition = 'none';
      li.style.transform = `translateY(${dy}px)`;
      li.getBoundingClientRect();
      li.style.transition = 'transform 360ms var(--ease-out)';
      li.style.transform = '';
    }
    antes.current = new Map();
  }, [lista.map((p) => p.id).join()]);

  function reordenar(nova: string[]) {
    antes.current = new Map([...linhas.current].map(([id, li]) => [id, li.getBoundingClientRect().top]));
    setOrdem(nova);
  }

  async function mover(de: number, para: number) {
    const nova = lista.map((p) => p.id);
    [nova[de], nova[para]] = [nova[para], nova[de]];
    reordenar(nova);
    setErro(null);
    const falha = await agir({ acao: 'ordenar', ids: nova });
    if (falha) {
      setErro(falha);
      reordenar(salva);
    }
  }

  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Card padding="var(--space-6) var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>Ordem da cédula</span>
          <span style={pequeno}>
            É nessa ordem que as perguntas aparecem para a turma. Use as setas para mudar: vale na hora. Toque numa pergunta
            para ir até ela.
          </span>
        </div>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {lista.map((p, i) => {
            const estado = estadoCurto(p);
            return (
              <li
                key={p.id}
                ref={(li) => {
                  if (li) linhas.current.set(p.id, li);
                  else linhas.current.delete(p.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) 0',
                  borderTop: i ? '1px solid var(--stroke-hair)' : 'none',
                }}
              >
                <span style={{ width: 24, flex: '0 0 auto', fontWeight: 600, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <button
                  type="button"
                  onClick={() => ir(`comissao-${p.id}`)}
                  style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  {/* Whole, not cut: the questions tend to start the same ("Quem você quer…"). */}
                  <span style={{ display: 'block', fontSize: 'var(--fs-body)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{p.pergunta}</span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--fs-caption)', color: estado.cor }}>{estado.texto}</span>
                </button>
                {/* On a phone the arrows stack, leaving the question more room. */}
                <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 'var(--space-2)' }}>
                  <Seta para="cima" rotulo={`Subir "${p.pergunta}"`} disabled={i === 0 || salvando} onClick={() => mover(i, i - 1)} />
                  <Seta para="baixo" rotulo={`Descer "${p.pergunta}"`} disabled={i === lista.length - 1 || salvando} onClick={() => mover(i, i + 1)} />
                </div>
              </li>
            );
          })}
        </ol>

        {erro ? <p style={{ ...texto, color: 'var(--state-error)' }}>{erro}</p> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button variant="secondary" iconLeft={<Eye size={16} strokeWidth={2} aria-hidden />} onClick={() => setPrevia(true)}>
            Pré-visualizar a cédula
          </Button>
          <Button variant="ghost" iconLeft={<Plus size={16} strokeWidth={2} aria-hidden />} onClick={() => ir('nova-pergunta')}>
            Nova pergunta
          </Button>
        </div>
      </div>
      {previa ? <PreviaDaCedula perguntas={lista} formandos={formandos} onFechar={() => setPrevia(false)} /> : null}
    </Card>
  );
}

/** An arrow button that moves a question up or down the ballot. */
function Seta({ para, rotulo, disabled, onClick }: { para: 'cima' | 'baixo'; rotulo: string; disabled: boolean; onClick: () => void }) {
  const Icone = para === 'cima' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={para === 'cima' ? 'Subir' : 'Descer'}
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--stroke-hair)',
        background: 'transparent',
        color: 'var(--text-primary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Icone size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** An open (or ready) question as a formando who hasn't voted yet will see it — the ready ones as if already open. */
function comoATurmaVe(p: Pergunta): Pergunta {
  return { ...p, pronta: false, jaVotou: false, votaram: null, faltam: null, resultado: null, validos: null, brancos: null };
}

/**
 * The ballot as a formando will see it, the questions to vote on in their
 * order (a formando with something to vote on sees nothing else, no earlier
 * results), to try out before opening: picks, the no-repeat rule, blank
 * votes. Nothing is sent. Over the whole screen; Esc or "Fechar" leaves.
 */
function PreviaDaCedula({ perguntas, formandos, onFechar }: { perguntas: Pergunta[]; formandos: string[]; onFechar: () => void }) {
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  useEffect(() => {
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => {
      // With the ballot box up, Esc is the box's: it closes that, not the preview.
      if (e.key === 'Escape' && !document.querySelector('[data-urna]')) fechar.current();
    };
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = rolagem;
      window.removeEventListener('keydown', tecla);
    };
  }, []);

  // Open and ready ones: the closed ones (and their results) wait until the ballot is in.
  const cedula = perguntas.filter((p) => p.aberta).map(comoATurmaVe);
  const abertas = cedula.length;

  return createPortal(
    // Over the menu (40) and the committee's tabs (30), under the ballot box (60) it plays when sending.
    <div role="dialog" aria-modal="true" aria-label="Prévia da cédula" style={{ position: 'fixed', inset: 0, zIndex: 55, overflowY: 'auto', background: 'var(--ink-950)' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--gutter-page)',
          background: 'rgba(0,0,0,.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--stroke-hair)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' }}>Prévia da cédula</span>
          <span style={pequeno}>Como o formando vê antes de votar, com as prontas já abertas. Nada é enviado.</span>
        </div>
        <Button size="sm" variant="secondary" onClick={onFechar}>
          Fechar
        </Button>
      </div>
      <div
        style={{
          maxWidth: 'var(--maxw-page)',
          margin: '0 auto',
          padding: 'var(--space-7) var(--gutter-page) var(--space-10)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-7)',
        }}
      >
        {abertas > 1 ? (
          <p role="note" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-warn)' }}>
            <TriangleAlert size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
            <span>Atenção: o voto não pode se repetir. Você não pode escolher a mesma pessoa em duas perguntas.</span>
          </p>
        ) : null}
        {cedula.length === 0 ? (
          <p style={texto}>Nenhuma pergunta aberta ou pronta para votar.</p>
        ) : (
          <Cedula perguntas={cedula} voce="" formandos={formandos} salvando={false} agir={async () => null} previa />
        )}
      </div>
    </div>,
    document.body,
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
                <Button disabled={ligado === null} carregando={ocupado} onClick={ligar}>
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
