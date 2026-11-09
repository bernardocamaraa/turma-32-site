import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Clock, Crosshair, Music, Play, TriangleAlert, User, Users, Youtube } from 'lucide-react';
import { Badge } from '../components/Badge';
import { BotoesLink } from '../components/BotoesLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { EntrarComWhatsapp } from '../components/EntrarComWhatsapp';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Popups, usePopup, type Popup } from '../components/Popups';
import { lerEleitor, salvarEleitor } from '../lib/eleitor';
import {
  buscarAlternativas,
  buscarMusicas,
  formatarTempo,
  juntarNomes,
  lerLinkDaMusica,
  membrosDentro,
  linkDaMusica,
  urlDaMusica,
  type AcaoMusicas,
  type AcessoMusicas,
  type Alternativa,
  type DadosMusicas,
  type Grupo,
  type MusicaBase,
} from '../lib/musicas';
import { useIsMobile } from '../lib/useViewport';

const texto: CSSProperties = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const titulo: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' };
const erroEstilo: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' };


/**
 * /musica: each formando picks the song they walk down the stairs to, and
 * the second it starts at. One link for the whole class, entered with the
 * WhatsApp like the vote (the same number, remembered on the phone, enters
 * both). Only the committee sees the songs — tab "Músicas", below.
 */
export function Musica() {
  return (
    <Popups>
      <PaginaMusica />
    </Popups>
  );
}

/** A request from outside the steps (a pop-up's "Ver") to go to one of them. */
type PedidoEtapa = { etapa: Etapa; n: number };

/**
 * What changed between two reads that came from someone else — a new
 * invitation, an answer to yours, the group complete or undone, the group's
 * song picked, the list closed — as pop-ups (and where "Ver" should go).
 */
function novidades(antes: DadosMusicas, agora: DadosMusicas): (Popup & { ir?: Etapa })[] {
  const saida: (Popup & { ir?: Etapa })[] = [];
  const idsAntes = new Set((antes.convites ?? []).map((c) => c.id));
  for (const c of agora.convites ?? []) {
    if (!idsAntes.has(c.id)) {
      saida.push({ tipo: 'grupo', titulo: `${primeiroNome(c.criadoPor)} te chamou para descer em grupo!`, texto: 'Toque abaixo para aceitar ou recusar.', ir: 'modo' });
    }
  }
  const g0 = antes.grupo;
  const g1 = agora.grupo;
  if (g0 && g1 && g0.id === g1.id) {
    for (const m of g1.membros) {
      if (m.formando === agora.voce) continue;
      const era = g0.membros.find((x) => x.formando === m.formando);
      const nome = primeiroNome(m.formando);
      if (era?.status === 'convidado' && m.status === 'aceito') saida.push({ tipo: 'grupo', titulo: `${nome} aceitou o convite!` });
      else if (era?.status === 'convidado' && m.status === 'recusado') saida.push({ tipo: 'aviso', titulo: `${nome} recusou o convite.` });
      else if (m.status === 'convidado' && m.semGrupo && !era?.semGrupo) {
        saida.push({ tipo: 'aviso', titulo: `${nome} decidiu descer sem grupo.`, texto: 'Mas ainda pode mudar de ideia e aceitar.' });
      } else if (m.status === 'convidado' && m.emOutroGrupo && !era?.emOutroGrupo) saida.push({ tipo: 'aviso', titulo: `${nome} entrou em outro grupo.` });
    }
    for (const m of g0.membros) {
      if (m.status === 'aceito' && m.formando !== agora.voce && !g1.membros.some((x) => x.formando === m.formando)) {
        saida.push({ tipo: 'aviso', titulo: `${primeiroNome(m.formando)} saiu do grupo.` });
      }
    }
    if (g1.completo && g0.completo && g1.musica && (g1.musica.codigo !== g0.musica?.codigo || g1.musica.inicio !== g0.musica?.inicio)) {
      saida.push({ tipo: 'festa', titulo: g0.musica ? 'A música do grupo mudou' : 'A música do grupo foi escolhida!', texto: g1.musica.titulo ?? undefined, ir: 'pronto' });
    }
  }
  if (g1?.completo && !(g0?.id === g1.id && g0.completo)) {
    saida.push({ tipo: 'festa', titulo: 'Grupo completo!', texto: g1.musica ? 'Vocês descem juntos.' : 'Agora escolham a música do grupo.', ir: g1.musica ? 'pronto' : 'link' });
  }
  if (g0 && !g1) saida.push({ tipo: 'aviso', titulo: 'O grupo foi desfeito.', texto: 'Você voltou para a sua própria música.', ir: 'modo' });
  if (antes.abertas && !agora.abertas) saida.push({ tipo: 'info', titulo: 'A comissão fechou a lista de músicas.' });
  return saida;
}

/** The pop-up that confirms one of your own actions, once it worked. */
function confirmacao(acao: AcaoMusicas, antes: DadosMusicas | null, agora: DadosMusicas): (Popup & { ir?: Etapa }) | null {
  switch (acao.acao) {
    case 'escolher':
      return { tipo: 'ok', titulo: 'Música salva!', texto: `Começa em ${formatarTempo(acao.inicio)}.` };
    case 'apagar':
      return { tipo: 'info', titulo: 'Música tirada.', texto: 'Escolha outra quando quiser.' };
    case 'criarGrupo':
      return { tipo: 'grupo', titulo: 'Convite enviado!', texto: `Avise ${juntarNomes(acao.convidados.map(primeiroNome))} para entrar aqui e aceitar.` };
    case 'convidar':
      return { tipo: 'grupo', titulo: `Convite enviado para ${primeiroNome(acao.convidado)}!` };
    case 'desconvidar':
      return { tipo: 'info', titulo: 'Convite retirado.' };
    case 'responder': {
      if (!acao.aceitar) return { tipo: 'info', titulo: 'Convite recusado.' };
      const g = agora.grupo;
      if (g?.completo) return { tipo: 'festa', titulo: 'Grupo completo!', texto: 'Agora escolham a música do grupo.', ir: g.musica ? 'pronto' : 'link' };
      const faltam = g?.membros.filter((m) => m.status === 'convidado').map((m) => primeiroNome(m.formando)) ?? [];
      return { tipo: 'grupo', titulo: 'Você entrou no grupo!', texto: faltam.length ? `Falta ${juntarNomes(faltam)} aceitar.` : undefined };
    }
    case 'sairDoGrupo':
      return { tipo: 'info', titulo: antes?.grupo?.criadoPor === antes?.voce ? 'Grupo desfeito.' : 'Você saiu do grupo.' };
    case 'semGrupo':
      return acao.sim ? { tipo: 'info', titulo: 'Combinado!', texto: 'Quem te convidou vai saber. O convite continua valendo se mudar de ideia.' } : null;
    default:
      return null;
  }
}

const primeiroNome = (nome: string) => nome.split(' ')[0];

function PaginaMusica() {
  const popup = usePopup();
  const [eleitor, setEleitor] = useState(lerEleitor);
  const [dados, setDados] = useState<DadosMusicas | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pedido, setPedido] = useState<PedidoEtapa>({ etapa: 'modo', n: 0 });
  // The last state seen, to tell what changed on the next read.
  const visto = useRef<DadosMusicas | null>(null);

  function avisar(p: Popup & { ir?: Etapa }) {
    const { ir, ...resto } = p;
    const rotulo = { modo: resto.tipo === 'grupo' ? 'Ver o convite' : 'Ver', link: 'Escolher a música', minuto: 'Escolher o minuto', pronto: 'Ver a música' }[ir ?? 'modo'];
    popup(ir ? { ...resto, acao: { rotulo, onClick: () => setPedido((x) => ({ etapa: ir, n: x.n + 1 })) } } : resto);
  }

  async function carregar(com: AcessoMusicas): Promise<DadosMusicas | null> {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const novo = await buscarMusicas(com);
      setDados(novo);
      visto.current = novo;
      return novo;
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
      return null;
    } finally {
      setEntrando(false);
    }
  }

  useEffect(() => {
    carregar(eleitor ?? {}).then((novo) => {
      // A remembered number that's no longer on the list: ask again.
      if (novo && eleitor && !novo.voce) {
        salvarEleitor(null);
        setEleitor(null);
      }
      // Invitations already waiting when they arrive: say so once.
      const convites = novo?.voce && !novo.grupo ? (novo.convites ?? []) : [];
      if (convites.length === 1) avisar({ tipo: 'grupo', titulo: `${primeiroNome(convites[0].criadoPor)} te chamou para descer em grupo!`, ir: 'modo' });
      else if (convites.length > 1) avisar({ tipo: 'grupo', titulo: `Você tem ${convites.length} convites para descer em grupo!`, ir: 'modo' });
    });
  }, []);

  // Invitations and answers come from classmates' phones: catch up now and
  // then while the page is open, and pop up what changed.
  const dentro = eleitor !== null && !!dados?.voce;
  useEffect(() => {
    if (!dentro || !eleitor) return;
    let ativo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const novo = await buscarMusicas(eleitor);
        if (!ativo || !novo.voce) return;
        if (visto.current) novidades(visto.current, novo).forEach(avisar);
        visto.current = novo;
        setDados(novo);
      } catch (e) {
        console.error(e);
      }
    }, 15000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [dentro, eleitor]);

  async function identificar(whatsapp: string, nome?: string): Promise<boolean | 'semNome'> {
    const novo = await carregar(nome ? { whatsapp, nome } : { whatsapp });
    if (!novo) return false;
    if (!novo.voce) return 'semNome';
    salvarEleitor({ whatsapp });
    setEleitor({ whatsapp });
    return true;
  }

  /** Runs an action; the error message to show, or null if it worked (and a pop-up says so). */
  async function agir(acao: AcaoMusicas): Promise<string | null> {
    if (!eleitor) return 'Entre de novo com o seu WhatsApp.';
    setSalvando(true);
    try {
      const antes = visto.current;
      const novo = await buscarMusicas(eleitor, acao);
      visto.current = novo;
      setDados(novo);
      const ok = confirmacao(acao, antes, novo);
      if (ok) avisar(ok);
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

  const grupo = dados?.grupo ?? null;

  return (
    <main
      style={{
        // One column, narrow enough to read as a step-by-step on a computer too.
        maxWidth: 'calc(800px + 2 * var(--gutter-page))',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-7)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--gild-300)' }}>Turma 32 · Baile de formatura</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
          <h1 className="titulo-musica">A música da sua descida.</h1>
          <span className="equalizador" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
        <p style={{ ...texto, maxWidth: '36rem', fontSize: 'var(--fs-lead, 19px)' }}>
          No baile, cada formando desce a escada ao som da própria música. Escolha a sua em 4 passos: só a comissão fica sabendo,
          para a turma é surpresa.
        </p>
      </header>

      {!eleitor || !dados?.voce ? (
        <EntrarComWhatsapp
          livres={dados?.livres ?? []}
          entrando={entrando}
          erro={erroAcesso}
          onEntrar={identificar}
          explicacao="Digite o seu WhatsApp para começar (é o mesmo número da votação)."
          botao="Começar"
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18,
                color: '#000',
                background: 'linear-gradient(135deg, var(--gild-200), var(--gild-500))',
              }}
            >
              {dados.voce[0]}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>Olá, {primeiroNome(dados.voce)}!</span>
              <span style={pequeno}>Entrou como {dados.voce}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={sair}>
              Não é você?
            </Button>
          </div>

          <PassoAPasso
            key={grupo?.completo ? `grupo-${grupo.id}` : 'sozinho'}
            dados={{ ...dados, voce: dados.voce }}
            salvando={salvando}
            agir={agir}
            pedido={pedido}
            buscarAlternativas={(video) => buscarAlternativas(eleitor!, video)}
          />
        </>
      )}
    </main>
  );
}

const corDoStatus = { aceito: 'ok', convidado: 'gild', recusado: 'error' } as const;
const nomeDoStatus = { aceito: 'Dentro', convidado: 'Esperando resposta', recusado: 'Recusou' } as const;

/** Another formando asked this one to walk down with them. */
function Convite({
  convite,
  voce,
  jaTemGrupo,
  semGrupo,
  abertas,
  salvando,
  agir,
}: {
  convite: Grupo;
  voce: string;
  jaTemGrupo: boolean;
  /** They said they'll walk down without a group: the invitation still stands. */
  semGrupo: boolean;
  abertas: boolean;
  salvando: boolean;
  agir: (acao: AcaoMusicas) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const outros = convite.membros.filter((m) => m.formando !== voce && m.formando !== convite.criadoPor && m.status !== 'recusado');

  async function responder(aceitar: boolean) {
    if (!aceitar && !window.confirm(`Recusar o convite de ${convite.criadoPor}?`)) return;
    setErro(await agir({ acao: 'responder', grupo: convite.id, aceitar }));
  }

  return (
    <Card
      padding="var(--space-7)"
      className="aparece"
      style={{ border: '1px solid var(--gild-400)', background: 'linear-gradient(135deg, rgba(201,169,106,.16), rgba(201,169,106,.03) 60%), var(--ink-850)', boxShadow: '0 0 50px rgba(201,169,106,.12)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '40rem' }}>
        <span style={{ ...pequeno, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gild-300)' }}>
          <Users size={16} aria-hidden /> Convite para descer em grupo
        </span>
        <span style={titulo}>
          {convite.criadoPor} quer descer a escada com você{outros.length > 0 ? ` e com ${juntarNomes(outros.map((m) => m.formando))}` : ''}.
        </span>
        <p style={texto}>Se todos aceitarem, vocês escolhem uma música só para o grupo, no lugar da música de cada um.</p>
        {jaTemGrupo ? <p style={pequeno}>Você já está em outro grupo. Para aceitar este, saia do seu antes.</p> : null}
        {semGrupo && !jaTemGrupo ? (
          <p style={pequeno}>
            Você disse que vai descer sem grupo, e {convite.criadoPor.split(' ')[0]} já sabe. Mudou de ideia? Ainda dá para aceitar.
          </p>
        ) : null}
        {!abertas ? <p style={pequeno}>A comissão já fechou a lista de músicas. Para mudar, fale com ela.</p> : null}
        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button size="lg" variant="gild" disabled={salvando || jaTemGrupo || !abertas} iconLeft={<Check size={18} strokeWidth={3} aria-hidden />} onClick={() => responder(true)}>
            Aceitar
          </Button>
          <Button size="lg" variant="ghost" disabled={salvando || !abertas} onClick={() => responder(false)}>
            Recusar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** The formando's group: who's in, who still has to answer, and what they can change. */
function SeuGrupo({
  grupo,
  voce,
  formandos,
  emGrupo,
  abertas,
  salvando,
  agir,
}: {
  grupo: Grupo;
  voce: string;
  formandos: string[];
  emGrupo: string[];
  abertas: boolean;
  salvando: boolean;
  agir: (acao: AcaoMusicas) => Promise<string | null>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState('');
  const criador = grupo.criadoPor === voce;
  const ocupados = grupo.membros.filter((m) => m.status !== 'recusado').length;
  const podeChamar = formandos.filter((f) => f !== voce && !emGrupo.includes(f) && !grupo.membros.some((m) => m.formando === f && m.status !== 'recusado'));
  const esperando = grupo.membros.filter((m) => m.status === 'convidado').map((m) => m.formando);
  const sozinho = grupo.membros.filter((m) => m.status === 'aceito').length < 2 && esperando.length === 0;

  async function fazer(acao: AcaoMusicas) {
    setErro(await agir(acao));
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={{ ...pequeno, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} aria-hidden /> Seu grupo
          </span>
          <span style={titulo}>
            {grupo.completo
              ? 'Grupo completo!'
              : sozinho
                ? 'Ninguém mais no grupo por enquanto.'
                : `Esperando ${juntarNomes(esperando)} aceitar.`}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {grupo.membros.map((m) => (
            <div
              key={m.formando}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderTop: '1px solid var(--stroke-hair)', flexWrap: 'wrap' }}
            >
              <span style={{ fontSize: 'var(--fs-body)' }}>
                {m.formando}
                {m.formando === voce ? ' (você)' : ''}
                {m.formando === grupo.criadoPor ? <span style={pequeno}> · criou o grupo</span> : null}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Badge tone={m.emOutroGrupo || m.semGrupo ? 'neutral' : corDoStatus[m.status]}>
                  {m.emOutroGrupo ? 'Entrou em outro grupo' : m.semGrupo ? 'Vai descer sem grupo' : nomeDoStatus[m.status]}
                </Badge>
                {criador && abertas && m.status !== 'aceito' ? (
                  <Button variant="ghost" size="sm" disabled={salvando} onClick={() => fazer({ acao: 'desconvidar', convidado: m.formando })}>
                    Tirar
                  </Button>
                ) : null}
              </span>
            </div>
          ))}
        </div>

        {grupo.membros
          .filter((m) => m.status === 'convidado' && (m.semGrupo || m.emOutroGrupo))
          .map((m) => (
            <p key={m.formando} role="note" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-warn)' }}>
              <TriangleAlert size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
              <span>
                {m.emOutroGrupo
                  ? `${m.formando} entrou em outro grupo. O convite continua valendo se sair de lá${criador ? ', ou você pode tirar e chamar outra pessoa' : ''}.`
                  : `${m.formando} decidiu descer sem grupo, mas ainda pode mudar de ideia e aceitar${criador ? '. Se preferir, tire e chame outra pessoa' : ''}.`}
              </span>
            </p>
          ))}

        {esperando.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={pequeno}>
              {esperando.length === 1 ? 'A pessoa precisa' : 'Cada um precisa'} entrar em {urlDaMusica().replace(/^https?:\/\//, '')} com o próprio
              WhatsApp para aceitar. Mande o link:
            </span>
            <div style={{ display: 'flex', marginLeft: -12 }}>
              <Button
                as="a"
                variant="ghost"
                size="sm"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Te chamei para descer a escada comigo no baile! Entra aqui com o seu WhatsApp para aceitar: ${urlDaMusica()}`)}`}
              >
                Mandar no WhatsApp
              </Button>
            </div>
          </div>
        ) : null}

        {criador && abertas && ocupados < 3 && podeChamar.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <Select label="Chamar mais alguém" placeholder="Escolha um nome" options={podeChamar} value={novo} onChange={(e) => setNovo(e.target.value)} />
            </div>
            <Button
              disabled={!novo || salvando}
              onClick={async () => {
                const falha = await agir({ acao: 'convidar', convidado: novo });
                setErro(falha);
                if (!falha) setNovo('');
              }}
            >
              Chamar
            </Button>
          </div>
        ) : null}

        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        {abertas ? (
          <div style={{ display: 'flex', marginLeft: -12 }}>
            <Button
              variant="ghost"
              disabled={salvando}
              onClick={() => {
                const pergunta = criador
                  ? 'Desfazer o grupo? Todo mundo sai dele, e cada um volta para a própria música.'
                  : 'Sair do grupo? Você volta para a sua própria música.';
                if (window.confirm(pergunta)) fazer({ acao: 'sairDoGrupo' });
              }}
            >
              {criador ? 'Desfazer o grupo' : 'Sair do grupo'}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// --- The step-by-step -------------------------------------------------------

type Etapa = 'modo' | 'link' | 'minuto' | 'pronto';

const ETAPAS: { id: Etapa; nome: string }[] = [
  { id: 'modo', nome: 'Só ou em grupo' },
  { id: 'link', nome: 'A música' },
  { id: 'minuto', nome: 'O minuto' },
  { id: 'pronto', nome: 'Pronto' },
];

/**
 * The page for a formando, one step at a time: 1. alone or in a group (and
 * the invitations), 2. the YouTube link, 3. where it starts, 4. done — the
 * song saved, with ways back to change it. Remounted (key) when their group
 * becomes complete or comes apart, since the song in question changes.
 * `pedido`: a pop-up's "Ver" asking to go to a step.
 */
function PassoAPasso({
  dados,
  salvando,
  agir,
  pedido,
  buscarAlternativas: buscarAlt,
}: {
  dados: DadosMusicas & { voce: string };
  salvando: boolean;
  agir: (acao: AcaoMusicas) => Promise<string | null>;
  pedido: PedidoEtapa;
  /** Other versions of a video that won't play inside the site. */
  buscarAlternativas: (video: string) => Promise<Alternativa[]>;
}) {
  const popup = usePopup();
  const grupo = dados.grupo;
  const fechado = !!grupo?.completo;
  // The song that counts now: the complete group's, or their own.
  const musica = fechado ? grupo!.musica : dados.minha;
  const [etapa, setEtapa] = useState<Etapa>(musica ? 'pronto' : 'modo');
  const [sentido, setSentido] = useState<'avanca' | 'volta'>('avanca');
  const [link, setLink] = useState('');
  const [minuto, setMinuto] = useState('');
  const [segundo, setSegundo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  // Just saved: step 4 throws the confetti (not when coming back later).
  const [festa, setFesta] = useState(0);
  const topo = useRef<HTMLDivElement>(null);
  // The photo's link is signed anew on every read: keep the first one, so
  // the record's label doesn't reload every few seconds.
  const foto = useRef<string | null>(null);
  if (!foto.current && dados.fotoInfancia) foto.current = dados.fotoInfancia;
  // A group's record carries the class logo; so does a formando without a photo yet.
  const rotulo = fechado ? null : foto.current;

  function ir(para: Etapa) {
    const de = ETAPAS.findIndex((e) => e.id === etapa);
    const ate = ETAPAS.findIndex((e) => e.id === para);
    setSentido(ate >= de ? 'avanca' : 'volta');
    setErro(null);
    setEtapa(para);
    const y = (topo.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 80;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
  }

  // A pop-up's "Ver" (only the ones asked after this mounted).
  const pedidoVisto = useRef(pedido.n);
  useEffect(() => {
    if (pedido.n === pedidoVisto.current) return;
    pedidoVisto.current = pedido.n;
    ir(pedido.etapa === 'pronto' && !musica ? 'modo' : pedido.etapa);
  }, [pedido.n]);

  function definirInicio(segundos: number) {
    setMinuto(String(Math.floor(segundos / 60)));
    setSegundo(String(segundos % 60));
  }

  if (!dados.abertas) {
    return musica ? (
      <PassoPronto musica={musica} paraGrupo={fechado} grupo={grupo} repetida={dados.repetida} abertas={false} salvando={salvando} convites={0} festa={0} foto={rotulo} />
    ) : (
      <Card padding="var(--space-7)">
        <p style={texto}>A comissão já fechou a lista de músicas. Se você ainda não mandou a sua, fale com ela.</p>
      </Card>
    );
  }

  const indice = ETAPAS.findIndex((e) => e.id === etapa);
  const passoModo = (
    <PassoModo dados={dados} salvando={salvando} agir={agir} onSozinho={() => ir(musica && !fechado ? 'pronto' : 'link')} onProximo={() => ir(musica ? 'pronto' : 'link')} />
  );

  return (
    <div ref={topo} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Etapas atual={indice} onIr={(i) => ir(ETAPAS[i].id)} />

      <div key={etapa} className={sentido === 'avanca' ? 'passo-avanca' : 'passo-volta'}>
        {etapa === 'modo' ? (
          passoModo
        ) : etapa === 'link' ? (
          <PassoLink
            link={link}
            paraGrupo={fechado}
            onLink={setLink}
            onVoltar={() => ir('modo')}
            onProximo={(inicioDoLink) => {
              if (inicioDoLink !== null && !minuto && !segundo) definirInicio(inicioDoLink);
              ir('minuto');
            }}
          />
        ) : etapa === 'minuto' ? (
          <ContextoAlternativas.Provider
            value={{
              buscar: buscarAlt,
              usar: (codigo) => {
                setLink(`https://youtu.be/${codigo}`);
                popup({ tipo: 'info', titulo: 'Trocamos a versão', texto: 'Essa toca aqui no site. Confira se o minuto continua certo: em outra versão o começo pode mudar.' });
              },
            }}
          >
            <PassoMinuto
              link={link}
              minuto={minuto}
              segundo={segundo}
              onMinuto={setMinuto}
              onSegundo={setSegundo}
              onInicio={definirInicio}
              salvando={salvando}
              erro={erro}
              onVoltar={() => ir('link')}
              onSalvar={async (inicio) => {
                const falha = await agir({ acao: 'escolher', link, inicio, paraGrupo: fechado });
                setErro(falha);
                if (!falha) {
                  setFesta((f) => f + 1);
                  ir('pronto');
                }
              }}
            />
          </ContextoAlternativas.Provider>
        ) : musica ? (
          <ContextoAlternativas.Provider
            value={{
              buscar: buscarAlt,
              usar: (codigo) => {
                setLink(`https://youtu.be/${codigo}`);
                definirInicio(musica.inicio);
                ir('minuto');
                popup({ tipo: 'info', titulo: 'Quase lá!', texto: 'Confira o minuto nessa versão e toque em Salvar.' });
              },
            }}
          >
            <PassoPronto
              musica={musica}
              paraGrupo={fechado}
              grupo={grupo}
              repetida={dados.repetida}
              abertas
              salvando={salvando}
              convites={grupo ? 0 : (dados.convites ?? []).length}
              festa={festa}
              foto={rotulo}
              erro={erro}
              onMudarMinuto={() => {
                setLink(linkDaMusica({ ...musica, inicio: 0 }));
                definirInicio(musica.inicio);
                ir('minuto');
              }}
              onTrocar={() => {
                setLink('');
                setMinuto('');
                setSegundo('');
                ir('link');
              }}
              onTirar={async () => {
                const pergunta = fechado ? 'Tirar a música do grupo? Vocês podem escolher outra depois.' : 'Tirar a sua música? Você pode escolher outra depois.';
                if (!window.confirm(pergunta)) return;
                const falha = await agir({ acao: 'apagar', paraGrupo: fechado });
                setErro(falha);
                if (!falha) ir('link');
              }}
              onGrupo={() => ir('modo')}
            />
          </ContextoAlternativas.Provider>
        ) : (
          // "Pronto" without a song (it was just taken out somewhere else): start over.
          passoModo
        )}
      </div>
    </div>
  );
}

/** The four steps across the top: done ones get a check and can be gone back to. */
function Etapas({ atual, onIr }: { atual: number; onIr: (i: number) => void }) {
  return (
    <nav aria-label="Passos">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
        {ETAPAS.map((e, i) => {
          const feita = i < atual;
          const agora = i === atual;
          return (
            <li key={e.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', position: 'relative' }}>
              {i > 0 ? (
                <span aria-hidden style={{ position: 'absolute', top: 21, right: '50%', width: '100%', height: 2, background: 'var(--stroke-hair)', overflow: 'hidden' }}>
                  <span
                    className="etapa-linha"
                    style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--gild-500), var(--gild-300))', transform: `scaleX(${i <= atual ? 1 : 0})` }}
                  />
                </span>
              ) : null}
              <button
                type="button"
                disabled={!feita}
                onClick={() => onIr(i)}
                aria-current={agora ? 'step' : undefined}
                aria-label={`Passo ${i + 1}: ${e.nome}${feita ? ' (feito, voltar)' : ''}`}
                className={agora ? 'etapa-atual' : undefined}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: feita ? 'pointer' : 'default',
                  border: agora || feita ? 'none' : '1px solid var(--stroke-muted)',
                  background: agora ? 'var(--chalk-050)' : feita ? 'linear-gradient(135deg, var(--gild-200), var(--gild-500))' : 'var(--ink-850)',
                  color: agora || feita ? '#000' : 'var(--text-faint)',
                  transition: 'background var(--dur) var(--ease-out), transform var(--dur) var(--ease-out)',
                }}
              >
                {feita ? <Check size={20} strokeWidth={3} aria-hidden className="check-pop" /> : i + 1}
              </button>
              <span style={{ fontSize: 12, lineHeight: 1.25, textAlign: 'center', color: agora ? 'var(--text-primary)' : 'var(--text-faint)', fontWeight: agora ? 600 : 500 }}>
                {e.nome}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "Passo 2 de 4" over a step's title. */
function CabecalhoPasso({ numero, titulo: t, sobre }: { numero: number; titulo: string; sobre?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gild-300)' }}>Passo {numero} de 4</span>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.12 }}>{t}</h2>
      {sobre ? <p style={{ ...texto, marginTop: 'var(--space-2)' }}>{sobre}</p> : null}
    </div>
  );
}

/** A small numbered instruction: "1  Abra o YouTube". */
function Instrucao({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(201,169,106,.16)',
          border: '1px solid rgba(201,169,106,.35)',
          color: 'var(--gild-300)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {n}
      </span>
      <span style={{ ...texto, color: 'var(--text-primary)', paddingTop: 2 }}>{children}</span>
    </li>
  );
}

const listaInstrucoes: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };

/** One of the two big choices of step 1. */
function Opcao({ icone, titulo: t, sobre, ativa, onClick }: { icone: ReactNode; titulo: string; sobre: string; ativa?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`opcao-musica${ativa ? ' ativa' : ''}`}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: 'var(--space-6)',
        minHeight: 96,
        borderRadius: 'var(--radius-md)',
        textAlign: 'left',
        cursor: 'pointer',
        background: ativa ? 'linear-gradient(135deg, rgba(201,169,106,.16), rgba(201,169,106,.04))' : 'var(--ink-800)',
        border: `1px solid ${ativa ? 'var(--gild-400)' : 'var(--stroke-hair)'}`,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-core)',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          width: 52,
          height: 52,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          background: 'linear-gradient(135deg, var(--gild-200), var(--gild-500))',
          boxShadow: '0 8px 24px rgba(201,169,106,.25)',
        }}
      >
        {icone}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 650 }}>{t}</span>
        <span style={pequeno}>{sobre}</span>
      </span>
      <ArrowRight size={20} aria-hidden style={{ color: 'var(--text-faint)', flex: '0 0 auto' }} />
    </button>
  );
}

/** Step 1: alone or in a group — with the invitations, or their group's state. */
function PassoModo({
  dados,
  salvando,
  agir,
  onSozinho,
  onProximo,
}: {
  dados: DadosMusicas & { voce: string };
  salvando: boolean;
  agir: (acao: AcaoMusicas) => Promise<string | null>;
  /** Going alone: on to the song. */
  onSozinho: () => void;
  /** Their group is complete: on to the group's song. */
  onProximo: () => void;
}) {
  const grupo = dados.grupo;
  const convites = dados.convites ?? [];
  const [montando, setMontando] = useState(false);
  const [primeiro, setPrimeiro] = useState('');
  const [segundo, setSegundo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const livres = (dados.formandos ?? []).filter((f) => f !== dados.voce && !(dados.emGrupo ?? []).includes(f));

  async function sozinho() {
    // With invitations, going alone tells whoever invited (without refusing).
    if (convites.length > 0 && !dados.semGrupo) {
      const falha = await agir({ acao: 'semGrupo', sim: true });
      if (falha) return setErro(falha);
    }
    onSozinho();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {convites.map((c) => (
        <Convite key={c.id} convite={c} voce={dados.voce} jaTemGrupo={grupo !== null} semGrupo={dados.semGrupo ?? false} abertas salvando={salvando} agir={agir} />
      ))}

      {grupo ? (
        <>
          <SeuGrupo grupo={grupo} voce={dados.voce} formandos={dados.formandos ?? []} emGrupo={dados.emGrupo ?? []} abertas salvando={salvando} agir={agir} />
          {grupo.completo ? (
            <div style={{ display: 'flex' }}>
              <Button size="lg" variant="gild" iconRight={<ArrowRight size={18} aria-hidden />} onClick={onProximo}>
                {grupo.musica ? 'Ver a música do grupo' : 'Próximo: a música do grupo'}
              </Button>
            </div>
          ) : (
            <Card padding="var(--space-6) var(--space-7)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <p style={texto}>
                  Assim que todos aceitarem, você recebe um aviso aqui e vocês seguem para o passo 2 para escolher a música do grupo.
                </p>
                <div style={{ display: 'flex', marginLeft: -12 }}>
                  <Button variant="ghost" onClick={onSozinho}>
                    Enquanto isso, escolher a minha música
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <CabecalhoPasso
              numero={1}
              titulo="Você vai descer só ou em grupo?"
              sobre={
                convites.length > 0
                  ? `Aceite ${convites.length === 1 ? 'o convite' : 'um dos convites'} aí em cima, ou escolha aqui. "Só eu" avisa quem te convidou, mas não recusa: o convite continua lá se você mudar de ideia.`
                  : undefined
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Opcao icone={<User size={26} strokeWidth={2.2} aria-hidden />} titulo="Só eu" sobre="Você escolhe a sua música." onClick={sozinho} />
              <Opcao
                icone={<Users size={26} strokeWidth={2.2} aria-hidden />}
                titulo="Em grupo"
                sobre="Até 3 pessoas, uma música só."
                ativa={montando}
                onClick={() => setMontando(true)}
              />
            </div>
            {dados.semGrupo && convites.length > 0 ? (
              <p style={pequeno}>Você disse que vai descer sem grupo, mas os convites continuam valendo se você mudar de ideia.</p>
            ) : null}
            {montando ? (
              <div className="aparece" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
                <ol style={listaInstrucoes}>
                  <Instrucao n={1}>Escolha quem vai descer com você.</Instrucao>
                  <Instrucao n={2}>Cada um entra aqui com o próprio WhatsApp e aceita o convite.</Instrucao>
                  <Instrucao n={3}>Quando todos aceitarem, vocês escolhem a música do grupo.</Instrucao>
                </ol>
                <Select label="Quem vai descer com você" placeholder="Escolha um nome" options={livres.filter((f) => f !== segundo)} value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} />
                <Select label="Mais alguém? (opcional)" placeholder="Ninguém" options={livres.filter((f) => f !== primeiro)} value={segundo} onChange={(e) => setSegundo(e.target.value)} />
                {erro ? <span style={erroEstilo}>{erro}</span> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <Button
                    size="lg"
                    variant="gild"
                    disabled={!primeiro || salvando}
                    carregando={salvando}
                    onClick={async () => setErro(await agir({ acao: 'criarGrupo', convidados: [primeiro, segundo].filter(Boolean) }))}
                  >
                    Mandar convite
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => setMontando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : erro ? (
              <span style={erroEstilo}>{erro}</span>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Step 2: the YouTube link, with how to get it. */
function PassoLink({
  link,
  paraGrupo,
  onLink,
  onVoltar,
  onProximo,
}: {
  link: string;
  paraGrupo: boolean;
  onLink: (link: string) => void;
  onVoltar: () => void;
  /** On to step 3, with the start the link itself carries (YouTube's ?t=), if any. */
  onProximo: (inicioDoLink: number | null) => void;
}) {
  const lido = lerLinkDaMusica(link);
  const video = lido && 'codigo' in lido ? lido : null;
  const [podeColar] = useState(() => typeof navigator !== 'undefined' && !!navigator.clipboard?.readText);

  async function colar() {
    try {
      onLink((await navigator.clipboard.readText()).trim());
    } catch {
      // The browser said no: typing/pasting into the field still works.
    }
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPasso numero={2} titulo={paraGrupo ? 'Qual é a música do grupo?' : 'Qual é a sua música?'} />
        <ol style={listaInstrucoes}>
          <Instrucao n={1}>Abra o YouTube e procure a música.</Instrucao>
          <Instrucao n={2}>
            No vídeo, toque em <strong>Compartilhar</strong> e depois em <strong>Copiar link</strong>.
          </Instrucao>
          <Instrucao n={3}>Volte aqui e cole o link.</Instrucao>
        </ol>
        <div style={{ display: 'flex', marginTop: 'calc(-1 * var(--space-2))' }}>
          <Button as="a" variant="secondary" href="https://www.youtube.com/" target="_blank" rel="noreferrer" iconLeft={<Youtube size={18} aria-hidden />}>
            Abrir o YouTube
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <Input
              label="Link do vídeo"
              placeholder="https://youtu.be/…"
              inputMode="url"
              value={link}
              error={lido && 'erro' in lido ? lido.erro : undefined}
              onChange={(e) => onLink(e.target.value)}
            />
          </div>
          {podeColar ? (
            <Button variant="secondary" size="lg" iconLeft={<ClipboardPaste size={18} aria-hidden />} onClick={colar} style={{ marginBottom: lido && 'erro' in lido ? 30 : 0 }}>
              Colar
            </Button>
          ) : null}
        </div>
        {video ? (
          <div
            key={video.codigo}
            className="aparece"
            style={{
              display: 'flex',
              gap: 'var(--space-5)',
              alignItems: 'center',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(127,185,138,.08)',
              border: '1px solid rgba(127,185,138,.3)',
            }}
          >
            <img
              src={`https://i.ytimg.com/vi/${video.codigo}/mqdefault.jpg`}
              alt=""
              width={140}
              height={79}
              style={{ width: 140, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 10, background: '#000', flex: '0 0 auto' }}
            />
            <span style={{ ...texto, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--state-ok)', fontWeight: 600 }}>
              <Check size={20} strokeWidth={3} aria-hidden className="check-pop" /> Achamos o vídeo!
            </span>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button size="lg" disabled={!video} iconRight={<ArrowRight size={18} aria-hidden />} onClick={() => video && onProximo(video.inicio)}>
            Próximo: o minuto
          </Button>
          <Button size="lg" variant="ghost" iconLeft={<ArrowLeft size={18} aria-hidden />} onClick={onVoltar}>
            Voltar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** One big box of the start time (the minute, or the second), with its name under it. */
function CampoTempo({ rotulo, valor, placeholder, maximo, onValor }: { rotulo: string; valor: string; placeholder: string; maximo: number; onValor: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
      <input
        inputMode="numeric"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onValor(e.target.value.replace(/\D/g, '').slice(0, maximo))}
        onFocus={(e) => e.target.select()}
        className="campo-tempo"
      />
      <span style={pequeno}>{rotulo}</span>
    </label>
  );
}

/**
 * Step 3: where the song starts. The video plays right there: pause it at
 * the spot and tap "Começar daqui", or type the minute and
 * second. "Ouvir a partir de" plays from there to check.
 */
function PassoMinuto({
  link,
  minuto,
  segundo,
  onMinuto,
  onSegundo,
  onInicio,
  salvando,
  erro,
  onVoltar,
  onSalvar,
}: {
  link: string;
  minuto: string;
  segundo: string;
  onMinuto: (v: string) => void;
  onSegundo: (v: string) => void;
  onInicio: (segundos: number) => void;
  salvando: boolean;
  erro: string | null;
  onVoltar: () => void;
  onSalvar: (inicio: number) => void;
}) {
  const lido = lerLinkDaMusica(link);
  const video = lido && 'codigo' in lido ? lido : null;
  const player = useRef<PlayerYT | null>(null);
  const [agora, setAgora] = useState<number | null>(null);

  // Where the video is, for "Começar daqui".
  useEffect(() => {
    const id = setInterval(() => {
      const p = player.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const t = p.getCurrentTime();
      setAgora(Number.isFinite(t) ? Math.floor(t) : null);
    }, 400);
    return () => clearInterval(id);
  }, []);

  const m = minuto.trim() === '' ? 0 : Number(minuto);
  const s = segundo.trim() === '' ? 0 : Number(segundo);
  const valido = Number.isInteger(m) && Number.isInteger(s) && m >= 0 && m < 600 && s >= 0 && s < 60;
  const inicio = valido ? m * 60 + s : null;

  function ouvirDe(t: number) {
    player.current?.seekTo(t, true);
    player.current?.playVideo();
  }

  if (!video) {
    return (
      <Card padding="var(--space-7)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={texto}>Falta o link do vídeo.</p>
          <div style={{ display: 'flex' }}>
            <Button iconLeft={<ArrowLeft size={18} aria-hidden />} onClick={onVoltar}>
              Voltar para o link
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <CabecalhoPasso numero={3} titulo="Em que momento a música começa?" sobre="É o trecho que vai tocar quando você aparecer na escada." />
        <Previa codigo={video.codigo} inicio={inicio ?? 0} player={player} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(180deg, rgba(201,169,106,.1), rgba(201,169,106,.02))',
            border: '1px solid rgba(201,169,106,.25)',
          }}
        >
          <ol style={listaInstrucoes}>
            <Instrucao n={1}>Dê play no vídeo e pause onde a música deve começar.</Instrucao>
            <Instrucao n={2}>
              Toque em <strong>Começar daqui</strong>. Ou, se já souber, digite o minuto e o segundo abaixo.
            </Instrucao>
          </ol>
          <div style={{ display: 'flex' }}>
            <Button size="lg" variant="secondary" disabled={agora === null} iconLeft={<Crosshair size={18} aria-hidden />} onClick={() => agora !== null && onInicio(agora)}>
              {agora === null ? 'Começar daqui' : `Começar daqui (${formatarTempo(agora)})`}
            </Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            <span style={pequeno}>A música começa em</span>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <CampoTempo rotulo="minuto" valor={minuto} placeholder="0" maximo={3} onValor={onMinuto} />
              <span aria-hidden style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 800, lineHeight: '72px', color: 'var(--gild-200)' }}>
                :
              </span>
              <CampoTempo rotulo="segundo" valor={segundo} placeholder="00" maximo={2} onValor={onSegundo} />
            </div>
            {!valido ? <span style={erroEstilo}>O segundo vai de 0 a 59.</span> : null}
          </div>
          <div style={{ display: 'flex', marginLeft: -12 }}>
            <Button variant="ghost" disabled={inicio === null} iconLeft={<Play size={16} aria-hidden />} onClick={() => ouvirDe(inicio ?? 0)}>
              Ouvir a partir de {formatarTempo(inicio ?? 0)}
            </Button>
          </div>
        </div>

        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button size="lg" variant="gild" disabled={inicio === null || salvando} carregando={salvando} iconRight={salvando ? undefined : <Check size={18} strokeWidth={3} aria-hidden />} onClick={() => inicio !== null && onSalvar(inicio)}>
            {salvando ? 'Salvando…' : `Salvar: começa em ${formatarTempo(inicio ?? 0)}`}
          </Button>
          <Button size="lg" variant="ghost" iconLeft={<ArrowLeft size={18} aria-hidden />} onClick={onVoltar}>
            Voltar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** A golden burst, thrown once each time `vez` goes up. */
function Confete({ vez }: { vez: number }) {
  if (!vez) return null;
  const pecas = Array.from({ length: 36 }, (_, i) => {
    const angulo = (i / 36) * Math.PI * 2 + (i % 3) * 0.2;
    const distancia = 120 + ((i * 47) % 140);
    return {
      dx: `${Math.cos(angulo) * distancia}px`,
      dy: `${Math.sin(angulo) * distancia - 40}px`,
      giro: `${(i * 97) % 720 - 360}deg`,
      cor: ['var(--gild-200)', 'var(--gild-400)', 'var(--chalk-050)', 'var(--ice-300)'][i % 4],
      atraso: `${(i % 6) * 25}ms`,
    };
  });
  return (
    <div key={vez} className="confete-musica" aria-hidden>
      {pecas.map((p, i) => (
        <i key={i} style={{ background: p.cor, animationDelay: p.atraso, ['--dx' as string]: p.dx, ['--dy' as string]: p.dy, ['--giro' as string]: p.giro }} />
      ))}
    </div>
  );
}

/**
 * Step 4: the song is saved — a spinning record of it, to play, change or
 * take out. The record's label is the formando's childhood photo, or the
 * class logo (a group, or no photo sent to the committee yet).
 */
function PassoPronto({
  musica,
  paraGrupo,
  grupo,
  repetida,
  abertas,
  salvando,
  convites,
  festa,
  foto,
  erro,
  onMudarMinuto,
  onTrocar,
  onTirar,
  onGrupo,
}: {
  musica: MusicaBase;
  paraGrupo: boolean;
  grupo: Grupo | null;
  repetida: boolean;
  abertas: boolean;
  salvando: boolean;
  /** Invitations waiting for them (not in a group). */
  convites: number;
  /** Goes up when the song was just saved: throw the confetti. */
  festa: number;
  /** Their childhood photo for the record's label — or null for the class logo. */
  foto: string | null;
  erro?: string | null;
  onMudarMinuto?: () => void;
  onTrocar?: () => void;
  onTirar?: () => void;
  onGrupo?: () => void;
}) {
  const player = useRef<PlayerYT | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  return (
    <Card padding="var(--space-7)" style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(120% 70% at 50% 0%, rgba(201,169,106,.14), transparent 60%), var(--ink-850)' }}>
      <Confete vez={festa} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-5)' }}>
        <span
          className="check-pop"
          aria-hidden
          style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--state-ok)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(127,185,138,.45)' }}
        >
          <Check size={30} strokeWidth={3} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', fontWeight: 800, letterSpacing: '-.03em' }}>Pronto!</h2>
          <span style={texto}>{paraGrupo ? 'A música do grupo está salva.' : 'A sua música está salva.'}</span>
          {paraGrupo && grupo ? <span style={{ ...pequeno, color: 'var(--gild-300)' }}>Vocês descem juntos: {juntarNomes(membrosDentro(grupo))}</span> : null}
        </div>

        <div className="vinil" aria-hidden style={{ margin: 'var(--space-3) 0' }}>
          <span
            className={`vinil-rotulo${foto ? '' : ' vinil-logo'}`}
            style={{ backgroundImage: `url(${foto ?? '/assets/logo-32-pequena.png'})` }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '30rem' }}>
          <span style={{ ...titulo, fontSize: 'var(--fs-h4)' }}>{musica.titulo ?? 'Vídeo do YouTube'}</span>
          <span style={{ display: 'inline-flex', alignSelf: 'center', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 980, background: 'rgba(201,169,106,.14)', color: 'var(--gild-200)', fontWeight: 600 }}>
            <Clock size={16} aria-hidden /> Começa em {formatarTempo(musica.inicio)}
          </span>
        </div>

        {ouvindo ? (
          <div className="aparece" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Previa codigo={musica.codigo} inicio={musica.inicio} player={player} tocar />
          </div>
        ) : (
          <Button size="lg" variant="secondary" iconLeft={<Play size={18} aria-hidden />} onClick={() => setOuvindo(true)}>
            Ouvir a partir de {formatarTempo(musica.inicio)}
          </Button>
        )}

        {repetida ? (
          <p role="note" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-warn)', textAlign: 'left' }}>
            <TriangleAlert size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
            <span>Outro formando escolheu essa mesma música. Pode manter, mas talvez valha escolher outra.</span>
          </p>
        ) : null}
        {erro ? <span style={erroEstilo}>{erro}</span> : null}

        {abertas ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--stroke-hair)', width: '100%' }}>
              <Button variant="secondary" iconLeft={<Clock size={16} aria-hidden />} onClick={onMudarMinuto}>
                Mudar o minuto
              </Button>
              <Button variant="secondary" iconLeft={<Music size={16} aria-hidden />} onClick={onTrocar}>
                Trocar a música
              </Button>
              <Button variant="ghost" disabled={salvando} onClick={onTirar}>
                Tirar a música
              </Button>
            </div>
            <p style={pequeno}>Dá para voltar e mudar quando quiser, até a comissão fechar a lista.</p>
            {convites > 0 ? (
              <button type="button" className="opcao-musica" onClick={onGrupo} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', width: '100%', padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'rgba(201,169,106,.1)', border: '1px solid rgba(201,169,106,.4)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                <Users size={22} aria-hidden style={{ color: 'var(--gild-300)', flex: '0 0 auto' }} />
                <span style={{ flex: 1 }}>Você tem {convites === 1 ? 'um convite' : `${convites} convites`} para descer em grupo.</span>
                <ArrowRight size={18} aria-hidden style={{ color: 'var(--gild-300)' }} />
              </button>
            ) : (
              <div style={{ display: 'flex' }}>
                <Button variant="ghost" iconLeft={<Users size={16} aria-hidden />} onClick={onGrupo}>
                  {grupo ? 'Ver o grupo' : 'Quer descer em grupo?'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p style={pequeno}>A comissão já fechou a lista de músicas. Para trocar, fale com ela.</p>
        )}
      </div>
    </Card>
  );
}

/**
 * Picking the song: the link (checked as it's pasted, with the video or
 * track right there to play) and the minute and second it starts at. On
 * YouTube, the formando can play it, stop where they want and tap
 * "Começar daqui" instead of typing the time.
 */
function FormularioMusica({
  atual,
  salvando,
  erro,
  onSalvar,
  onCancelar,
  cabecalho,
  aviso,
}: {
  atual: MusicaBase | null;
  salvando: boolean;
  erro: string | null;
  onSalvar: (link: string, inicio: number) => void;
  onCancelar?: () => void;
  /** The heading, when it isn't the formando's own song ("Música de Fulano"). */
  cabecalho?: string;
  /** A note under the heading. */
  aviso?: string;
}) {
  const [link, setLink] = useState(atual ? linkDaMusica({ ...atual, inicio: 0 }) : '');
  const [minuto, setMinuto] = useState(atual ? String(Math.floor(atual.inicio / 60)) : '');
  const [segundo, setSegundo] = useState(atual ? String(atual.inicio % 60) : '');
  const [agora, setAgora] = useState<number | null>(null);
  const player = useRef<PlayerYT | null>(null);
  const lido = lerLinkDaMusica(link);
  const musica = lido && 'codigo' in lido ? lido : null;

  // A link that carries its own time (YouTube's "Compartilhar a partir de"):
  // fill it in, unless a time was typed already.
  useEffect(() => {
    if (musica?.inicio != null && !minuto && !segundo) {
      setMinuto(String(Math.floor(musica.inicio / 60)));
      setSegundo(String(musica.inicio % 60));
    }
  }, [musica?.codigo, musica?.inicio]);

  // Where the video is, for "Começar daqui".
  useEffect(() => {
    if (!musica) return;
    const id = setInterval(() => {
      const p = player.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const t = p.getCurrentTime();
      setAgora(Number.isFinite(t) ? Math.floor(t) : null);
    }, 400);
    return () => clearInterval(id);
  }, [musica?.codigo]);

  const m = minuto.trim() === '' ? 0 : Number(minuto);
  const s = segundo.trim() === '' ? 0 : Number(segundo);
  const tempoValido = Number.isInteger(m) && Number.isInteger(s) && m >= 0 && m < 600 && s >= 0 && s < 60;
  const inicio = tempoValido ? m * 60 + s : null;
  const pode = musica !== null && inicio !== null && !salvando;

  function usarAgora() {
    if (agora === null) return;
    setMinuto(String(Math.floor(agora / 60)));
    setSegundo(String(agora % 60));
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <span style={titulo}>{cabecalho ?? (atual ? 'Trocar a música' : 'Escolher a música')}</span>
        {aviso ? <p style={pequeno}>{aviso}</p> : null}
        <Input
          label="Link da música"
          placeholder="https://www.youtube.com/watch?v=…"
          inputMode="url"
          value={link}
          hint="No vídeo do YouTube, toque em Compartilhar e em Copiar link."
          error={lido && 'erro' in lido ? lido.erro : undefined}
          onChange={(e) => setLink(e.target.value)}
        />
        {musica ? <Previa codigo={musica.codigo} inicio={inicio ?? 0} player={player} /> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 500, color: 'var(--text-muted)' }}>Em que minuto a música começa?</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Input
              aria-label="Minuto"
              hint="minuto"
              placeholder="0"
              inputMode="numeric"
              value={minuto}
              onChange={(e) => setMinuto(e.target.value.replace(/\D/g, '').slice(0, 3))}
              style={{ width: 96 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, paddingBottom: 30 }}>:</span>
            <Input
              aria-label="Segundo"
              hint="segundo"
              placeholder="00"
              inputMode="numeric"
              value={segundo}
              onChange={(e) => setSegundo(e.target.value.replace(/\D/g, '').slice(0, 2))}
              style={{ width: 96 }}
            />
          </div>
          {!tempoValido ? <span style={erroEstilo}>O segundo vai de 0 a 59.</span> : null}
          {musica ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Button variant="secondary" size="sm" disabled={agora === null} onClick={usarAgora}>
                {agora === null ? 'Começar daqui' : `Começar daqui (${formatarTempo(agora)})`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={inicio === null}
                onClick={() => {
                  player.current?.seekTo(inicio ?? 0, true);
                  player.current?.playVideo();
                }}
              >
                Ouvir a partir de {formatarTempo(inicio ?? 0)}
              </Button>
            </div>
          ) : null}
          {musica ? (
            <span style={pequeno}>Dê play no vídeo, pause onde quer que comece e toque em "Começar daqui".</span>
          ) : null}
        </div>

        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button size="lg" disabled={!pode} carregando={salvando} onClick={() => inicio !== null && onSalvar(link, inicio)}>
            {salvando ? 'Salvando…' : 'Salvar música'}
          </Button>
          {onCancelar ? (
            <Button size="lg" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// --- The players -----------------------------------------------------------

/** The bits of the YouTube IFrame API player used here. */
type PlayerYT = {
  seekTo: (segundos: number, permitirBuscar: boolean) => void;
  playVideo: () => void;
  getCurrentTime: () => number;
  getDuration?: () => number;
  cueVideoById?: (opcoes: { videoId: string; startSeconds?: number }) => void;
  destroy: () => void;
};

type ApiYT = {
  Player: new (
    el: HTMLElement,
    opcoes: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void };
    },
  ) => PlayerYT;
};

declare global {
  interface Window {
    YT?: ApiYT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiYoutube: Promise<ApiYT> | null = null;

/** Loads YouTube's player script once, on the first video shown. */
function carregarApiYoutube(): Promise<ApiYT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiYoutube) {
    apiYoutube = new Promise<ApiYT>((resolve, reject) => {
      const anterior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        anterior?.();
        if (window.YT) resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        apiYoutube = null;
        reject(new Error('YouTube indisponível'));
      };
      document.head.appendChild(script);
    });
  }
  return apiYoutube;
}

const moldura: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 560,
  aspectRatio: '16 / 9',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  background: '#000',
  border: '1px solid var(--stroke-hair)',
};

/**
 * The video, through YouTube's API, so the page can jump to the start and
 * read where it is. If YouTube's script can't load, a plain embed that
 * starts at `inicio`.
 */
function Previa({ codigo, inicio, player, tocar }: { codigo: string; inicio: number; player: MutableRefObject<PlayerYT | null>; tocar?: boolean }) {
  return <PlayerYoutube key={codigo} codigo={codigo} inicio={inicio} player={player} tocar={tocar} />;
}

/**
 * Where a blocked video can look for other versions of the song, and what
 * picking one does — given by the step showing the video (step 3 swaps the
 * link; step 4 takes them back to step 3 with it). Without it (the
 * committee's tab), the blocked video just links to YouTube.
 */
const ContextoAlternativas = createContext<{ buscar: (codigo: string) => Promise<Alternativa[]>; usar: (codigo: string) => void } | null>(null);

/**
 * In place of a video YouTube won't play inside other sites (VEVO and some
 * labels turn that off): its cover, why, a button that opens it on YouTube
 * already at the chosen second — and, looked up right away, other versions
 * of the same song (lyrics, audio) that do play here, to swap with a tap.
 * The original still counts: on the night the DJ plays it from YouTube.
 */
function VideoForaDoSite({ codigo, inicio }: { codigo: string; inicio: number }) {
  const alternativas = useContext(ContextoAlternativas);
  const [lista, setLista] = useState<Alternativa[] | null>(null);

  useEffect(() => {
    if (!alternativas) return;
    let ativo = true;
    alternativas.buscar(codigo).then(
      (l) => ativo && setLista(l),
      () => ativo && setLista([]),
    );
    return () => {
      ativo = false;
    };
  }, [codigo]);

  return (
    <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="aparece" style={{ ...moldura, aspectRatio: 'auto', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          aria-hidden
          style={{ position: 'absolute', inset: 0, backgroundImage: `url(https://i.ytimg.com/vi/${codigo}/hqdefault.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(6px) brightness(.35)', transform: 'scale(1.1)' }}
        />
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-3)', padding: 'var(--space-6) var(--space-5)' }}>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)' }}>Esse vídeo não toca aqui no site</span>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--chalk-100)', maxWidth: '26rem' }}>
            Quem publicou (a Vevo, por exemplo) não deixa ele tocar fora do YouTube. Pode manter: no baile, o DJ toca direto do
            YouTube. {alternativas ? 'Ou use uma versão que toca aqui, logo abaixo.' : 'Para conferir o minuto, ouça por lá.'}
          </span>
          <Button as="a" href={linkDaMusica({ codigo, inicio })} target="_blank" rel="noreferrer" iconLeft={<Youtube size={18} aria-hidden />}>
            {inicio > 0 ? `Abrir no YouTube em ${formatarTempo(inicio)}` : 'Abrir no YouTube'}
          </Button>
        </div>
      </div>

      {alternativas ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'left' }}>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>Versões da mesma música que tocam aqui</span>
          {lista === null ? (
            <span style={{ ...pequeno, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="equalizador" aria-hidden style={{ height: 16, gap: 3 }}>
                <span style={{ width: 3 }} />
                <span style={{ width: 3 }} />
                <span style={{ width: 3 }} />
              </span>
              Procurando versões com letra ou só o áudio…
            </span>
          ) : lista.length === 0 ? (
            <span style={pequeno}>
              Não achamos outra versão. Se quiser, procure no YouTube a música com "lyrics" ou "áudio" no nome e cole o link no passo 2.
            </span>
          ) : (
            lista.map((v) => (
              <button
                key={v.codigo}
                type="button"
                className="aparece opcao-musica"
                onClick={() => alternativas.usar(v.codigo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--ink-800)',
                  border: '1px solid var(--stroke-hair)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={`https://i.ytimg.com/vi/${v.codigo}/mqdefault.jpg`}
                  alt=""
                  width={96}
                  height={54}
                  style={{ width: 96, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8, background: '#000', flex: '0 0 auto' }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.titulo}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{[v.canal, v.duracao].filter(Boolean).join(' · ')}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gild-300)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    Usar esta versão <ArrowRight size={14} aria-hidden />
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** `tocar`: start playing as soon as it's ready (it was opened by a tap on "Ouvir"). */
function PlayerYoutube({ codigo, inicio, player, tocar }: { codigo: string; inicio: number; player: MutableRefObject<PlayerYT | null>; tocar?: boolean }) {
  const lugar = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);
  // YouTube refused to play it here: the owner (often VEVO) doesn't allow
  // other sites to embed it (errors 101/150), or it's gone (100).
  const [bloqueado, setBloqueado] = useState(false);
  // The start when the video was first shown: later changes only move the
  // "Ouvir a partir de" button, not the video under the formando's finger.
  const inicioInicial = useRef(inicio);
  // The start as it is now, for when the video ends (below).
  const inicioAtual = useRef(inicio);
  inicioAtual.current = inicio;

  useEffect(() => {
    let ativo = true;
    let criado: PlayerYT | null = null;
    carregarApiYoutube().then(
      (YT) => {
        if (!ativo || !lugar.current) return;
        const alvo = document.createElement('div');
        lugar.current.appendChild(alvo);
        criado = new YT.Player(alvo, {
          videoId: codigo,
          width: '100%',
          height: '100%',
          playerVars: { start: inicioInicial.current, playsinline: 1, rel: 0 },
          events: {
            onReady: () => {
              if (!ativo) return;
              player.current = criado;
              if (tocar) criado?.playVideo();
            },
            // Played to the end, YouTube's own play button would start over
            // from 0:00. Put the video back at the chosen second instead, so
            // playing it again starts where the song starts on the night.
            onStateChange: (e) => {
              if (ativo && e.data === 0) criado?.cueVideoById?.({ videoId: codigo, startSeconds: inicioAtual.current });
            },
            onError: (e) => {
              if (ativo && [100, 101, 150].includes(e.data)) {
                if (player.current === criado) player.current = null;
                setBloqueado(true);
              }
            },
          },
        });
      },
      () => ativo && setFalhou(true),
    );
    return () => {
      ativo = false;
      if (player.current === criado) player.current = null;
      criado?.destroy();
    };
  }, [codigo]);

  if (bloqueado) return <VideoForaDoSite codigo={codigo} inicio={inicio} />;
  if (falhou) {
    return (
      <div style={moldura}>
        <iframe
          title="Vídeo do YouTube"
          src={`https://www.youtube.com/embed/${codigo}?start=${inicio}&playsinline=1&rel=0${tocar ? '&autoplay=1' : ''}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    );
  }
  return <div ref={lugar} style={moldura} className="player-youtube" />;
}

// --- The committee's tab ---------------------------------------------------

/**
 * The "Músicas" tab of the committee area (/comissao/musicas): the link to
 * send the class, who's still missing, every song with its start (playable
 * right there), and the list for the DJ. The committee can also put in or
 * fix a formando's song, and freeze the list.
 */
export function MusicasComissao({ codigo }: { codigo: string }) {
  const mobile = useIsMobile();
  const [dados, setDados] = useState<DadosMusicas | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ formando: string | null; texto: string } | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [ouvindo, setOuvindo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function carregar() {
    setErroCarregar(null);
    try {
      setDados(await buscarMusicas({ codigo }));
    } catch (e) {
      setErroCarregar(e instanceof Error ? e.message : 'Não foi possível abrir agora.');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function agir(acao: AcaoMusicas, formando: string | null): Promise<boolean> {
    setSalvando(true);
    setErro(null);
    try {
      setDados(await buscarMusicas({ codigo }, acao));
      return true;
    } catch (e) {
      setErro({ formando, texto: e instanceof Error ? e.message : 'Não foi possível salvar agora.' });
      return false;
    } finally {
      setSalvando(false);
    }
  }

  if (!dados) return <CarregandoSecao erro={erroCarregar} onTentar={carregar} />;

  const musicas = dados.musicas ?? [];
  const formandos = dados.formandos ?? [];
  const grupos = dados.grupos ?? [];
  const porFormando = new Map(musicas.map((m) => [m.formando, m]));

  // Who walks down to what: each complete group is one entry, with its
  // song; everyone else, one each, with their own.
  const fechados = grupos.filter((g) => g.completo);
  const emFechado = new Set(fechados.flatMap(membrosDentro));
  type Entrada = { chave: string; nomes: string[]; grupo: Grupo | null; musica: MusicaBase | null };
  const entradas: Entrada[] = [
    ...fechados.map((g) => ({ chave: g.id, nomes: membrosDentro(g), grupo: g, musica: g.musica })),
    ...formandos.filter((f) => !emFechado.has(f)).map((f) => ({ chave: f, nomes: [f], grupo: null, musica: porFormando.get(f) ?? null })),
  ].sort((x, y) => x.nomes[0].localeCompare(y.nomes[0], 'pt-BR'));
  const comMusica = entradas.filter((e) => e.musica) as (Entrada & { musica: MusicaBase })[];
  const faltam = entradas.filter((e) => !e.musica).flatMap((e) => e.nomes);
  const prontos = formandos.length - faltam.length;
  const seFormando = grupos.filter((g) => !g.completo);
  const mesmaQue = (e: Entrada) =>
    comMusica
      .filter((o) => o.chave !== e.chave && e.musica && o.musica.plataforma === e.musica.plataforma && o.musica.codigo === e.musica.codigo)
      .map((o) => juntarNomes(o.nomes));

  const linhasDJ = comMusica.map(
    (e) => `${juntarNomes(e.nomes)} — ${e.musica.titulo ?? 'Vídeo do YouTube'} — começa em ${formatarTempo(e.musica.inicio)} — ${linkDaMusica(e.musica)}`,
  );

  async function copiarLista() {
    const lista = `Músicas da descida da escada · Turma 32\n\n${linhasDJ.join('\n')}`;
    try {
      await navigator.clipboard.writeText(lista);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie a lista:', lista);
    }
  }

  function baixarPlanilha() {
    const celula = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const linhas = [
      ['Formando(s)', 'Música', 'Começa em', 'Link'],
      ...comMusica.map((e) => [juntarNomes(e.nomes), e.musica.titulo ?? '', formatarTempo(e.musica.inicio), linkDaMusica(e.musica)]),
    ];
    // The BOM makes Excel read the accents right.
    const csv = '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'musicas-descida-turma-32.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <Card padding="var(--space-6) var(--space-7)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={titulo}>Link para a turma</span>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--accent)', wordBreak: 'break-all' }}>{urlDaMusica()}</span>
          <span style={pequeno}>
            O mesmo para todos: cada formando entra com o próprio WhatsApp (o mesmo da votação) e só vê a própria música, ou a do
            grupo com quem vai descer.
          </span>
          <BotoesLink
            url={urlDaMusica()}
            mensagem="Escolha a música para descer a escada no baile! Cole o link do YouTube e diga o minuto em que ela começa:"
          />
        </div>
      </Card>

      <Card padding="var(--space-6) var(--space-7)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: mobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-5)',
              flexDirection: mobile ? 'column' : 'row',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, lineHeight: 1, color: 'var(--accent)' }}>
                {prontos}
                <span style={{ fontSize: 20, color: 'var(--text-faint)' }}> / {formandos.length}</span>
              </span>
              <span style={pequeno}>
                já têm música{fechados.length ? ` (${fechados.length} ${fechados.length === 1 ? 'grupo' : 'grupos'})` : ''} · lista {dados.abertas ? 'aberta: a turma ainda pode trocar' : 'fechada: só a comissão mexe'}
              </span>
            </div>
            <Button
              variant={dados.abertas ? 'secondary' : 'primary'}
              disabled={salvando}
              onClick={() => {
                const fechar = dados.abertas;
                if (fechar && !window.confirm('Fechar a lista? A turma não consegue mais escolher nem trocar a música. Vocês continuam podendo mexer.')) return;
                agir({ acao: 'abertas', abertas: !fechar }, null);
              }}
            >
              {dados.abertas ? 'Fechar lista' : 'Abrir lista de novo'}
            </Button>
          </div>
          {faltam.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={pequeno}>Faltam {faltam.length}:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {faltam.map((f) => (
                  <Badge key={f}>{f}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ ...texto, color: 'var(--state-ok)' }}>Todo mundo já escolheu.</span>
          )}
          {comMusica.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Button variant="secondary" size="sm" onClick={copiarLista}>
                {copiado ? 'Copiada' : 'Copiar lista para o DJ'}
              </Button>
              <Button variant="secondary" size="sm" onClick={baixarPlanilha}>
                Baixar planilha (.csv)
              </Button>
            </div>
          ) : null}
          {erro && erro.formando === null ? <span style={erroEstilo}>{erro.texto}</span> : null}
        </div>
      </Card>

      {seFormando.length > 0 ? (
        <Card padding="var(--space-6) var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <span style={{ ...titulo, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} aria-hidden /> Grupos se formando
            </span>
            <span style={pequeno}>
              Ainda falta alguém aceitar. Enquanto isso, cada um aparece na lista abaixo com a própria música.
            </span>
            {seFormando.map((g) => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--stroke-hair)' }}>
                <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>Grupo de {g.criadoPor}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {g.membros.map((m) => (
                    <Badge key={m.formando} tone={m.emOutroGrupo || m.semGrupo ? 'neutral' : corDoStatus[m.status]}>
                      {m.formando} · {m.emOutroGrupo ? 'em outro grupo' : m.semGrupo ? 'vai sem grupo' : nomeDoStatus[m.status].toLowerCase()}
                    </Badge>
                  ))}
                </div>
                <div style={{ display: 'flex', marginLeft: -12 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={salvando}
                    onClick={() => {
                      if (window.confirm(`Desfazer o grupo de ${g.criadoPor}?`)) agir({ acao: 'desfazerGrupo', grupo: g.id }, g.id);
                    }}
                  >
                    Desfazer grupo
                  </Button>
                </div>
                {erro?.formando === g.id ? <span style={erroEstilo}>{erro.texto}</span> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card padding={0} style={{ overflow: 'hidden' }}>
        {entradas.map((e, i) => {
          const m = e.musica;
          const repetidaCom = m ? mesmaQue(e) : [];
          const erroAqui = erro?.formando === e.chave ? erro.texto : null;
          const nome = juntarNomes(e.nomes);
          const quem = e.grupo ? { grupo: e.grupo.id } : { formando: e.chave };
          return (
            <div
              key={e.chave}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                padding: 'var(--space-5) var(--space-7)',
                borderTop: i === 0 ? 'none' : '1px solid var(--stroke-hair)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0, flex: '1 1 260px' }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {nome}
                    {e.grupo ? <Badge tone="gild">Grupo</Badge> : null}
                  </span>
                  {m ? (
                    <>
                      <a
                        href={linkDaMusica(m)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'baseline' }}
                      >
                        <Music size={14} aria-hidden style={{ flex: '0 0 auto', transform: 'translateY(2px)' }} />
                        <span style={{ overflowWrap: 'anywhere' }}>{m.titulo ?? linkDaMusica(m)}</span>
                      </a>
                      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--accent)' }}>
                        Começa em {formatarTempo(m.inicio)}
                      </span>
                      {repetidaCom.length > 0 ? (
                        <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-warn)' }}>Mesma música de {repetidaCom.join('; ')}</span>
                      ) : null}
                    </>
                  ) : (
                    <span style={pequeno}>{e.grupo ? 'Ainda não escolheram.' : 'Ainda não escolheu.'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginLeft: -12 }}>
                  {m ? (
                    <Button variant="ghost" size="sm" onClick={() => setOuvindo(ouvindo === e.chave ? null : e.chave)}>
                      {ouvindo === e.chave ? 'Fechar' : 'Ouvir'}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setErro(null);
                      setEditando(editando === e.chave ? null : e.chave);
                    }}
                  >
                    {m ? 'Editar' : 'Adicionar'}
                  </Button>
                  {m ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={salvando}
                      onClick={() => {
                        if (window.confirm(`Tirar a música de ${nome}?`)) agir({ acao: 'apagar', ...quem }, e.chave);
                      }}
                    >
                      Tirar
                    </Button>
                  ) : null}
                  {e.grupo ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={salvando}
                      onClick={() => {
                        if (window.confirm(`Desfazer o grupo de ${nome}? Cada um volta para a própria música.`)) agir({ acao: 'desfazerGrupo', grupo: e.grupo!.id }, e.chave);
                      }}
                    >
                      Desfazer grupo
                    </Button>
                  ) : null}
                </div>
              </div>
              {m && ouvindo === e.chave ? <OuvirDaComissao musica={m} /> : null}
              {editando === e.chave ? (
                <FormularioMusica
                  cabecalho={e.grupo ? `Música do grupo: ${nome}` : `Música de ${nome}`}
                  atual={m}
                  salvando={salvando}
                  erro={erroAqui}
                  onSalvar={async (link, inicio) => {
                    if (await agir({ acao: 'escolher', link, inicio, ...quem }, e.chave)) setEditando(null);
                  }}
                  onCancelar={() => setEditando(null)}
                />
              ) : erroAqui ? (
                <span style={erroEstilo}>{erroAqui}</span>
              ) : null}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/** A song in the committee's list, played from where it starts. */
function OuvirDaComissao({ musica }: { musica: MusicaBase }) {
  const player = useRef<PlayerYT | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Previa codigo={musica.codigo} inicio={musica.inicio} player={player} />
      <div style={{ display: 'flex' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            player.current?.seekTo(musica.inicio, true);
            player.current?.playVideo();
          }}
        >
          Tocar a partir de {formatarTempo(musica.inicio)}
        </Button>
      </div>
    </div>
  );
}
