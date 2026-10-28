import { useEffect, useRef, useState } from 'react';
import { Download, ImageOff, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/SectionHeading';
import { lerCodigo, salvarCodigo } from '../lib/codigoComissao';
import {
  buscarInfancia,
  enviarFotoInfancia,
  linkParaBaixar,
  nomeDaFoto,
  problemaNoArquivo,
  zipDasFotos,
  type DadosInfancia,
  type FormandoInfancia,
  type FotoInfancia,
} from '../lib/infancia';

const texto = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const erroStyle = { fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const mensagemDe = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);

// Each call signs every link again, and a new link makes the browser download
// the photo again. The page keeps the first link it got for each photo (they
// last a day) and only takes a new one after half of that.
const GUARDAR_LINK_MS = 12 * 60 * 60 * 1000;

/**
 * The childhood photos (/infancia), committee only: every formando with a
 * space for their photo. The formandos send theirs to the committee on
 * WhatsApp, the committee puts each one under the right name, and in the end
 * everything comes down in one .zip, each photo named after its formando.
 */
export function Infancia() {
  const [codigo, setCodigo] = useState(lerCodigo);
  const [dados, setDados] = useState<DadosInfancia | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [soFaltam, setSoFaltam] = useState(false);
  const [baixando, setBaixando] = useState<{ feitas: number; total: number } | null>(null);
  const [erroBaixar, setErroBaixar] = useState<string | null>(null);
  const links = useRef(new Map<string, { url: string; ate: number }>());

  function guardar(novo: DadosInfancia): DadosInfancia {
    const agora = Date.now();
    return {
      formandos: novo.formandos.map((f) => ({
        ...f,
        fotos: f.fotos.map((foto) => {
          const conhecido = links.current.get(foto.caminho);
          if (conhecido && conhecido.ate > agora) return { ...foto, url: conhecido.url };
          links.current.set(foto.caminho, { url: foto.url, ate: agora + GUARDAR_LINK_MS });
          return foto;
        }),
      })),
    };
  }

  async function entrar() {
    setEntrando(true);
    setErroAcesso(null);
    try {
      setDados(guardar(await buscarInfancia(codigo.trim())));
      salvarCodigo(codigo.trim());
    } catch (e) {
      setErroAcesso(mensagemDe(e, 'Não foi possível entrar agora.'));
      salvarCodigo(null);
    } finally {
      setEntrando(false);
    }
  }

  /** Loads the list again — after an upload, a delete, or with `excluir`, deleting that photo first. Throws on failure. */
  async function recarregar(excluir?: string) {
    setDados(guardar(await buscarInfancia(codigo.trim(), excluir)));
  }

  // With a saved code, straight in.
  useEffect(() => {
    if (codigo) entrar();
  }, []);

  // Other people in the committee add photos from their own phones: catch up
  // when coming back to this tab.
  const pronto = dados !== null;
  useEffect(() => {
    if (!pronto) return;
    function aoVoltar() {
      if (!document.hidden) recarregar().catch(console.error);
    }
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [pronto, codigo]);

  async function baixarTudo() {
    if (!dados) return;
    setErroBaixar(null);
    setBaixando({ feitas: 0, total: 0 });
    try {
      const zip = await zipDasFotos(dados.formandos, (feitas, total) => setBaixando({ feitas, total }));
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fotos-de-crianca-turma-32.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setErroBaixar(mensagemDe(e, 'Não foi possível baixar as fotos agora.'));
    } finally {
      setBaixando(null);
    }
  }

  function sair() {
    salvarCodigo(null);
    setCodigo('');
    setDados(null);
  }

  const total = dados?.formandos.length ?? 0;
  const comFoto = dados?.formandos.filter((f) => f.fotos.length > 0).length ?? 0;
  const totalFotos = dados?.formandos.reduce((soma, f) => soma + f.fotos.length, 0) ?? 0;
  const visiveis = dados?.formandos.filter((f) => !soFaltam || f.fotos.length === 0) ?? [];

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
      <PageHeader eyebrow="Comissão · Turma 32" title="Fotos de criança." />

      {!dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={texto}>
              Esta área é só da comissão: aqui fica a foto de criança de cada formando, para baixar todas juntas
              depois. Digite o código da comissão.
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
            {erroAcesso ? <span style={erroStyle}>{erroAcesso}</span> : null}
            <div style={{ display: 'flex' }}>
              <Button size="lg" disabled={!codigo.trim() || entrando} onClick={entrar}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--fs-h1)',
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: '-.03em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {comFoto}
                    <span style={{ color: 'var(--text-faint)' }}> de {total}</span>
                  </span>
                  <span style={pequeno}>
                    formandos já têm foto · {plural(totalFotos, 'foto', 'fotos')} no total
                  </span>
                </div>
                <Button size="lg" disabled={baixando !== null || totalFotos === 0} onClick={baixarTudo} iconLeft={<Download size={18} aria-hidden />}>
                  {!baixando
                    ? 'Baixar todas (.zip)'
                    : baixando.total > 0 && baixando.feitas < baixando.total
                      ? `Baixando ${baixando.feitas + 1} de ${baixando.total}…`
                      : 'Preparando o .zip…'}
                </Button>
              </div>
              <div
                role="progressbar"
                aria-label="Formandos com foto"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={comFoto}
                style={{ height: 4, borderRadius: 2, background: 'var(--stroke-hair)', overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: total ? `${(comFoto / total) * 100}%` : 0,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width var(--dur-slow) var(--ease-out)',
                  }}
                />
              </div>
              <p style={texto}>
                Recebeu a foto de alguém? Ache o nome e toque em “Adicionar foto”. Quando estiverem todas, baixe tudo
                de uma vez: cada foto vem com o nome do formando.
              </p>
              {erroBaixar ? <span style={erroStyle}>{erroBaixar}</span> : null}
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button size="sm" variant={soFaltam ? 'secondary' : 'primary'} onClick={() => setSoFaltam(false)}>
              Todos · {total}
            </Button>
            <Button size="sm" variant={soFaltam ? 'primary' : 'secondary'} onClick={() => setSoFaltam(true)}>
              Faltam · {total - comFoto}
            </Button>
          </div>

          {visiveis.length === 0 ? (
            <p style={texto}>Todo mundo já tem foto.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-5)' }}>
              {visiveis.map((f) => (
                <CartaoFormando key={f.formando} f={f} codigo={codigo.trim()} recarregar={recarregar} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex' }}>
            <Button variant="ghost" onClick={sair}>
              Sair
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

/** One formando: their photos, and the button to add more. */
function CartaoFormando({
  f,
  codigo,
  recarregar,
}: {
  f: FormandoInfancia;
  codigo: string;
  recarregar: (excluir?: string) => Promise<void>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<{ feitas: number; total: number } | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    // Cleared so picking the same file again still fires onChange.
    if (entrada.current) entrada.current.value = '';
    if (arquivos.length === 0) return;
    const problema = arquivos.map(problemaNoArquivo).find(Boolean);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    let falha: string | null = null;
    for (const [i, arquivo] of arquivos.entries()) {
      setEnviando({ feitas: i, total: arquivos.length });
      try {
        await enviarFotoInfancia(codigo, f.formando, arquivo);
      } catch (e) {
        falha = mensagemDe(e, `Não foi possível enviar "${arquivo.name}" agora.`);
        break;
      }
    }
    // Even after a failure: the photos before it did go up.
    try {
      await recarregar();
    } catch (e) {
      falha ??= mensagemDe(e, 'Não foi possível atualizar a lista agora.');
    }
    setEnviando(null);
    setErro(falha);
  }

  async function excluir(foto: FotoInfancia) {
    if (!window.confirm(`Excluir esta foto de ${f.formando}? Não dá pra desfazer.`)) return;
    setExcluindo(foto.caminho);
    setErro(null);
    try {
      await recarregar(foto.caminho);
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível excluir a foto agora.'));
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <Card padding="var(--space-6)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em', lineHeight: 1.2 }}>
            {f.formando}
          </span>
          {f.fotos.length > 0 ? (
            <Badge tone="ok" style={{ flex: '0 0 auto' }}>
              {plural(f.fotos.length, 'foto', 'fotos')}
            </Badge>
          ) : (
            <Badge style={{ flex: '0 0 auto' }}>Falta</Badge>
          )}
        </div>

        {f.fotos.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            {f.fotos.map((foto, i) => (
              <Miniatura
                key={foto.caminho}
                foto={foto}
                nome={nomeDaFoto(f.formando, f.fotos, i)}
                excluindo={excluindo === foto.caminho}
                onExcluir={() => excluir(foto)}
              />
            ))}
          </div>
        ) : null}

        {erro ? <span style={erroStyle}>{erro}</span> : null}

        <div style={{ display: 'flex', marginTop: 'auto' }}>
          <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={(e) => adicionar(e.target.files)} />
          <Button
            size="sm"
            variant="secondary"
            disabled={enviando !== null}
            onClick={() => entrada.current?.click()}
            iconLeft={enviando ? undefined : <Plus size={16} aria-hidden />}
          >
            {!enviando ? 'Adicionar foto' : enviando.total > 1 ? `Enviando ${enviando.feitas + 1} de ${enviando.total}…` : 'Enviando…'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

const LADO = 96;

const botaoMiniatura = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  color: 'var(--accent)',
  cursor: 'pointer',
} as const;

/** A photo: tap to see it whole, plus download and delete. */
function Miniatura({ foto, nome, excluindo, onExcluir }: { foto: FotoInfancia; nome: string; excluindo: boolean; onExcluir: () => void }) {
  // Browsers other than Safari can't show an iPhone .heic: a plain tile then,
  // and the photo still downloads as it is.
  const [quebrou, setQuebrou] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: LADO, opacity: excluindo ? 0.4 : 1 }}>
      <a href={foto.url} target="_blank" rel="noreferrer" title={nome} style={{ display: 'block' }}>
        {quebrou ? (
          <div
            style={{
              width: LADO,
              height: LADO,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--stroke-hair)',
              background: 'var(--ink-800)',
              color: 'var(--text-faint)',
              fontSize: 'var(--fs-caption)',
            }}
          >
            <ImageOff size={20} aria-hidden />
            {foto.caminho.split('.').pop()?.toUpperCase()}
          </div>
        ) : (
          <img
            src={foto.url}
            alt={nome}
            loading="lazy"
            onError={() => setQuebrou(true)}
            style={{
              width: LADO,
              height: LADO,
              objectFit: 'cover',
              display: 'block',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--stroke-hair)',
              background: 'var(--ink-800)',
            }}
          />
        )}
      </a>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <a href={linkParaBaixar(foto, nome)} aria-label={`Baixar ${nome}`} title="Baixar" style={botaoMiniatura}>
          <Download size={16} aria-hidden />
        </a>
        <button
          type="button"
          aria-label={`Excluir ${nome}`}
          title="Excluir"
          disabled={excluindo}
          onClick={onExcluir}
          style={{ ...botaoMiniatura, color: 'var(--text-faint)', cursor: excluindo ? 'not-allowed' : 'pointer' }}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
