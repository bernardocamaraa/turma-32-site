import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { Music, TriangleAlert } from 'lucide-react';
import { Badge } from '../components/Badge';
import { BotoesLink } from '../components/BotoesLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { EntrarComWhatsapp } from '../components/EntrarComWhatsapp';
import { Input } from '../components/Input';
import { PageHeader } from '../components/SectionHeading';
import { lerEleitor, salvarEleitor } from '../lib/eleitor';
import {
  buscarMusicas,
  formatarTempo,
  lerLinkDaMusica,
  linkDaMusica,
  urlDaMusica,
  type AcaoMusicas,
  type AcessoMusicas,
  type DadosMusicas,
  type Musica as MusicaEscolhida,
  type Plataforma,
} from '../lib/musicas';
import { useIsMobile } from '../lib/useViewport';

const texto: CSSProperties = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const titulo: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' };
const erroEstilo: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' };

const nomeDaPlataforma = (p: Plataforma) => (p === 'youtube' ? 'YouTube' : 'Spotify');

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
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

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

  async function identificar(whatsapp: string, nome?: string): Promise<boolean | 'semNome'> {
    const novo = await carregar(nome ? { whatsapp, nome } : { whatsapp });
    if (!novo) return false;
    if (!novo.voce) return 'semNome';
    salvarEleitor({ whatsapp });
    setEleitor({ whatsapp });
    return true;
  }

  async function agir(acao: AcaoMusicas): Promise<boolean> {
    if (!eleitor) return false;
    setSalvando(true);
    setErroAcao(null);
    try {
      setDados(await buscarMusicas(eleitor, acao));
      return true;
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível salvar agora.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function sair() {
    salvarEleitor(null);
    setEleitor(null);
    setEditando(false);
    carregar({});
  }

  const minha = dados?.minha ?? null;

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
                Escolha a música para descer a escada: cole o link do YouTube (de preferência) ou do Spotify e diga em que
                minuto ela deve começar. Só a comissão vê a sua escolha; para a turma, é surpresa.
              </p>
              <div style={{ display: 'flex' }}>
                <Button variant="ghost" onClick={sair} style={{ paddingLeft: 0 }}>
                  Não é você? Trocar
                </Button>
              </div>
            </div>
          </Card>

          {minha && !editando ? (
            <SuaMusica
              musica={minha}
              repetida={dados.repetida}
              abertas={dados.abertas}
              salvando={salvando}
              erro={erroAcao}
              onTrocar={() => {
                setErroAcao(null);
                setEditando(true);
              }}
              onTirar={async () => {
                if (window.confirm('Tirar a sua música? Você pode escolher outra depois.')) await agir({ acao: 'apagar' });
              }}
            />
          ) : !dados.abertas ? (
            <Card padding="var(--space-7)">
              <p style={texto}>A comissão já fechou a lista de músicas. Se você ainda não mandou a sua, fale com ela.</p>
            </Card>
          ) : (
            <FormularioMusica
              atual={minha}
              salvando={salvando}
              erro={erroAcao}
              onSalvar={async (link, inicio) => {
                const deu = await agir({ acao: 'escolher', link, inicio });
                if (deu) setEditando(false);
              }}
              onCancelar={minha ? () => setEditando(false) : undefined}
            />
          )}
        </>
      )}
    </main>
  );
}

/** The song a formando already picked, playable from where it starts. */
function SuaMusica({
  musica,
  repetida,
  abertas,
  salvando,
  erro,
  onTrocar,
  onTirar,
}: {
  musica: MusicaEscolhida;
  repetida: boolean;
  abertas: boolean;
  salvando: boolean;
  erro: string | null;
  onTrocar: () => void;
  onTirar: () => void;
}) {
  const player = useRef<PlayerYT | null>(null);
  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={pequeno}>Sua música</span>
          <span style={titulo}>{musica.titulo ?? `Música do ${nomeDaPlataforma(musica.plataforma)}`}</span>
          <span style={{ ...texto, color: 'var(--accent)' }}>
            Começa em {formatarTempo(musica.inicio)} · {nomeDaPlataforma(musica.plataforma)}
          </span>
        </div>
        <Previa plataforma={musica.plataforma} codigo={musica.codigo} inicio={musica.inicio} player={player} />
        {musica.plataforma === 'youtube' ? (
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
        ) : null}
        {repetida ? (
          <p role="note" style={{ ...texto, display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--state-warn)' }}>
            <TriangleAlert size={18} strokeWidth={2} aria-hidden style={{ flex: '0 0 auto', marginTop: 3 }} />
            <span>Outro formando escolheu essa mesma música. Pode manter, mas talvez valha escolher outra.</span>
          </p>
        ) : null}
        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        {abertas ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Button onClick={onTrocar}>Trocar a música ou o minuto</Button>
            <Button variant="ghost" disabled={salvando} onClick={onTirar}>
              Tirar a música
            </Button>
          </div>
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
  formando,
}: {
  atual: MusicaEscolhida | null;
  salvando: boolean;
  erro: string | null;
  onSalvar: (link: string, inicio: number) => void;
  onCancelar?: () => void;
  /** Committee: whose song this is, for the heading. */
  formando?: string;
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
    if (musica?.plataforma !== 'youtube') return;
    const id = setInterval(() => {
      const p = player.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const t = p.getCurrentTime();
      setAgora(Number.isFinite(t) ? Math.floor(t) : null);
    }, 400);
    return () => clearInterval(id);
  }, [musica?.plataforma, musica?.codigo]);

  const m = minuto.trim() === '' ? 0 : Number(minuto);
  const s = segundo.trim() === '' ? 0 : Number(segundo);
  const tempoValido = Number.isInteger(m) && Number.isInteger(s) && m >= 0 && m < 600 && s >= 0 && s < 60;
  const inicio = tempoValido ? m * 60 + s : null;
  const pode = (musica !== null || (lido !== null && 'curto' in lido)) && inicio !== null && !salvando;

  function usarAgora() {
    if (agora === null) return;
    setMinuto(String(Math.floor(agora / 60)));
    setSegundo(String(agora % 60));
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <span style={titulo}>{formando ? `Música de ${formando}` : atual ? 'Trocar a música' : 'Escolher a música'}</span>
        <Input
          label="Link da música"
          placeholder="https://www.youtube.com/watch?v=…"
          inputMode="url"
          value={link}
          hint="No YouTube ou no Spotify, toque em Compartilhar e em Copiar link. YouTube é melhor: dá para ouvir aqui a partir do minuto escolhido."
          error={lido && 'erro' in lido ? lido.erro : undefined}
          onChange={(e) => setLink(e.target.value)}
        />
        {lido && 'curto' in lido ? (
          <p style={pequeno}>Link curto do Spotify: o site descobre a música quando você salvar.</p>
        ) : null}
        {musica ? <Previa plataforma={musica.plataforma} codigo={musica.codigo} inicio={inicio ?? 0} player={player} /> : null}
        {musica?.plataforma === 'spotify' ? (
          <p style={pequeno}>
            O player do Spotify aqui pode tocar só um trecho. Para conferir o minuto, ouça no app do Spotify.
          </p>
        ) : null}

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
          {musica?.plataforma === 'youtube' ? (
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
          {musica?.plataforma === 'youtube' ? (
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
 * The video (YouTube, through its API, so the page can jump to the start
 * and read where it is) or the track (Spotify's embed). If YouTube's script
 * can't load, a plain embed that starts at `inicio`.
 */
function Previa({
  plataforma,
  codigo,
  inicio,
  player,
}: {
  plataforma: Plataforma;
  codigo: string;
  inicio: number;
  player: MutableRefObject<PlayerYT | null>;
}) {
  if (plataforma === 'spotify') {
    return (
      <iframe
        title="Player do Spotify"
        src={`https://open.spotify.com/embed/track/${codigo}`}
        width="100%"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        style={{ border: 0, borderRadius: 12, maxWidth: 560 }}
      />
    );
  }
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
  const porFormando = new Map(musicas.map((m) => [m.formando, m]));
  const faltam = formandos.filter((f) => !porFormando.has(f));
  const mesmaQue = (m: MusicaEscolhida) =>
    musicas.filter((o) => o.formando !== m.formando && o.plataforma === m.plataforma && o.codigo === m.codigo).map((o) => o.formando);

  const linhasDJ = musicas.map(
    (m) => `${m.formando} — ${m.titulo ?? nomeDaPlataforma(m.plataforma)} — começa em ${formatarTempo(m.inicio)} — ${linkDaMusica(m)}`,
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
      ['Formando', 'Música', 'Plataforma', 'Começa em', 'Link'],
      ...musicas.map((m) => [m.formando, m.titulo ?? '', nomeDaPlataforma(m.plataforma), formatarTempo(m.inicio), linkDaMusica(m)]),
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
            O mesmo para todos: cada formando entra com o próprio WhatsApp (o mesmo da votação) e só vê a própria música.
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
                {musicas.length}
                <span style={{ fontSize: 20, color: 'var(--text-faint)' }}> / {formandos.length}</span>
              </span>
              <span style={pequeno}>
                já escolheram · lista {dados.abertas ? 'aberta: a turma ainda pode trocar' : 'fechada: só a comissão mexe'}
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
          {musicas.length > 0 ? (
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

      <Card padding={0} style={{ overflow: 'hidden' }}>
        {formandos.map((f, i) => {
          const m = porFormando.get(f) ?? null;
          const repetidaCom = m ? mesmaQue(m) : [];
          const erroAqui = erro?.formando === f ? erro.texto : null;
          return (
            <div
              key={f}
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
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{f}</span>
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
                        Começa em {formatarTempo(m.inicio)} · {nomeDaPlataforma(m.plataforma)}
                      </span>
                      {repetidaCom.length > 0 ? (
                        <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-warn)' }}>
                          Mesma música de {repetidaCom.join(', ')}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span style={pequeno}>Ainda não escolheu.</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginLeft: -12 }}>
                  {m ? (
                    <Button variant="ghost" size="sm" onClick={() => setOuvindo(ouvindo === f ? null : f)}>
                      {ouvindo === f ? 'Fechar' : 'Ouvir'}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setErro(null);
                      setEditando(editando === f ? null : f);
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
                        if (window.confirm(`Tirar a música de ${f}?`)) agir({ acao: 'apagar', formando: f }, f);
                      }}
                    >
                      Tirar
                    </Button>
                  ) : null}
                </div>
              </div>
              {m && ouvindo === f ? <OuvirDaComissao musica={m} /> : null}
              {editando === f ? (
                <FormularioMusica
                  formando={f}
                  atual={m}
                  salvando={salvando}
                  erro={erroAqui}
                  onSalvar={async (link, inicio) => {
                    if (await agir({ acao: 'escolher', link, inicio, formando: f }, f)) setEditando(null);
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
function OuvirDaComissao({ musica }: { musica: MusicaEscolhida }) {
  const player = useRef<PlayerYT | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Previa plataforma={musica.plataforma} codigo={musica.codigo} inicio={musica.inicio} player={player} />
      {musica.plataforma === 'youtube' ? (
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
      ) : (
        <span style={pequeno}>No Spotify, o player daqui toca só um trecho: confira o minuto no app.</span>
      )}
    </div>
  );
}
