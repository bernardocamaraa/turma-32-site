import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/SectionHeading';
import { buscarDadosComissao, urlDaFoto, type ComissaoData } from '../lib/supabase';
import { useIsMobile } from '../lib/useViewport';

export function Comissao() {
  const mobile = useIsMobile();
  const [codigo, setCodigo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [dados, setDados] = useState<ComissaoData | null>(null);
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

  async function entrar() {
    setCarregando(true);
    setErroAcesso(null);
    try {
      const resultado = await buscarDadosComissao(codigo.trim());
      setDados(normalizar(resultado));
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
    } finally {
      setCarregando(false);
    }
  }

  async function alternarAlbum() {
    if (!dados) return;
    setAlternandoAlbum(true);
    setErroAlbum(null);
    try {
      const resultado = await buscarDadosComissao(codigo.trim(), { definirAlbumAberto: !dados.albumAberto });
      setDados(normalizar(resultado));
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
      const resultado = await buscarDadosComissao(codigo.trim(), { excluirFotoId: id });
      setDados(normalizar(resultado));
    } catch (e) {
      setErroAlbum(e instanceof Error ? e.message : 'Não foi possível excluir a foto agora.');
    } finally {
      setExcluindoFotoId(null);
    }
  }

  function sair() {
    setDados(null);
    setCodigo('');
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <main
      style={{
        maxWidth: 'var(--maxw-page)',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-7)',
        animation: 'om-fade-up 620ms var(--ease-out) both',
      }}
    >
      <PageHeader eyebrow="Área da comissão" title="Álbum e mensagens" />

      {!dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              Esta área é só da comissão: liberar o álbum da festa, moderar as fotos e ler as
              mensagens recebidas. Digite o código combinado com a turma.
            </p>
            <Input
              label="Código de acesso"
              placeholder="••••••"
              type="password"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setErroAcesso(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && codigo.trim() && !carregando) entrar();
              }}
            />
            {erroAcesso ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--gild-400)' }}>{erroAcesso}</span> : null}
            <div style={{ display: 'flex' }}>
              <Button size="lg" disabled={!codigo.trim() || carregando} onClick={entrar}>
                {carregando ? 'ENTRANDO…' : 'ENTRAR'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                  Álbum da festa
                </span>
                <span style={{ fontSize: 'var(--fs-body)' }}>
                  {dados.albumAberto ? 'Aberto — convidados já podem enviar fotos.' : 'Fechado — ninguém consegue enviar fotos ainda.'}
                </span>
              </div>
              <Button
                size="lg"
                variant={dados.albumAberto ? 'secondary' : 'primary'}
                disabled={alternandoAlbum}
                onClick={alternarAlbum}
              >
                {alternandoAlbum ? 'ATUALIZANDO…' : dados.albumAberto ? 'FECHAR ÁLBUM' : 'LIBERAR ÁLBUM'}
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Fotos do álbum · {dados.fotos.length}
              </span>
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
                    {f.legenda ? (
                      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>{f.legenda}</span>
                    ) : null}
                    <Button variant="ghost" disabled={excluindoFotoId === f.id} onClick={() => excluirFoto(f.id)} style={{ padding: 0, height: 28, fontSize: 10 }}>
                      {excluindoFotoId === f.id ? 'EXCLUINDO…' : 'EXCLUIR'}
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Mensagens recebidas
              </span>
            </div>
            {dados.mensagens.map((m) => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-5) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{m.nome}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
                    {new Date(m.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>{m.mensagem}</p>
              </div>
            ))}
            {dados.mensagens.length === 0 ? (
              <div style={{ padding: 'var(--space-7)' }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Nenhuma mensagem ainda.</span>
              </div>
            ) : null}
          </Card>

          <div style={{ display: 'flex' }}>
            <Button variant="ghost" onClick={sair}>
              SAIR
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card padding="var(--space-6)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, lineHeight: 1, color: accent ? 'var(--accent)' : undefined }}>{value}</span>
      </div>
    </Card>
  );
}
