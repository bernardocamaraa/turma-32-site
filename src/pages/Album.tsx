import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { Input } from '../components/Input';
import { CountdownRow } from '../components/SectionHeading';
import { useReveal } from '../lib/useReveal';
import { useCountdown } from '../lib/countdown';
import { useIsMobile } from '../lib/useViewport';
import { buscarAlbumAberto, buscarFotos, enviarFoto, urlDaFoto, type Foto } from '../lib/supabase';

const POLL_MS = 30000;
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function Album() {
  const countdown = useCountdown();
  const mobile = useIsMobile();
  const [aberto, setAberto] = useState<boolean | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function checar() {
      try {
        const [valorAberto, listaFotos] = await Promise.all([buscarAlbumAberto(), buscarFotos()]);
        if (ativo) {
          setAberto(valorAberto);
          setFotos(listaFotos);
        }
      } catch (e) {
        console.error(e);
        if (ativo) setAberto((atual) => atual ?? false);
      }
    }
    checar();
    // The committee flips this from another device, and other guests upload
    // from theirs — polling is the simplest way for a phone sitting on the
    // album page during the party to pick up either change.
    const id = setInterval(checar, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, []);

  if (aberto === null) {
    return <main style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-9) var(--gutter-page) var(--space-10)' }} />;
  }

  function abrirDialogEnvio() {
    setArquivo(null);
    setLegenda('');
    setErroEnvio(null);
    setEnviado(false);
    setDialogAberto(true);
  }

  function escolherArquivo(lista: FileList | null) {
    const f = lista?.[0] ?? null;
    if (f && f.size > TAMANHO_MAXIMO) {
      setErroEnvio('Essa foto passa de 10MB — tenta uma versão menor.');
      setArquivo(null);
      return;
    }
    setErroEnvio(null);
    setArquivo(f);
  }

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await enviarFoto(arquivo, legenda);
      const listaFotos = await buscarFotos();
      setFotos(listaFotos);
      setEnviado(true);
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : 'Não foi possível enviar a foto agora.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-9) var(--gutter-page) var(--space-10)', animation: 'om-fade-up 620ms var(--ease-out) both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-7)' }}>
        <span
          style={{
            fontFamily: 'var(--font-core)',
            fontSize: 'var(--fs-label)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          Álbum da festa
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'var(--fs-display-3)',
            lineHeight: 'var(--lh-tight)',
            letterSpacing: 'var(--tracking-display)',
          }}
        >
          {aberto ? 'Ao vivo, agora' : 'O álbum abre na noite do baile'}
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '60ch' }}>
          {aberto
            ? 'Quem está na festa envia; todo mundo vê. O álbum fica no ar até o fim da noite.'
            : 'O envio de fotos funciona só durante a festa, e as fotos ficam disponíveis enquanto ela acontece.'}
        </p>
      </div>

      {!aberto ? (
        <Card variant="tagged" padding={0} style={{ overflow: 'hidden' }}>
          <div
            style={{
              background: 'var(--wall-600)',
              backgroundImage: 'url(/assets/wall-texture.png)',
              backgroundSize: '520px',
              animation: 'om-drift 120s linear infinite',
              position: 'relative',
              padding: 'var(--space-10) var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(10,10,12,.9),rgba(10,10,12,.6),rgba(10,10,12,.9))' }} />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 520,
                height: 520,
                margin: '-260px 0 0 -260px',
                pointerEvents: 'none',
                background: 'radial-gradient(circle,rgba(169,211,232,.13),rgba(169,211,232,0) 66%)',
                animation: 'om-sheen 9s ease-in-out infinite',
              }}
            />
            <span style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Falta
            </span>
            <div style={{ position: 'relative' }}>
              <CountdownRow {...countdown} size={48} />
            </div>
            <p style={{ position: 'relative', margin: 0, maxWidth: '44ch', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              A comissão libera o envio de fotos durante a festa. Assim que abrir, o botão de enviar foto aparece aqui e as fotos ficam no ar durante a noite.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Badge tone="accent">AO VIVO NA FESTA</Badge>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                {fotos.length} {fotos.length === 1 ? 'foto enviada' : 'fotos enviadas'}
              </span>
            </div>
            <Button iconLeft={<Icon name="camera" size={18} />} onClick={abrirDialogEnvio}>
              ENVIAR FOTO
            </Button>
          </div>
          {fotos.length === 0 ? (
            <Card padding="var(--space-7)">
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Nenhuma foto ainda — seja o primeiro a enviar!</span>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)' }}>
              {fotos.map((foto, i) => (
                <PhotoTile key={foto.id} foto={foto} delay={Math.min(i, 7) * 60} />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={dialogAberto}
        title={enviado ? 'Foto enviada' : 'Enviar foto'}
        onClose={() => setDialogAberto(false)}
        footer={
          enviado ? (
            <Button onClick={() => setDialogAberto(false)}>FECHAR</Button>
          ) : (
            <Button disabled={!arquivo || enviando} onClick={enviar}>
              {enviando ? 'ENVIANDO…' : 'ENVIAR'}
            </Button>
          )
        }
      >
        {enviado ? (
          'Sua foto já está no álbum da festa. Ela fica no ar até o fim da noite.'
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Sua foto
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => escolherArquivo(e.target.files)}
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-core)', fontSize: 'var(--fs-body-sm)' }}
              />
            </div>
            <Input label="Legenda (opcional)" placeholder="Diz alguma coisa sobre essa foto" value={legenda} onChange={(e) => setLegenda(e.target.value)} />
            {erroEnvio ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erroEnvio}</span> : null}
          </div>
        )}
      </Dialog>
    </main>
  );
}

function PhotoTile({ foto, delay }: { foto: Foto; delay: number }) {
  const reveal = useReveal<HTMLDivElement>(foto.id, delay);
  const hora = new Date(foto.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      ref={reveal.ref}
      className={reveal.className}
      style={{
        ...reveal.style,
        border: '1px solid var(--stroke-hair)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflow: 'hidden',
        transition: 'border-color 120ms var(--ease-out),box-shadow 120ms var(--ease-out),transform 120ms var(--ease-out)',
      }}
    >
      <img src={urlDaFoto(foto.caminho)} alt={foto.legenda ?? ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--wall-600)' }}>
        {foto.legenda ? <span style={{ fontSize: 'var(--fs-body-sm)' }}>{foto.legenda}</span> : null}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--text-faint)', opacity: 0.7 }}>{hora}</span>
      </div>
    </div>
  );
}
