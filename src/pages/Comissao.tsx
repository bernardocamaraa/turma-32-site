import { useEffect, useState, type CSSProperties } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Carregando } from '../components/Carregando';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Input } from '../components/Input';
import { PageHeader } from '../components/SectionHeading';
import { lerCodigo, salvarCodigo } from '../lib/codigoComissao';
import { buscarInfancia } from '../lib/infancia';
import { buscarMesas, type DadosMesas } from '../lib/mesas';
import { buscarDadosComissao, urlDaFoto, type ComissaoData } from '../lib/supabase';
import { useIsMobile } from '../lib/useViewport';
import { buscarVotacao, type DadosVotacao } from '../lib/votacao';
import { Infancia } from './Infancia';
import { Mesas } from './Mesas';
import { Votacao } from './Votacao';

const texto = { margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' };

const ABAS = [
  { para: '/comissao', nome: 'Início' },
  { para: '/comissao/votacao', nome: 'Votação' },
  { para: '/comissao/mesas', nome: 'Mesas' },
  { para: '/comissao/fotos-de-crianca', nome: 'Fotos de criança' },
  { para: '/comissao/album', nome: 'Álbum e mensagens' },
];

/**
 * The committee area: one way in (the committee code, remembered on this
 * device) and everything the committee runs, one tab each — the vote, the
 * table map, the childhood photos, the party album and the messages. The
 * formandos' own pages (/votacao, /mesas/<link>) stay apart.
 */
export function Comissao() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [codigo, setCodigo] = useState(lerCodigo);
  // The code that got in — the tabs use this one, not what's being typed.
  const [codigoValido, setCodigoValido] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  // Checking a saved code on the way in: no need to show the form meanwhile.
  const [automatico, setAutomatico] = useState(() => !!lerCodigo());

  async function entrar() {
    const tentativa = codigo.trim();
    setEntrando(true);
    setErroAcesso(null);
    try {
      // Any of the committee's functions checks the code; this one is the lightest.
      await buscarDadosComissao(tentativa);
      salvarCodigo(tentativa);
      setCodigoValido(tentativa);
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
      salvarCodigo(null);
    } finally {
      setEntrando(false);
      setAutomatico(false);
    }
  }

  // With a saved code, straight in.
  useEffect(() => {
    if (codigo) entrar();
  }, []);

  function sair() {
    salvarCodigo(null);
    setCodigo('');
    setCodigoValido(null);
    navigate('/comissao');
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
      <PageHeader eyebrow="Comissão · Turma 32" title="Área da comissão." />

      {!codigoValido ? (
        automatico ? (
          <Carregando texto="Entrando…" />
        ) : (
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
              <p style={texto}>
                Esta área é só da comissão: a votação, o mapa das mesas, as fotos de criança, o álbum da festa e as
                mensagens, tudo num lugar só. Digite o código combinado com a turma.
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
                <Button size="lg" disabled={!codigo.trim()} carregando={entrando} onClick={entrar}>
                  {entrando ? 'Entrando…' : 'Entrar'}
                </Button>
              </div>
            </div>
          </Card>
        )
      ) : (
        <>
          <Abas />
          {/* Keyed by tab, so a tab that crashed comes back when another is opened. */}
          <ErrorBoundary key={pathname}>
            <Routes>
              <Route index element={<Inicio codigo={codigoValido} />} />
              <Route path="votacao" element={<Votacao codigoComissao={codigoValido} />} />
              <Route path="mesas" element={<Mesas codigoComissao={codigoValido} />} />
              <Route path="fotos-de-crianca" element={<Infancia codigo={codigoValido} />} />
              <Route path="album" element={<AlbumEMensagens codigo={codigoValido} />} />
              <Route path="*" element={<Navigate to="/comissao" replace />} />
            </Routes>
          </ErrorBoundary>
          <div style={{ display: 'flex' }}>
            <Button variant="ghost" onClick={sair}>
              Sair da área da comissão
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

/**
 * The tabs, kept at the top while scrolling (a tab like the table map is
 * long). On a phone they slide sideways.
 */
function Abas() {
  const aba = (ativa: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    height: 'var(--control-h-sm)',
    padding: '0 16px',
    flex: '0 0 auto',
    borderRadius: 'var(--radius-pill)',
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    background: ativa ? 'var(--chalk-050)' : 'rgba(245,245,247,.1)',
    color: ativa ? '#000000' : 'var(--chalk-050)',
    transition: 'background var(--dur) var(--ease-out)',
  });
  return (
    <nav
      aria-label="Seções da comissão"
      style={{
        position: 'sticky',
        top: 52,
        zIndex: 30,
        display: 'flex',
        gap: 'var(--space-3)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        margin: 'calc(-1 * var(--space-4)) calc(-1 * var(--gutter-page))',
        padding: 'var(--space-4) var(--gutter-page)',
        background: 'rgba(0,0,0,.82)',
        backdropFilter: 'var(--blur-scrim)',
        WebkitBackdropFilter: 'var(--blur-scrim)',
      }}
    >
      {ABAS.map((a) => (
        <NavLink key={a.para} to={a.para} end style={({ isActive }) => aba(isActive)}>
          {a.nome}
        </NavLink>
      ))}
    </nav>
  );
}

const lista = (nomes: string[]) => (nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function resumoVotacao(d: DadosVotacao): string {
  const abertas = d.perguntas.filter((p) => p.aberta && !p.pronta);
  const prontas = d.perguntas.filter((p) => p.pronta).length;
  if (d.perguntas.length === 0) return 'Nenhuma pergunta criada ainda.';
  if (abertas.length === 0) return prontas ? `Nenhuma pergunta aberta agora · ${plural(prontas, 'pronta', 'prontas')} para abrir` : 'Nenhuma pergunta aberta agora.';
  // Everyone sends all open questions at once, so the one missing the most people says it all.
  const p = abertas.reduce((a, b) => ((b.faltam?.length ?? 0) > (a.faltam?.length ?? 0) ? b : a));
  const faltam = p.faltam ?? [];
  if (faltam.length === 0) return 'Todo mundo já votou. Já dá para encerrar e ver o resultado.';
  return `${p.votaram ?? 0} de ${d.formandos.length} já votaram · ${faltam.length <= 3 ? `faltam ${lista(faltam)}` : `faltam ${faltam.length}`}`;
}

function resumoMesas(d: DadosMesas): string {
  const lugares = d.convidados.reduce((s, c) => s + c.total, 0);
  const marcados = d.reservas.reduce((s, r) => s + r.lugares, 0);
  if (lugares === 0) return 'Falta cadastrar quantas pessoas cada formando leva.';
  return `${marcados} de ${lugares} lugares marcados · mapa ${d.abertas ? 'aberto' : 'fechado'} para a turma`;
}

/** The first tab: what's going on in each part, at a glance, each one a way into its tab. */
function Inicio({ codigo }: { codigo: string }) {
  const mobile = useIsMobile();
  const [resumo, setResumo] = useState<Record<string, string>>({});

  // Each one on its own: a part that fails to load just shows no summary.
  useEffect(() => {
    let ativo = true;
    const definir = (aba: string) => (valor: string) => {
      if (ativo) setResumo((r) => ({ ...r, [aba]: valor }));
    };
    buscarVotacao({ codigo }).then(resumoVotacao).then(definir('votacao'), console.error);
    buscarMesas({ codigo }).then(resumoMesas).then(definir('mesas'), console.error);
    buscarInfancia(codigo)
      .then((d) => `${d.formandos.filter((f) => f.fotos.length > 0).length} de ${d.formandos.length} formandos já têm foto`)
      .then(definir('fotos-de-crianca'), console.error);
    buscarDadosComissao(codigo)
      .then((d) => `Álbum ${d.albumAberto ? 'aberto' : 'fechado'} · ${plural(d.mensagens?.length ?? 0, 'mensagem', 'mensagens')}`)
      .then(definir('album'), console.error);
    return () => {
      ativo = false;
    };
  }, [codigo]);

  const partes = [
    { aba: 'votacao', titulo: 'Votação', sobre: 'Criar perguntas, ver quem falta votar, liberar o resultado e o aviso no celular.' },
    { aba: 'mesas', titulo: 'Mesas', sobre: 'Quantas pessoas cada formando leva, os links pessoais e o mapa.' },
    { aba: 'fotos-de-crianca', titulo: 'Fotos de criança', sobre: 'A foto de cada formando, para baixar todas juntas no fim.' },
    { aba: 'album', titulo: 'Álbum e mensagens', sobre: 'Liberar o álbum da festa, moderar as fotos e ler as mensagens.' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--space-5)' }}>
      {partes.map((p) => (
        <Link key={p.aba} to={`/comissao/${p.aba}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card interactive padding="var(--space-6) var(--space-7)" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' }}>
                {p.titulo}
              </span>
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--accent)', minHeight: '1.47em' }}>{resumo[p.aba] ?? ''}</span>
              <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>{p.sobre}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/** The party album (open it, moderate the photos) and the messages sent to the committee. */
function AlbumEMensagens({ codigo }: { codigo: string }) {
  const mobile = useIsMobile();
  const [dados, setDados] = useState<ComissaoData | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [alternandoAlbum, setAlternandoAlbum] = useState(false);
  const [erroAlbum, setErroAlbum] = useState<string | null>(null);
  const [excluindoFotoId, setExcluindoFotoId] = useState<string | null>(null);

  // Defends against a stale Edge Function: git push redeploys the site, but
  // NOT the Supabase Edge Function (that's a separate manual deploy) — if
  // committee-data on Supabase is older than this frontend, its response
  // can be missing a field (e.g. `fotos`) that this page now expects.
  // Falling back to [] / false here means a mismatch renders as "0 fotos"
  // instead of crashing the whole page blank.
  function normalizar(resultado: ComissaoData): ComissaoData {
    return {
      mensagens: resultado.mensagens ?? [],
      albumAberto: resultado.albumAberto ?? false,
      fotos: resultado.fotos ?? [],
    };
  }

  async function carregar() {
    setErroCarregar(null);
    try {
      setDados(normalizar(await buscarDadosComissao(codigo)));
    } catch (e) {
      setErroCarregar(e instanceof Error ? e.message : 'Não foi possível abrir agora.');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alternarAlbum() {
    if (!dados) return;
    setAlternandoAlbum(true);
    setErroAlbum(null);
    try {
      setDados(normalizar(await buscarDadosComissao(codigo, { definirAlbumAberto: !dados.albumAberto })));
    } catch (e) {
      setErroAlbum(e instanceof Error ? e.message : 'Não foi possível mudar o álbum agora.');
    } finally {
      setAlternandoAlbum(false);
    }
  }

  async function excluirFoto(id: string) {
    if (!window.confirm('Excluir essa foto do álbum? Não dá pra desfazer.')) return;
    setExcluindoFotoId(id);
    setErroAlbum(null);
    try {
      setDados(normalizar(await buscarDadosComissao(codigo, { excluirFotoId: id })));
    } catch (e) {
      setErroAlbum(e instanceof Error ? e.message : 'Não foi possível excluir a foto agora.');
    } finally {
      setExcluindoFotoId(null);
    }
  }

  if (!dados) return <CarregandoSecao erro={erroCarregar} onTentar={carregar} />;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <Card padding="var(--space-6)">
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
            <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Álbum da festa</span>
            <span style={{ fontSize: 'var(--fs-body)' }}>
              {dados.albumAberto ? 'Aberto, convidados já podem enviar fotos.' : 'Fechado, ninguém consegue enviar fotos ainda.'}
            </span>
          </div>
          <Button size="lg" variant={dados.albumAberto ? 'secondary' : 'primary'} carregando={alternandoAlbum} onClick={alternarAlbum}>
            {alternandoAlbum ? 'Atualizando…' : dados.albumAberto ? 'Fechar álbum' : 'Liberar álbum'}
          </Button>
        </div>
        {erroAlbum ? (
          <span style={{ display: 'block', marginTop: 'var(--space-3)', fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erroAlbum}</span>
        ) : null}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2,1fr)', gap: 'var(--space-5)' }}>
        <Stat label="Fotos no álbum" value={pad(dados.fotos.length)} accent />
        <Stat label="Mensagens" value={pad(dados.mensagens.length)} />
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-6) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
          <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Fotos do álbum · {dados.fotos.length}</span>
        </div>
        {dados.fotos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 'var(--space-4)', padding: 'var(--space-6) var(--space-7)' }}>
            {dados.fotos.map((f) => (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <img
                  src={urlDaFoto(f.caminho)}
                  alt={f.legenda ?? ''}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke-hair)' }}
                />
                {f.legenda ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>{f.legenda}</span> : null}
                <Button variant="ghost" carregando={excluindoFotoId === f.id} onClick={() => excluirFoto(f.id)} style={{ padding: 0, height: 28, fontSize: 10 }}>
                  {excluindoFotoId === f.id ? 'Excluindo…' : 'Excluir'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-7)' }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Nenhuma foto enviada ainda.</span>
          </div>
        )}
      </Card>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-6) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
          <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Mensagens recebidas</span>
        </div>
        {dados.mensagens.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-5) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'baseline' }}>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{m.nome}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>{new Date(m.criado_em).toLocaleDateString('pt-BR')}</span>
            </div>
            <p style={texto}>{m.mensagem}</p>
          </div>
        ))}
        {dados.mensagens.length === 0 ? (
          <div style={{ padding: 'var(--space-7)' }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Nenhuma mensagem ainda.</span>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card padding="var(--space-6)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, lineHeight: 1, color: accent ? 'var(--accent)' : undefined }}>{value}</span>
      </div>
    </Card>
  );
}
