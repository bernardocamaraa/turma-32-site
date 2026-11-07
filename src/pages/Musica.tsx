import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Music, TriangleAlert, User, Users } from 'lucide-react';
import { Badge } from '../components/Badge';
import { BotoesLink } from '../components/BotoesLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { EntrarComWhatsapp } from '../components/EntrarComWhatsapp';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { PageHeader } from '../components/SectionHeading';
import { lerEleitor, salvarEleitor } from '../lib/eleitor';
import {
  buscarMusicas,
  formatarTempo,
  juntarNomes,
  lerLinkDaMusica,
  membrosDentro,
  linkDaMusica,
  urlDaMusica,
  type AcaoMusicas,
  type AcessoMusicas,
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
  const [eleitor, setEleitor] = useState(lerEleitor);
  const [dados, setDados] = useState<DadosMusicas | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar(com: AcessoMusicas): Promise<DadosMusicas | null> {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const novo = await buscarMusicas(com);
      setDados(novo);
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
    });
  }, []);

  // Invitations and answers come from classmates' phones: catch up now and
  // then while the page is open.
  const dentro = eleitor !== null && !!dados?.voce;
  useEffect(() => {
    if (!dentro || !eleitor) return;
    let ativo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const novo = await buscarMusicas(eleitor);
        if (ativo && novo.voce) setDados(novo);
      } catch (e) {
        console.error(e);
      }
    }, 20000);
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

  /** Runs an action; the error message to show, or null if it worked. */
  async function agir(acao: AcaoMusicas): Promise<string | null> {
    if (!eleitor) return 'Entre de novo com o seu WhatsApp.';
    setSalvando(true);
    try {
      setDados(await buscarMusicas(eleitor, acao));
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
        maxWidth: 'var(--maxw-page)',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-7)',
      }}
    >
      <PageHeader eyebrow="Turma 32 · Baile" title="A música da sua descida." />

      {!eleitor || !dados?.voce ? (
        <EntrarComWhatsapp
          livres={dados?.livres ?? []}
          entrando={entrando}
          erro={erroAcesso}
          onEntrar={identificar}
          explicacao="No baile, cada formando desce a escada com a sua música. Digite o seu WhatsApp para escolher a sua (é o mesmo número da votação)."
          botao="Entrar"
        />
      ) : (
        <>
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: '40rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.1 }}>
                Olá, {dados.voce.split(' ')[0]}.
              </span>
              <p style={texto}>
                Em poucos passos você escolhe a música da sua descida da escada e o momento em que ela começa. Só a comissão vê
                as escolhas; para a turma, é surpresa.
              </p>
              <div style={{ display: 'flex' }}>
                <Button variant="ghost" onClick={sair} style={{ paddingLeft: 0 }}>
                  Não é você? Trocar
                </Button>
              </div>
            </div>
          </Card>

          <PassoAPasso
            key={grupo?.completo ? `grupo-${grupo.id}` : 'sozinho'}
            dados={{ ...dados, voce: dados.voce }}
            salvando={salvando}
            agir={agir}
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
    <Card padding="var(--space-7)" style={{ border: '1px solid var(--gild-400)' }}>
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
          <Button disabled={salvando || jaTemGrupo || !abertas} onClick={() => responder(true)}>
            Aceitar
          </Button>
          <Button variant="ghost" disabled={salvando || !abertas} onClick={() => responder(false)}>
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
 */
function PassoAPasso({
  dados,
  salvando,
  agir,
}: {
  dados: DadosMusicas & { voce: string };
  salvando: boolean;
  agir: (acao: AcaoMusicas) => Promise<string | null>;
}) {
  const grupo = dados.grupo;
  const fechado = !!grupo?.completo;
  // The song that counts now: the complete group's, or their own.
  const musica = fechado ? grupo!.musica : dados.minha;
  const [etapa, setEtapa] = useState<Etapa>(musica ? 'pronto' : 'modo');
  const [link, setLink] = useState('');
  const [minuto, setMinuto] = useState('');
  const [segundo, setSegundo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function ir(para: Etapa) {
    setErro(null);
    setEtapa(para);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function definirInicio(segundos: number) {
    setMinuto(String(Math.floor(segundos / 60)));
    setSegundo(String(segundos % 60));
  }

  if (!dados.abertas) {
    return musica ? (
      <PassoPronto musica={musica} paraGrupo={fechado} grupo={grupo} repetida={dados.repetida} abertas={false} salvando={salvando} convites={0} />
    ) : (
      <Card padding="var(--space-7)">
        <p style={texto}>A comissão já fechou a lista de músicas. Se você ainda não mandou a sua, fale com ela.</p>
      </Card>
    );
  }

  const indice = ETAPAS.findIndex((e) => e.id === etapa);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Etapas atual={indice} onIr={(i) => ir(ETAPAS[i].id)} />

      {etapa === 'modo' ? (
        <PassoModo
          dados={dados}
          salvando={salvando}
          agir={agir}
          onSozinho={() => ir(musica && !fechado ? 'pronto' : 'link')}
          onProximo={() => ir(musica ? 'pronto' : 'link')}
        />
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
            if (!falha) ir('pronto');
          }}
        />
      ) : musica ? (
        <PassoPronto
          musica={musica}
          paraGrupo={fechado}
          grupo={grupo}
          repetida={dados.repetida}
          abertas
          salvando={salvando}
          convites={grupo ? 0 : (dados.convites ?? []).length}
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
      ) : (
        // "Pronto" without a song (it was just taken out somewhere else): start over.
        <PassoModo
          dados={dados}
          salvando={salvando}
          agir={agir}
          onSozinho={() => ir('link')}
          onProximo={() => ir('link')}
        />
      )}
    </div>
  );
}

/** The four steps across the top: done ones get a check and can be gone back to. */
function Etapas({ atual, onIr }: { atual: number; onIr: (i: number) => void }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
      {ETAPAS.map((e, i) => {
        const feita = i < atual;
        const agora = i === atual;
        return (
          <li key={e.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', position: 'relative' }}>
            {i > 0 ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 17,
                  right: '50%',
                  width: '100%',
                  height: 2,
                  background: i <= atual ? 'var(--gild-400)' : 'var(--stroke-hair)',
                  zIndex: 0,
                }}
              />
            ) : null}
            <button
              type="button"
              disabled={!feita}
              onClick={() => onIr(i)}
              aria-current={agora ? 'step' : undefined}
              aria-label={`Passo ${i + 1}: ${e.nome}`}
              style={{
                position: 'relative',
                zIndex: 1,
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                fontWeight: 700,
                cursor: feita ? 'pointer' : 'default',
                border: agora || feita ? 'none' : '1px solid var(--stroke-hair)',
                background: agora ? 'var(--chalk-050)' : feita ? 'var(--gild-400)' : 'var(--ink-800)',
                color: agora || feita ? '#000' : 'var(--text-faint)',
                boxShadow: agora ? '0 0 0 4px rgba(245,245,247,.12)' : 'none',
              }}
            >
              {feita ? <Check size={18} strokeWidth={3} aria-hidden /> : i + 1}
            </button>
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.2,
                textAlign: 'center',
                color: agora ? 'var(--text-primary)' : 'var(--text-faint)',
                fontWeight: agora ? 600 : 400,
              }}
            >
              {e.nome}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Passo 2 de 4" over a step's title. */
function CabecalhoPasso({ numero, titulo: t, sobre }: { numero: number; titulo: string; sobre?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--gild-300)' }}>
        Passo {numero} de 4
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{t}</span>
      {sobre ? <p style={texto}>{sobre}</p> : null}
    </div>
  );
}

/** A small numbered instruction: "1  Abra o YouTube". */
function Instrucao({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(201,169,106,.16)',
          color: 'var(--gild-300)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {n}
      </span>
      <span style={{ ...texto, color: 'var(--text-primary)', paddingTop: 1 }}>{children}</span>
    </li>
  );
}

/** One of the two big choices of step 1. */
function Opcao({ icone, titulo: t, sobre, ativa, onClick }: { icone: ReactNode; titulo: string; sobre: string; ativa?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 220px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-2)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-md, 16px)',
        textAlign: 'left',
        cursor: 'pointer',
        background: ativa ? 'rgba(201,169,106,.12)' : 'var(--ink-800)',
        border: `1px solid ${ativa ? 'var(--gild-400)' : 'var(--stroke-hair)'}`,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-core)',
      }}
    >
      <span style={{ color: 'var(--gild-300)' }}>{icone}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600 }}>{t}</span>
      <span style={pequeno}>{sobre}</span>
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
              <Button size="lg" iconRight={<ArrowRight size={18} aria-hidden />} onClick={onProximo}>
                {grupo.musica ? 'Ver a música do grupo' : 'Próximo: a música do grupo'}
              </Button>
            </div>
          ) : (
            <Card padding="var(--space-6) var(--space-7)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <p style={texto}>
                  Assim que todos aceitarem, vocês seguem para o passo 2 e escolhem a música do grupo (qualquer um pode escolher).
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <CabecalhoPasso
              numero={1}
              titulo="Você vai descer só ou em grupo?"
              sobre={
                convites.length > 0
                  ? `Aceite ${convites.length === 1 ? 'o convite' : 'um dos convites'} aí em cima, ou escolha aqui. "Só eu" avisa quem te convidou, mas não recusa: o convite continua lá se você mudar de ideia.`
                  : undefined
              }
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <Opcao icone={<User size={26} aria-hidden />} titulo="Só eu" sobre="Você escolhe a sua música." onClick={sozinho} />
              <Opcao
                icone={<Users size={26} aria-hidden />}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--stroke-hair)' }}>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <CabecalhoPasso numero={2} titulo={paraGrupo ? 'Qual é a música do grupo?' : 'Qual é a sua música?'} />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Instrucao n={1}>
            Abra o YouTube e procure a música.{' '}
            <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              Abrir o YouTube
            </a>
          </Instrucao>
          <Instrucao n={2}>
            No vídeo, toque em <strong>Compartilhar</strong>.
          </Instrucao>
          <Instrucao n={3}>
            Toque em <strong>Copiar link</strong>.
          </Instrucao>
          <Instrucao n={4}>Volte aqui e cole o link no campo abaixo.</Instrucao>
        </ol>
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
            <Button variant="secondary" onClick={colar} style={{ marginBottom: lido && 'erro' in lido ? 30 : 0 }}>
              Colar
            </Button>
          ) : null}
        </div>
        {video ? (
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
            <img
              src={`https://i.ytimg.com/vi/${video.codigo}/mqdefault.jpg`}
              alt=""
              style={{ width: 160, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke-hair)' }}
            />
            <span style={{ ...texto, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--state-ok)' }}>
              <Check size={18} strokeWidth={3} aria-hidden /> Achamos o vídeo!
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

/** Step 3: where the song starts — play, pause at the spot, "Começar daqui". */
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <CabecalhoPasso numero={3} titulo="Em que momento a música começa?" sobre="É o trecho que vai tocar quando você aparecer na escada." />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Instrucao n={1}>Dê play no vídeo.</Instrucao>
          <Instrucao n={2}>Pause no ponto onde a música deve começar.</Instrucao>
          <Instrucao n={3}>
            Toque em <strong>Começar daqui</strong>.
          </Instrucao>
        </ol>
        <Previa codigo={video.codigo} inicio={inicio ?? 0} player={player} />
        <div style={{ display: 'flex' }}>
          <Button size="lg" variant="gild" disabled={agora === null} onClick={() => agora !== null && onInicio(agora)}>
            {agora === null ? 'Começar daqui' : `Começar daqui (${formatarTempo(agora)})`}
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-5)', borderRadius: 'var(--radius-sm)', background: 'var(--ink-800)' }}>
          <span style={pequeno}>A música vai começar em</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Input
              aria-label="Minuto"
              placeholder="0"
              inputMode="numeric"
              value={minuto}
              onChange={(e) => onMinuto(e.target.value.replace(/\D/g, '').slice(0, 3))}
              style={{ width: 84 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700 }}>:</span>
            <Input
              aria-label="Segundo"
              placeholder="00"
              inputMode="numeric"
              value={segundo}
              onChange={(e) => onSegundo(e.target.value.replace(/\D/g, '').slice(0, 2))}
              style={{ width: 84 }}
            />
            <Button
              variant="ghost"
              disabled={inicio === null}
              onClick={() => {
                player.current?.seekTo(inicio ?? 0, true);
                player.current?.playVideo();
              }}
            >
              Ouvir daí
            </Button>
          </div>
          <span style={pequeno}>{valido ? 'minuto : segundo. Se preferir, digite aqui.' : 'O segundo vai de 0 a 59.'}</span>
        </div>

        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button size="lg" disabled={inicio === null || salvando} carregando={salvando} onClick={() => inicio !== null && onSalvar(inicio)}>
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

/** Step 4: the song is saved — play it, change it, or take it out. */
function PassoPronto({
  musica,
  paraGrupo,
  grupo,
  repetida,
  abertas,
  salvando,
  convites,
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
  erro?: string | null;
  onMudarMinuto?: () => void;
  onTrocar?: () => void;
  onTirar?: () => void;
  onGrupo?: () => void;
}) {
  const player = useRef<PlayerYT | null>(null);
  return (
    <Card padding="var(--space-7)" style={{ border: '1px solid rgba(127,185,138,.4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span
            aria-hidden
            style={{ flex: '0 0 auto', width: 48, height: 48, borderRadius: '50%', background: 'var(--state-ok)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Check size={28} strokeWidth={3} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 700, letterSpacing: '-.02em' }}>Pronto!</span>
            <span style={pequeno}>{paraGrupo ? 'A música do grupo está salva.' : 'A sua música está salva.'}</span>
          </div>
        </div>

        {paraGrupo && grupo ? <p style={texto}>Vocês descem juntos: {juntarNomes(membrosDentro(grupo))}.</p> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={titulo}>{musica.titulo ?? 'Vídeo do YouTube'}</span>
          <span style={{ ...texto, color: 'var(--accent)' }}>Começa em {formatarTempo(musica.inicio)}</span>
        </div>
        <Previa codigo={musica.codigo} inicio={musica.inicio} player={player} />
        <div style={{ display: 'flex' }}>
          <Button
            variant="secondary"
            onClick={() => {
              player.current?.seekTo(musica.inicio, true);
              player.current?.playVideo();
            }}
          >
            Ouvir a partir de {formatarTempo(musica.inicio)}
          </Button>
        </div>

        {repetida ? (
          <p role="note" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-warn)' }}>
            <TriangleAlert size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
            <span>Outro formando escolheu essa mesma música. Pode manter, mas talvez valha escolher outra.</span>
          </p>
        ) : null}
        {erro ? <span style={erroEstilo}>{erro}</span> : null}

        {abertas ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={onMudarMinuto}>
                Mudar o minuto
              </Button>
              <Button variant="secondary" onClick={onTrocar}>
                Trocar a música
              </Button>
              <Button variant="ghost" disabled={salvando} onClick={onTirar}>
                Tirar a música
              </Button>
            </div>
            <p style={pequeno}>Dá para voltar e mudar quando quiser, até a comissão fechar a lista.</p>
            {convites > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--stroke-hair)' }}>
                <span style={{ ...texto, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gild-300)' }}>
                  <Users size={18} aria-hidden /> Você tem {convites === 1 ? 'um convite' : `${convites} convites`} para descer em grupo.
                </span>
                <div style={{ display: 'flex', marginLeft: -12 }}>
                  <Button variant="ghost" onClick={onGrupo}>
                    Ver {convites === 1 ? 'o convite' : 'os convites'}
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', marginLeft: -12 }}>
                <Button variant="ghost" onClick={onGrupo}>
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
  destroy: () => void;
};

type ApiYT = {
  Player: new (
    el: HTMLElement,
    opcoes: { videoId: string; width?: string; height?: string; playerVars?: Record<string, number | string>; events?: Record<string, () => void> },
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
function Previa({ codigo, inicio, player }: { codigo: string; inicio: number; player: MutableRefObject<PlayerYT | null> }) {
  return <PlayerYoutube key={codigo} codigo={codigo} inicio={inicio} player={player} />;
}

function PlayerYoutube({ codigo, inicio, player }: { codigo: string; inicio: number; player: MutableRefObject<PlayerYT | null> }) {
  const lugar = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);
  // The start when the video was first shown: later changes only move the
  // "Ouvir a partir de" button, not the video under the formando's finger.
  const inicioInicial = useRef(inicio);

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
              if (ativo) player.current = criado;
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

  if (falhou) {
    return (
      <div style={moldura}>
        <iframe
          title="Vídeo do YouTube"
          src={`https://www.youtube.com/embed/${codigo}?start=${inicio}&playsinline=1&rel=0`}
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
