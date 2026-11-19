import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, Download, ImagePlus, Minus, Plus, ShoppingBag, TriangleAlert } from 'lucide-react';
import { AdesivoCrianca, pngDoAdesivo, salvarArquivo } from '../components/AdesivoCrianca';
import { Badge } from '../components/Badge';
import { BotoesLink } from '../components/BotoesLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CarregandoSecao } from '../components/CarregandoSecao';
import { EntrarComWhatsapp } from '../components/EntrarComWhatsapp';
import { Input } from '../components/Input';
import { Popups, usePopup } from '../components/Popups';
import {
  buscarAdesivos,
  chaveDe,
  descreverCores,
  descreverItem,
  enviarImagemAdesivo,
  lerChave,
  MAXIMO_POR_MODELO,
  PIX,
  quantidadeDoPedido,
  reais,
  slugDoNome,
  totalDoPedido,
  urlDaLoja,
  type AcaoAdesivos,
  type AcessoAdesivos,
  type DadosAdesivos,
  type Itens,
  type Modelo,
  type Pedido,
} from '../lib/adesivos';
import { analisarCores, CORES, nomeDaCor, type Camada, type CamadaSugerida } from '../lib/cores';
import { adesivoRedondo } from '../lib/redondo';
import { ADESIVOS_PRONTOS, type AdesivoPronto } from '../lib/adesivosProntos';
import { lerEleitor, salvarEleitor } from '../lib/eleitor';
import { COLUNAS, DIAMETRO, FOLHA, folhasPara, itensDasFolhas, LINHAS, MARGEM, pdfDasFolhas, POR_FOLHA } from '../lib/folhas';
import { useIsMobile } from '../lib/useViewport';

const texto: CSSProperties = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const titulo: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' };
const erroEstilo: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' };
const rotuloSecao: CSSProperties = { fontSize: 14, color: 'var(--text-faint)' };

const primeiroNome = (nome: string) => nome.split(' ')[0];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const mensagemDe = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);

/** The picture of a model: the formando's own sticker for the childhood one, the committee's picture for the rest. */
function ArteDoModelo({ modelo, foto, nome, cores }: { modelo: Modelo; foto: string | null; nome: string; cores?: string[] | null }) {
  if (modelo.crianca) {
    return (
      <div style={{ width: '100%', borderRadius: '50%', boxShadow: '0 18px 40px rgba(0,0,0,.55)' }}>
        <AdesivoCrianca foto={foto} nome={nome} />
      </div>
    );
  }
  if (!modelo.imagem) return null;
  return (
    <div style={{ width: '100%', borderRadius: '50%', boxShadow: '0 18px 40px rgba(0,0,0,.55)' }}>
      <ImagemNaCor
        imagem={modelo.imagem}
        camadas={modelo.camadas}
        cores={cores && modelo.camadas.length ? cores : null}
        alt={cores && modelo.camadas.length ? `${modelo.nome} (${descreverCores(modelo, cores)})` : modelo.nome}
      />
    </div>
  );
}

/**
 * A sticker as it comes out: round, the picture fitted inside the circle on
 * white (lib/redondo.ts), painted with `cores` when given. A plain white
 * circle shows meanwhile.
 */
function ImagemNaCor({ imagem, camadas, cores, alt, style }: { imagem: string; camadas: Camada[]; cores: string[] | null; alt: string; style?: CSSProperties }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    let criado: string | null = null;
    adesivoRedondo(imagem, 600, camadas, cores).then(
      (blob) => {
        if (!ativo) return;
        criado = URL.createObjectURL(blob);
        setUrl(criado);
      },
      console.error,
    );
    return () => {
      ativo = false;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [imagem, JSON.stringify(camadas), cores?.join()]);
  return url ? (
    <img src={url} alt={alt} style={{ display: 'block', width: '100%', aspectRatio: '1', ...style }} />
  ) : (
    <div role="img" aria-label={alt} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', background: '#ffffff', opacity: 0.85, ...style }} />
  );
}

/**
 * /adesivos: the store of the stickers handed out on the night. One link
 * for the whole class, entered with the WhatsApp like the vote and /musica
 * (the same number, remembered on the phone, enters all three). The
 * committee runs it in its "Adesivos" tab, below.
 */
export function Adesivos() {
  return (
    <Popups>
      <Loja />
    </Popups>
  );
}

function Loja() {
  const popup = usePopup();
  const mobile = useIsMobile();
  const [eleitor, setEleitor] = useState(lerEleitor);
  const [dados, setDados] = useState<DadosAdesivos | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [itens, setItens] = useState<Itens>({});
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function comecarDe(d: DadosAdesivos) {
    setItens(d.meu?.itens ?? {});
    setObservacao(d.meu?.observacao ?? '');
  }

  async function carregar(com: AcessoAdesivos): Promise<DadosAdesivos | null> {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const novo = await buscarAdesivos(com);
      setDados(novo);
      comecarDe(novo);
      return novo;
    } catch (e) {
      setErroAcesso(mensagemDe(e, 'Não foi possível entrar agora.'));
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

  async function agir(acao: AcaoAdesivos, aviso: string) {
    if (!eleitor) return;
    setSalvando(true);
    setErro(null);
    try {
      const novo = await buscarAdesivos(eleitor, acao);
      setDados(novo);
      comecarDe(novo);
      popup({ tipo: 'ok', titulo: aviso });
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível salvar agora.'));
    } finally {
      setSalvando(false);
    }
  }

  function sair() {
    salvarEleitor(null);
    setEleitor(null);
    setItens({});
    carregar({});
  }

  const modelos = dados?.modelos ?? [];
  const meu = dados?.meu ?? null;
  const travado = !!dados && (!dados.aberta || !!meu?.pago);
  const quantidade = quantidadeDoPedido(itens);
  const preco = dados?.preco ?? null;
  const mudou =
    JSON.stringify(Object.entries(itens).filter(([, q]) => q > 0).sort()) !== JSON.stringify(Object.entries(meu?.itens ?? {}).sort()) ||
    observacao.trim() !== (meu?.observacao ?? '');

  function mudar(id: string, q: number) {
    setErro(null);
    setItens((atual) => ({ ...atual, [id]: Math.max(0, Math.min(MAXIMO_POR_MODELO, q)) }));
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
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--gild-300)' }}>Turma 32 · Baile de formatura</span>
        <h1 className="titulo-musica">Loja de adesivos.</h1>
        <p style={{ ...texto, maxWidth: '38rem', fontSize: 'var(--fs-lead, 19px)' }}>
          No baile, a turma distribui adesivos. Escolha quais modelos você quer e quantos de cada, inclusive o seu adesivo de criança, feito com a
          sua foto. Todos os adesivos têm 6 cm.
        </p>
      </header>

      {!eleitor || !dados?.voce ? (
        <EntrarComWhatsapp
          livres={dados?.livres ?? []}
          entrando={entrando}
          erro={erroAcesso}
          onEntrar={identificar}
          explicacao="Digite o seu WhatsApp para ver os adesivos (é o mesmo número da votação e da música)."
          botao="Ver os adesivos"
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

          {meu?.pago ? (
            <Aviso tom="ok">Seu pedido já foi pago. Para mudar alguma coisa, fale com a comissão.</Aviso>
          ) : !dados.aberta ? (
            <Aviso tom="gild">A loja já fechou. {meu ? 'Seu pedido está guardado abaixo.' : 'Para pedir agora, fale com a comissão.'}</Aviso>
          ) : null}

          {modelos.length === 0 ? (
            <p style={texto}>A comissão ainda está preparando os adesivos. Volte daqui a pouco!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
              {modelos.map((m) => (
                <CartaoModelo key={m.id} modelo={m} preco={preco} voce={dados.voce!} foto={dados.fotoInfancia} itens={itens} travado={travado} onMudar={mudar} />
              ))}
            </div>
          )}

          <Card padding="var(--space-6) var(--space-7)" accent={quantidade > 0 && mudou}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <ShoppingBag size={20} color="var(--gild-300)" />
                <span style={titulo}>Seu pedido</span>
                {meu ? <Badge tone={meu.pago ? 'ok' : 'gild'}>{meu.pago ? 'Pago' : preco === null ? 'Pedido feito' : 'Esperando pagamento'}</Badge> : null}
              </div>

              {quantidade > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {ordenarItens(itens, modelos).map(([chave, q]) => (
                    <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 'var(--fs-body)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        {(lerChave(chave).cores ?? []).map((c, i) => (
                          <Bolinha key={i} cor={c} tamanho={14} />
                        ))}
                        {descreverItem(chave, q, modelos)}
                      </span>
                      {preco !== null ? <span style={{ color: 'var(--text-muted)' }}>{reais(q * preco)}</span> : null}
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: 'var(--space-3)',
                      marginTop: 'var(--space-2)',
                      borderTop: '1px solid var(--stroke-hair)',
                      fontSize: 'var(--fs-body)',
                      fontWeight: 600,
                    }}
                  >
                    <span>{plural(quantidade, 'adesivo', 'adesivos')}</span>
                    {preco !== null ? <span>{reais(totalDoPedido(itens, preco))}</span> : null}
                  </div>
                </div>
              ) : (
                <p style={texto}>{meu ? 'Você tirou todos os adesivos. Salve para cancelar o pedido.' : 'Escolha a quantidade de cada adesivo acima.'}</p>
              )}

              {!travado ? (
                <Input
                  label="Alguma observação? (opcional)"
                  placeholder="Ex.: metade dos adesivos de criança em tamanho menor"
                  value={observacao}
                  maxLength={500}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              ) : meu?.observacao ? (
                <p style={texto}>Observação: {meu.observacao}</p>
              ) : null}

              {erro ? <span style={erroEstilo}>{erro}</span> : null}

              {!travado ? (
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    size="lg"
                    variant="gild"
                    disabled={!mudou || (!meu && quantidade === 0)}
                    carregando={salvando}
                    iconLeft={<Check size={18} />}
                    onClick={() =>
                      agir({ acao: 'pedir', itens, observacao }, quantidade === 0 ? 'Pedido cancelado' : meu ? 'Pedido atualizado!' : 'Pedido feito!')
                    }
                  >
                    {quantidade === 0 && meu ? 'Cancelar pedido' : meu ? 'Atualizar pedido' : 'Fazer pedido'}
                  </Button>
                  {mudou && meu ? (
                    <Button variant="ghost" onClick={() => dados && comecarDe(dados)}>
                      Desfazer mudanças
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          {meu && !meu.pago && preco !== null ? <Pagamento total={totalDoPedido(meu.itens, preco)} /> : null}
        </>
      )}
    </main>
  );
}

function Aviso({ tom, children }: { tom: 'ok' | 'gild'; children: ReactNode }) {
  return (
    <Card padding="var(--space-5) var(--space-6)" style={{ borderColor: tom === 'ok' ? 'rgba(127,185,138,.45)' : 'rgba(201,169,106,.45)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {tom === 'ok' ? <Check size={20} color="var(--state-ok)" /> : <TriangleAlert size={20} color="var(--gild-300)" />}
        <span style={{ fontSize: 'var(--fs-body)' }}>{children}</span>
      </div>
    </Card>
  );
}

function Pagamento({ total }: { total: number }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(PIX.chave);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie a chave Pix:', PIX.chave);
    }
  }
  return (
    <Card padding="var(--space-6) var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={titulo}>Pagamento</span>
        {PIX.chave ? (
          <>
            <p style={texto}>
              Faça um Pix de <strong style={{ color: 'var(--text-primary)' }}>{reais(total)}</strong> para a chave abaixo
              {PIX.nome ? ` (${PIX.nome})` : ''} e mande o comprovante para a comissão. Quando a comissão confirmar, o pedido aparece aqui como pago.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 'var(--fs-body)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--ink-800)' }}>{PIX.chave}</code>
              <Button variant="secondary" size="sm" onClick={copiar}>
                {copiado ? 'Copiada!' : 'Copiar chave'}
              </Button>
            </div>
          </>
        ) : (
          <p style={texto}>
            O total do seu pedido é <strong style={{ color: 'var(--text-primary)' }}>{reais(total)}</strong>. A comissão vai avisar como pagar; quando ela
            confirmar o pagamento, o pedido aparece aqui como pago.
          </p>
        )}
      </div>
    </Card>
  );
}

/** The order's lines in the store's order (by model, then colour), only those above zero. */
function ordenarItens(itens: Itens, modelos: Modelo[]): [string, number][] {
  const posicao = (chave: string) => {
    const i = modelos.findIndex((m) => m.id === lerChave(chave).id);
    return i < 0 ? modelos.length : i;
  };
  return Object.entries(itens)
    .filter(([, q]) => q > 0)
    .sort(([a], [b]) => posicao(a) - posicao(b) || a.localeCompare(b));
}

/** A round swatch of a colour. */
function Bolinha({ cor, tamanho = 28, marcada, rotulo, onClick }: { cor: string; tamanho?: number; marcada?: boolean; rotulo?: string; onClick?: () => void }) {
  const estilo: CSSProperties = {
    width: tamanho,
    height: tamanho,
    flex: '0 0 auto',
    borderRadius: '50%',
    background: cor,
    border: 'none',
    padding: 0,
    boxShadow: marcada ? '0 0 0 2px var(--ink-850), 0 0 0 4px var(--chalk-050)' : 'inset 0 0 0 1px rgba(255,255,255,.18)',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'box-shadow var(--dur) var(--ease-out)',
  };
  return onClick ? <button type="button" aria-label={rotulo} aria-pressed={marcada} title={rotulo} style={estilo} onClick={onClick} /> : <span aria-hidden style={{ ...estilo, display: 'inline-block' }} />;
}

/** One row of colours to pick for a part of the sticker: its original colour first, the palette, and any other. */
function Paleta({ camada, cor, onCor }: { camada: Camada; cor: string; onCor: (c: string) => void }) {
  // The palette, minus a colour that's practically the original (the 32's black and "Preto").
  const canais = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const perto = (a: string, b: string) => canais(a).reduce((s, v, i) => s + Math.abs(v - canais(b)[i]), 0) < 40;
  const opcoes = [{ nome: 'Original', cor: camada.cor.toLowerCase() }, ...CORES.filter((c) => !perto(c.cor, camada.cor))];
  const outra = !opcoes.some((c) => c.cor === cor);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
        {camada.nome}: <strong style={{ color: 'var(--text-primary)' }}>{nomeDaCor(cor, camada)}</strong>
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {opcoes.map((c) => (
          <Bolinha key={c.cor} cor={c.cor} rotulo={`${camada.nome}: ${c.nome}`} marcada={cor === c.cor} onClick={() => onCor(c.cor)} />
        ))}
        <label
          title="Outra cor"
          style={{
            position: 'relative',
            width: 28,
            height: 28,
            borderRadius: '50%',
            cursor: 'pointer',
            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            boxShadow: outra ? '0 0 0 2px var(--ink-850), 0 0 0 4px var(--chalk-050)' : 'inset 0 0 0 1px rgba(255,255,255,.18)',
          }}
        >
          <input
            type="color"
            aria-label={`${camada.nome}: outra cor`}
            value={cor}
            onChange={(e) => onCor(e.target.value.toLowerCase())}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </label>
      </div>
    </div>
  );
}

/** One model on sale: its art, what it is, the price and how many (of each combination of colours, for a custom-colour one). */
function CartaoModelo({
  modelo,
  preco,
  voce,
  foto,
  itens,
  travado,
  onMudar,
}: {
  modelo: Modelo;
  /** The same for every sticker; null: no price shows. */
  preco: number | null;
  voce: string;
  foto: string | null;
  itens: Itens;
  travado: boolean;
  onMudar: (chave: string, q: number) => void;
}) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const colorido = modelo.camadas.length > 0;
  // The combinations of this model already in the order.
  const combinacoes = Object.entries(itens)
    .filter(([k, q]) => q > 0 && lerChave(k).id === modelo.id && lerChave(k).cores)
    .map(([k, q]) => ({ chave: k, cores: lerChave(k).cores!, q }));
  const [cores, setCores] = useState<string[] | null>(() =>
    colorido ? (combinacoes[0]?.cores ?? modelo.camadas.map((c) => c.cor.toLowerCase())) : null,
  );
  const chave = chaveDe(modelo.id, cores);
  const quantidade = itens[chave] ?? 0;
  const algum = colorido ? combinacoes.length > 0 : quantidade > 0;

  async function baixar() {
    if (!foto) return;
    setBaixando(true);
    setErro(null);
    try {
      salvarArquivo(await pngDoAdesivo(foto, voce), `adesivo-${slugDoNome(voce)}.png`);
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível baixar agora.'));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Card accent={algum} padding={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12%',
          background: 'radial-gradient(circle at 50% 40%, rgba(169,211,232,.12), transparent 65%), var(--ink-800)',
          position: 'relative',
        }}
      >
        {modelo.crianca ? (
          <Badge tone="gild" style={{ position: 'absolute', top: 16, left: 16 }}>
            Só seu
          </Badge>
        ) : colorido ? (
          <Badge tone="ice" style={{ position: 'absolute', top: 16, left: 16 }}>
            Escolha {modelo.camadas.length > 1 ? 'as cores' : 'a cor'}
          </Badge>
        ) : null}
        <ArteDoModelo modelo={modelo} foto={foto} nome={voce} cores={cores} />
      </div>

      <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)' }}>
            <span style={titulo}>{modelo.nome}</span>
            {preco !== null ? <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--gild-300)', whiteSpace: 'nowrap' }}>{reais(preco)}</span> : null}
          </div>
          {modelo.descricao ? <span style={pequeno}>{modelo.descricao}</span> : null}
          {!modelo.ativo ? <span style={{ ...pequeno, color: 'var(--gild-300)' }}>Esse adesivo saiu da loja. Dá para tirar do seu pedido, mas não para pedir mais.</span> : null}
          {modelo.crianca && !foto ? (
            <span style={{ ...pequeno, color: 'var(--gild-300)' }}>
              A comissão ainda não tem a sua foto de criança. Mande para ela no WhatsApp: assim que ela colocar no site, a foto aparece aqui.
            </span>
          ) : null}
        </div>

        {colorido && cores
          ? modelo.camadas.map((camada, i) => (
              <Paleta key={i} camada={camada} cor={cores[i]} onCor={(c) => setCores(cores.map((x, k) => (k === i ? c : x)))} />
            ))
          : null}

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Quantidade
            valor={quantidade}
            travado={travado}
            maximo={modelo.ativo ? MAXIMO_POR_MODELO : quantidade}
            rotulo={cores ? `${modelo.nome} (${descreverCores(modelo, cores)})` : modelo.nome}
            onMudar={(q) => onMudar(chave, q)}
          />
          {modelo.crianca && foto ? (
            <Button variant="ghost" size="sm" carregando={baixando} iconLeft={<Download size={16} />} onClick={baixar}>
              Baixar
            </Button>
          ) : null}
        </div>

        {combinacoes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={pequeno}>No seu pedido (toque para mudar a quantidade):</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {combinacoes.map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  onClick={() => setCores(c.cores)}
                  title={descreverCores(modelo, c.cores)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 30,
                    padding: '0 12px 0 6px',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    cursor: 'pointer',
                    background: c.chave === chave ? 'rgba(245,245,247,.18)' : 'rgba(245,245,247,.08)',
                    color: 'var(--chalk-050)',
                    fontSize: 13,
                  }}
                >
                  {c.cores.map((cor, i) => (
                    <Bolinha key={i} cor={cor} tamanho={18} />
                  ))}
                  <span style={{ marginLeft: 2 }}>× {c.q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {erro ? <span style={erroEstilo}>{erro}</span> : null}
      </div>
    </Card>
  );
}

/** − 3 + */
function Quantidade({
  valor,
  travado,
  maximo,
  rotulo,
  onMudar,
}: {
  valor: number;
  travado: boolean;
  maximo: number;
  rotulo: string;
  onMudar: (q: number) => void;
}) {
  const botao = (desativado: boolean): CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: desativado ? 'rgba(245,245,247,.05)' : 'rgba(245,245,247,.12)',
    color: desativado ? 'var(--text-faint)' : 'var(--chalk-050)',
    cursor: desativado ? 'default' : 'pointer',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <button type="button" aria-label={`Menos ${rotulo}`} disabled={travado || valor === 0} style={botao(travado || valor === 0)} onClick={() => onMudar(valor - 1)}>
        <Minus size={18} />
      </button>
      <input
        aria-label={`Quantidade de ${rotulo}`}
        inputMode="numeric"
        value={valor}
        disabled={travado}
        onChange={(e) => onMudar(Math.min(maximo, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))}
        onFocus={(e) => e.target.select()}
        style={{
          width: 52,
          height: 40,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--chalk-050)',
          background: 'transparent',
          border: '1px solid var(--stroke-hair)',
          borderRadius: 'var(--radius-sm)',
        }}
      />
      <button type="button" aria-label={`Mais ${rotulo}`} disabled={travado || valor >= maximo} style={botao(travado || valor >= maximo)} onClick={() => onMudar(valor + 1)}>
        <Plus size={18} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Committee tab
// ---------------------------------------------------------------------------

/**
 * The committee's tab: the stickers on sale (add, change, reorder, hide or
 * delete), open or close the store, every order (mark it paid, delete it),
 * the total of each model for the print shop, and every formando's
 * childhood sticker ready to download.
 */
export function AdesivosComissao({ codigo }: { codigo: string }) {
  const mobile = useIsMobile();
  const [dados, setDados] = useState<DadosAdesivos | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setErroCarregar(null);
    try {
      setDados(await buscarAdesivos({ codigo }));
    } catch (e) {
      setErroCarregar(mensagemDe(e, 'Não foi possível abrir agora.'));
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  /** Runs an action; whether it worked (the error shows at the top otherwise). */
  async function agir(acao: AcaoAdesivos, chave: string): Promise<boolean> {
    setSalvando(chave);
    setErro(null);
    try {
      setDados(await buscarAdesivos({ codigo }, acao));
      return true;
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível salvar agora.'));
      return false;
    } finally {
      setSalvando(null);
    }
  }

  if (!dados) return <CarregandoSecao erro={erroCarregar} onTentar={carregar} />;

  const modelos = dados.modelos;
  const pedidos = dados.pedidos ?? [];
  const feitos = new Set(pedidos.map((p) => p.formando));
  const faltam = (dados.formandos ?? []).filter((f) => !feitos.has(f));
  const preco = dados.preco;
  const total = preco === null ? null : pedidos.reduce((s, p) => s + totalDoPedido(p.itens, preco), 0);
  const recebido = preco === null ? null : pedidos.filter((p) => p.pago).reduce((s, p) => s + totalDoPedido(p.itens, preco), 0);
  // For the print shop: one line per model, and per colour for a custom-colour one.
  const somados: Itens = {};
  for (const p of pedidos) for (const [k, q] of Object.entries(p.itens)) somados[k] = (somados[k] ?? 0) + q;
  const linhasGrafica = ordenarItens(somados, modelos).concat(
    modelos.filter((m) => m.camadas.length === 0 && !somados[m.id]).map((m): [string, number] => [m.id, 0]),
  );
  const totalAdesivos = Object.values(somados).reduce((s, q) => s + q, 0);

  function baixarPlanilha() {
    const colunas = linhasGrafica.map(([k]) => k);
    const cabecalho = ['Formando', ...colunas.map((k) => descreverItem(k, 1, modelos).replace(/^1× /, '')), 'Adesivos', ...(preco !== null ? ['Total (R$)'] : []), 'Pago', 'Observação'];
    const linhas = pedidos.map((p) => [
      p.formando,
      ...colunas.map((k) => String(p.itens[k] ?? 0)),
      String(quantidadeDoPedido(p.itens)),
      ...(preco !== null ? [totalDoPedido(p.itens, preco).toFixed(2).replace('.', ',')] : []),
      p.pago ? 'Sim' : 'Não',
      p.observacao ?? '',
    ]);
    const csv = [cabecalho, ...linhas].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    salvarArquivo(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'pedidos-adesivos.csv');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <Card padding="var(--space-6)">
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
              <span style={rotuloSecao}>Loja de adesivos</span>
              <span style={{ fontSize: 'var(--fs-body)' }}>
                {dados.aberta ? 'Aberta, a turma pode pedir e mudar o pedido.' : 'Fechada, ninguém consegue pedir ou mudar o pedido.'}
              </span>
            </div>
            <Button size="lg" variant={dados.aberta ? 'secondary' : 'primary'} carregando={salvando === 'aberta'} onClick={() => agir({ acao: 'aberta', sim: !dados.aberta }, 'aberta')}>
              {dados.aberta ? 'Fechar loja' : 'Abrir loja'}
            </Button>
          </div>
          <PrecoUnico preco={dados.preco} salvando={salvando === 'preco'} onSalvar={(valor) => agir({ acao: 'preco', valor }, 'preco')} />
          <BotoesLink url={urlDaLoja()} mensagem="A loja de adesivos da formatura está aberta! Escolha os seus, inclusive o seu adesivo de criança:" />
        </div>
      </Card>

      {erro ? (
        <Card padding="var(--space-5) var(--space-6)" style={{ borderColor: 'rgba(255,105,97,.45)' }}>
          <span style={erroEstilo}>{erro}</span>
        </Card>
      ) : null}

      <ModelosDaComissao codigo={codigo} modelos={modelos} salvando={salvando} agir={agir} />

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 'var(--space-5)' }}>
        <Numero rotulo="Pedidos" valor={`${pedidos.length}/${dados.formandos?.length ?? 0}`} />
        <Numero rotulo="Adesivos" valor={String(totalAdesivos)} />
        <Numero rotulo="Total" valor={total === null ? 'Sem preço' : reais(total)} />
        <Numero rotulo="Já pago" valor={recebido === null ? '—' : reais(recebido)} destaque={recebido !== null} />
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: 'var(--space-6) var(--space-7)',
            borderBottom: '1px solid var(--stroke-hair)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          <span style={rotuloSecao}>Para a gráfica: quantos de cada modelo</span>
          <Button variant="secondary" size="sm" disabled={pedidos.length === 0} onClick={baixarPlanilha}>
            Baixar planilha
          </Button>
        </div>
        {linhasGrafica.map(([chave, quantidade]) => (
          <LinhaGrafica key={chave} chave={chave} quantidade={quantidade} modelos={modelos} />
        ))}
      </Card>

      <FolhasDaGrafica pedidos={pedidos} modelos={modelos} fotos={dados.fotos ?? {}} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={titulo}>Pedidos · {pedidos.length}</span>
        {pedidos.length === 0 ? <p style={texto}>Ninguém pediu ainda.</p> : null}
        {pedidos.map((p) => (
          <PedidoDaComissao
            key={p.formando}
            pedido={p}
            modelos={modelos}
            preco={preco}
            salvando={salvando}
            onPago={(sim) => agir({ acao: 'pago', formando: p.formando, sim }, `pago-${p.formando}`)}
            onApagar={() => {
              if (window.confirm(`Apagar o pedido de ${p.formando}? Não dá pra desfazer.`)) agir({ acao: 'apagar', formando: p.formando }, `apagar-${p.formando}`);
            }}
          />
        ))}
        {faltam.length > 0 ? <p style={pequeno}>Ainda não pediram ({faltam.length}): {faltam.join(', ')}.</p> : null}
      </div>

      <AdesivosDeCrianca formandos={dados.formandos ?? []} fotos={dados.fotos ?? {}} pedidos={pedidos} modelos={modelos} />
    </div>
  );
}

/** The print-shop PDF: every sticker ordered, 6 cm, on 33 × 46 cm sheets with a 3 cm margin. */
function FolhasDaGrafica({ pedidos, modelos, fotos }: { pedidos: Pedido[]; modelos: Modelo[]; fotos: Record<string, string> }) {
  const [linhaDeCorte, setLinhaDeCorte] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { itens, semFoto } = itensDasFolhas(pedidos, modelos, fotos);
  const adesivos = itens.reduce((s, i) => s + i.quantidade, 0);
  const folhas = folhasPara(adesivos);

  async function gerar() {
    setErro(null);
    setGerando('Começando…');
    try {
      salvarArquivo(await pdfDasFolhas(itens, { linhaDeCorte, aoAvancar: setGerando }), 'adesivos-turma-32-folhas.pdf');
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível gerar as folhas agora.'));
    } finally {
      setGerando(null);
    }
  }

  return (
    <Card padding="var(--space-6) var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={rotuloSecao}>Arquivo para a gráfica</span>
        <span style={{ fontSize: 'var(--fs-body)' }}>
          {adesivos === 0
            ? 'Nenhum adesivo pedido ainda.'
            : `${plural(adesivos, 'adesivo', 'adesivos')} em ${plural(folhas, 'folha', 'folhas')} de ${FOLHA.largura / 10} × ${FOLHA.altura / 10} cm.`}
        </span>
        <span style={pequeno}>
          Cada adesivo com {DIAMETRO / 10} cm, margem de {MARGEM / 10} cm em volta da folha, {COLUNAS} × {LINHAS} = {POR_FOLHA} adesivos por folha. Um PDF no
          tamanho real, uma página por folha. Todos redondos: uma arte que não é redonda (como o 32) vai encaixada inteira dentro do círculo, sobre branco, com uma folga para o corte.
        </span>
        {semFoto.length > 0 ? (
          <span style={{ ...pequeno, color: 'var(--gild-300)' }}>
            Fora do arquivo, porque ainda não têm foto de criança no site: {semFoto.join(', ')}.
          </span>
        ) : null}
        <label style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', cursor: 'pointer', fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={linhaDeCorte} onChange={(e) => setLinhaDeCorte(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--gild-400)' }} />
          Desenhar a linha de corte (um círculo fino de {DIAMETRO / 10} cm em volta de cada adesivo)
        </label>
        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        <div>
          <Button variant="gild" disabled={adesivos === 0} carregando={!!gerando} iconLeft={<Download size={16} />} onClick={gerar}>
            {gerando ?? 'Baixar folhas (PDF)'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** One line of the print-shop list; a coloured one can be downloaded in its colour. */
function LinhaGrafica({ chave, quantidade, modelos }: { chave: string; quantidade: number; modelos: Modelo[] }) {
  const { id, cores } = lerChave(chave);
  const modelo = modelos.find((m) => m.id === id);
  const [baixando, setBaixando] = useState(false);
  async function baixar() {
    if (!modelo?.imagem || !cores) return;
    setBaixando(true);
    try {
      salvarArquivo(await adesivoRedondo(modelo.imagem, 709, modelo.camadas, cores), `${slugDoNome(modelo.nome)}-${slugDoNome(cores.map((c) => nomeDaCor(c)).join('-'))}.png`);
    } catch (e) {
      window.alert(mensagemDe(e, 'Não foi possível baixar agora.'));
    } finally {
      setBaixando(false);
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-7)',
        borderBottom: '1px solid var(--stroke-hair)',
        fontSize: 'var(--fs-body)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {(cores ?? []).map((c, i) => (
          <Bolinha key={i} cor={c} tamanho={16} />
        ))}
        {descreverItem(chave, 1, modelos).replace(/^1× /, '')}
        {cores && modelo?.imagem ? (
          <Button variant="ghost" size="sm" style={{ height: 26 }} carregando={baixando} iconLeft={<Download size={14} />} onClick={baixar}>
            Arquivo nessa cor
          </Button>
        ) : null}
      </span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{quantidade}</span>
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <Card padding="var(--space-5) var(--space-6)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={rotuloSecao}>{rotulo}</span>
        <span style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, lineHeight: 1.1, color: destaque ? 'var(--state-ok)' : undefined }}>{valor}</span>
      </div>
    </Card>
  );
}

/** The one price of every sticker: empty while it isn't decided (then no price shows anywhere on the site). */
function PrecoUnico({ preco, salvando, onSalvar }: { preco: number | null; salvando: boolean; onSalvar: (valor: number | null) => Promise<boolean> }) {
  const [texto, setTexto] = useState(preco === null ? '' : preco.toFixed(2).replace('.', ','));
  const [erro, setErro] = useState<string | null>(null);
  const lido = texto.trim() ? lerPreco(texto) : null;
  const mudou = (texto.trim() ? lido : null) !== preco;

  async function salvar() {
    if (texto.trim() && lido === null) return setErro('Digite o preço, por exemplo 5,00 (ou deixe vazio para ficar sem preço).');
    setErro(null);
    await onSalvar(lido);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--stroke-hair)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Input
          label="Preço de cada adesivo (o mesmo para todos)"
          placeholder="Sem preço por enquanto"
          inputMode="decimal"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setErro(null);
          }}
          style={{ flex: '1 1 240px', maxWidth: 360 }}
        />
        <Button variant="secondary" disabled={!mudou} carregando={salvando} onClick={salvar}>
          Salvar preço
        </Button>
      </div>
      <span style={erro ? erroEstilo : pequeno}>
        {erro ??
          (preco === null
            ? 'Sem preço: a loja não mostra valor nenhum, nem nos adesivos nem no pedido. Os pedidos continuam funcionando.'
            : `Cada adesivo custa ${reais(preco)}. Para tirar o preço, apague o valor e salve.`)}
      </span>
    </div>
  );
}

/** "5,50" / "5.5" / "R$ 5" → 5.5, or null. */
function lerPreco(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, '').replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n < 10000 ? Math.round(n * 100) / 100 : null;
}

/** The stickers on sale: the list, and the form to add or change one. */
function ModelosDaComissao({
  codigo,
  modelos,
  salvando,
  agir,
}: {
  codigo: string;
  modelos: Modelo[];
  salvando: string | null;
  agir: (acao: AcaoAdesivos, chave: string) => Promise<boolean>;
}) {
  const mobile = useIsMobile();
  // 'novo', a model's id, or null (form closed).
  const [editando, setEditando] = useState<string | null>(null);
  // A ready-made model being added (the form opens filled in with it).
  const [pronto, setPronto] = useState<{ arquivo: File; nome: string; descricao: string } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erroPronto, setErroPronto] = useState<string | null>(null);
  const jaNaLoja = new Set(modelos.map((m) => m.nome.trim().toLowerCase()));

  async function usarPronto(p: AdesivoPronto) {
    setAbrindo(p.id);
    setErroPronto(null);
    try {
      const resposta = await fetch(p.imagem);
      if (!resposta.ok) throw new Error();
      const arquivo = new File([await resposta.blob()], `${p.id}.png`, { type: 'image/png' });
      setPronto({ arquivo, nome: p.nome, descricao: p.descricao });
      setEditando('novo');
    } catch {
      setErroPronto('Não foi possível abrir esse modelo agora. Tente de novo.');
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <span style={titulo}>Adesivos à venda · {modelos.filter((m) => m.ativo).length}</span>
        {editando !== 'novo' ? (
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus size={16} />}
            onClick={() => {
              setPronto(null);
              setEditando('novo');
            }}
          >
            Adicionar adesivo
          </Button>
        ) : null}
      </div>

      {editando === 'novo' ? (
        <FormModelo
          key={pronto?.nome ?? 'novo'}
          codigo={codigo}
          inicial={pronto ?? undefined}
          salvando={salvando === 'modelo-novo'}
          onCancelar={() => {
            setEditando(null);
            setPronto(null);
          }}
          onSalvar={async (m) => {
            if (await agir({ acao: 'salvarModelo', modelo: m }, 'modelo-novo')) {
              setEditando(null);
              setPronto(null);
            }
          }}
        />
      ) : null}


      <Card padding="var(--space-5) var(--space-6)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ ...titulo, fontSize: 'var(--fs-body)' }}>Modelos prontos</span>
            <span style={pequeno}>
              Adesivos feitos para a turma, com o 32, o Terceirão e as assinaturas. Toque em um para colocar na loja: dá para mudar o nome antes, e o
              site já sugere as cores que a turma pode escolher.
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(7, 1fr)', gap: 'var(--space-4)' }}>
            {ADESIVOS_PRONTOS.map((p) => {
              const na = jaNaLoja.has(p.nome.trim().toLowerCase());
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={na || !!abrindo}
                  onClick={() => usarPronto(p)}
                  title={na ? `${p.nome}: já está na loja` : `Colocar "${p.nome}" na loja`}
                  aria-label={na ? `${p.nome}: já está na loja` : `Colocar "${p.nome}" na loja`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--stroke-hair)',
                    background: 'var(--ink-800)',
                    color: 'var(--chalk-050)',
                    cursor: na ? 'default' : 'pointer',
                    opacity: na ? 0.45 : abrindo && abrindo !== p.id ? 0.6 : 1,
                    minHeight: 44,
                  }}
                >
                  <img src={p.imagem} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, textAlign: 'center' }}>{p.nome}</span>
                  <span style={{ fontSize: 11, color: na ? 'var(--text-faint)' : 'var(--accent)' }}>
                    {na ? 'Na loja' : abrindo === p.id ? 'Abrindo…' : 'Adicionar'}
                  </span>
                </button>
              );
            })}
          </div>
          {erroPronto ? <span style={erroEstilo}>{erroPronto}</span> : null}
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
        {modelos.map((m, i) =>
          editando === m.id ? (
            <div key={m.id} style={{ gridColumn: '1 / -1' }}>
              <FormModelo
                codigo={codigo}
                modelo={m}
                salvando={salvando === `modelo-${m.id}`}
                onCancelar={() => setEditando(null)}
                onSalvar={async (novo) => {
                  if (await agir({ acao: 'salvarModelo', modelo: { ...novo, id: m.id } }, `modelo-${m.id}`)) setEditando(null);
                }}
              />
            </div>
          ) : (
            <Card key={m.id} padding="var(--space-4) var(--space-5)" style={{ opacity: m.ativo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.crianca ? (
                    <AdesivoCrianca foto={null} nome="" />
                  ) : m.imagem ? (
                    <ImagemNaCor imagem={m.imagem} camadas={m.camadas} cores={null} alt="" />
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{m.nome}</span>
                    {!m.ativo ? <Badge>Escondido</Badge> : null}
                    {m.camadas.length ? <Badge tone="ice">Cor personalizada</Badge> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 4 }}>
                    <Button variant="ghost" size="sm" style={{ padding: 0, height: 26 }} onClick={() => setEditando(m.id)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ padding: 0, height: 26 }}
                      carregando={salvando === `ativo-${m.id}`}
                      onClick={() =>
                        agir(
                          { acao: 'salvarModelo', modelo: { id: m.id, nome: m.nome, descricao: m.descricao ?? '', ativo: !m.ativo, camadas: m.camadas } },
                          `ativo-${m.id}`,
                        )
                      }
                    >
                      {m.ativo ? 'Esconder' : 'Mostrar'}
                    </Button>
                    {!m.crianca ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ padding: 0, height: 26, color: 'var(--state-error)' }}
                        carregando={salvando === `apagar-modelo-${m.id}`}
                        onClick={() => {
                          if (window.confirm(`Apagar o adesivo "${m.nome}"?`)) agir({ acao: 'apagarModelo', id: m.id }, `apagar-modelo-${m.id}`);
                        }}
                      >
                        Apagar
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <BotaoSeta rotulo={`Subir ${m.nome}`} desativado={i === 0 || !!salvando} onClick={() => agir({ acao: 'moverModelo', id: m.id, direcao: -1 }, `mover-${m.id}`)}>
                    <ArrowUp size={16} />
                  </BotaoSeta>
                  <BotaoSeta
                    rotulo={`Descer ${m.nome}`}
                    desativado={i === modelos.length - 1 || !!salvando}
                    onClick={() => agir({ acao: 'moverModelo', id: m.id, direcao: 1 }, `mover-${m.id}`)}
                  >
                    <ArrowDown size={16} />
                  </BotaoSeta>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}

function BotaoSeta({ rotulo, desativado, onClick, children }: { rotulo: string; desativado: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desativado}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(245,245,247,.1)',
        color: desativado ? 'var(--text-faint)' : 'var(--chalk-050)',
        cursor: desativado ? 'default' : 'pointer',
        opacity: desativado ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** The same part in two lists (a saved one and one found again): same kind, and for a colour, overlapping hues. */
function mesmaCamada(a: Camada, b: Camada): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo !== 'matiz') return true;
  const meio = (c: Camada) => (c.h0! <= c.h1! ? (c.h0! + c.h1!) / 2 : ((c.h0! + c.h1! + 360) / 2) % 360);
  const d = Math.abs(meio(a) - meio(b));
  return Math.min(d, 360 - d) < 30;
}

type CamadaNoForm = CamadaSugerida & { marcada: boolean };

/** Sample colours to show what the chosen parts look like changed. */
const AMOSTRAS = [
  ['#e0262b', '#111111', '#ffffff'],
  ['#22b05a', '#2f6fd6', '#ffffff'],
  ['#ff5fa2', '#8a4fe0', '#ffffff'],
  ['#ffd21f', '#e0262b', '#111111'],
];

/**
 * Adds a sticker (picture, name, description, price) or changes one. As
 * soon as the picture is in, the site looks at its colours and suggests
 * which parts the class could pick the colour of — ticked when it looks
 * good, with a preview; the committee decides.
 */
function FormModelo({
  codigo,
  modelo,
  inicial,
  salvando,
  onCancelar,
  onSalvar,
}: {
  codigo: string;
  modelo?: Modelo;
  /** A ready-made model: the form starts filled in with it. */
  inicial?: { arquivo: File; nome: string; descricao: string };
  salvando: boolean;
  onCancelar: () => void;
  onSalvar: (m: { nome: string; descricao: string; ativo: boolean; camadas: Camada[]; imagem?: string }) => Promise<void>;
}) {
  const mobile = useIsMobile();
  const entrada = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(modelo?.nome ?? inicial?.nome ?? '');
  const [descricao, setDescricao] = useState(modelo?.descricao ?? inicial?.descricao ?? '');
  const [arquivo, setArquivo] = useState<File | null>(inicial?.arquivo ?? null);
  const [previa, setPrevia] = useState<string | null>(modelo?.imagem ?? null);
  const [analisando, setAnalisando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const [camadas, setCamadas] = useState<CamadaNoForm[]>(() =>
    (modelo?.camadas ?? []).map((c) => ({ ...c, parte: 0, sugerida: true, motivo: '', marcada: true })),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!arquivo) return;
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  // A new picture (or the saved one, when editing): look at its colours.
  useEffect(() => {
    if (!previa || modelo?.crianca) return;
    let ativo = true;
    setAnalisando(true);
    analisarCores(previa)
      .then((a) => {
        if (!ativo) return;
        setResumo(a.resumo);
        // Editing with the same picture: what was saved stays ticked (and named); a new picture starts from the suggestion.
        const salvas = !arquivo ? (modelo?.camadas ?? []) : [];
        setCamadas(
          a.camadas.map((c) => {
            const salva = salvas.find((s) => mesmaCamada(s, c));
            return salva ? { ...c, nome: salva.nome, marcada: true } : { ...c, marcada: !modelo || arquivo ? c.sugerida : false };
          }),
        );
      })
      .catch((e) => ativo && setResumo(mensagemDe(e, 'Não foi possível analisar as cores da imagem.')))
      .finally(() => ativo && setAnalisando(false));
    return () => {
      ativo = false;
    };
  }, [previa]);

  const escolhidas = camadas.filter((c) => c.marcada);
  const paraSalvar: Camada[] = escolhidas.map(({ tipo, nome, cor, h0, h1 }) => (tipo === 'matiz' ? { tipo, nome: nome.trim(), cor, h0, h1 } : { tipo, nome: nome.trim(), cor }));

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome ao adesivo.');
    if (!modelo?.crianca && !arquivo && !modelo?.imagem) return setErro('Escolha a imagem do adesivo.');
    if (paraSalvar.some((c) => !c.nome)) return setErro('Dê um nome a cada parte que muda de cor.');
    setErro(null);
    setEnviando(true);
    try {
      const imagem = arquivo ? await enviarImagemAdesivo(codigo, arquivo) : undefined;
      await onSalvar({ nome: nome.trim(), descricao: descricao.trim(), ativo: modelo?.ativo ?? true, camadas: modelo?.crianca ? [] : paraSalvar, imagem });
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível salvar agora.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card accent padding="var(--space-6)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexDirection: mobile ? 'column' : 'row' }}>
          {modelo?.crianca ? (
            <div style={{ width: mobile ? '60%' : 200, flex: '0 0 auto', alignSelf: mobile ? 'center' : 'flex-start' }}>
              <AdesivoCrianca foto={null} nome="" />
              <p style={{ ...pequeno, marginTop: 'var(--space-3)', textAlign: 'center' }}>Cada formando vê o seu, com a foto de criança dele.</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              style={{
                width: mobile ? '100%' : 200,
                aspectRatio: '1',
                flex: '0 0 auto',
                alignSelf: 'flex-start',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--stroke-muted)',
                background: 'var(--ink-800)',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                cursor: 'pointer',
                padding: 'var(--space-4)',
              }}
            >
              {previa ? (
                <ImagemNaCor imagem={previa} camadas={[]} cores={null} alt="" />
              ) : (
                <>
                  <ImagePlus size={32} />
                  <span style={{ fontSize: 'var(--fs-body-sm)' }}>Escolher imagem</span>
                </>
              )}
            </button>
          )}
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setArquivo(f);
              e.target.value = '';
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
            <Input label="Nome" placeholder="Ex.: Logo da Turma 32" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
            <Input label="Descrição (opcional)" placeholder="Ex.: recortado no formato do 32" value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} />
            {!modelo?.crianca && previa ? (
              <div>
                <Button variant="ghost" size="sm" style={{ padding: 0 }} onClick={() => entrada.current?.click()}>
                  Trocar imagem
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {!modelo?.crianca && previa ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--ink-800)' }}>
            <span style={{ ...titulo, fontSize: 'var(--fs-body)' }}>Cores que a turma pode escolher</span>
            {analisando ? <span style={pequeno}>Analisando as cores da imagem…</span> : resumo ? <p style={{ ...texto, fontSize: 'var(--fs-body-sm)' }}>{resumo}</p> : null}
            {camadas.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  aria-label={`Deixar escolher a cor: ${c.nome}`}
                  checked={c.marcada}
                  onChange={(e) => setCamadas(camadas.map((x, k) => (k === i ? { ...x, marcada: e.target.checked } : x)))}
                  style={{ width: 20, height: 20, marginTop: 10, accentColor: 'var(--gild-400)', flex: '0 0 auto' }}
                />
                <Bolinha cor={c.cor} tamanho={24} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      aria-label="Nome da parte"
                      value={c.nome}
                      maxLength={30}
                      onChange={(e) => setCamadas(camadas.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))}
                      style={{
                        height: 36,
                        padding: '0 12px',
                        fontSize: 'var(--fs-body)',
                        color: 'var(--chalk-050)',
                        background: 'var(--ink-850)',
                        border: '1px solid var(--stroke-hair)',
                        borderRadius: 'var(--radius-sm)',
                        minWidth: 0,
                        width: 220,
                      }}
                    />
                    {c.sugerida && c.parte > 0 ? <Badge tone="gild">Sugerido</Badge> : null}
                  </div>
                  {c.motivo ? <span style={pequeno}>{c.motivo}</span> : null}
                </div>
              </div>
            ))}
            {escolhidas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <span style={pequeno}>Assim fica com algumas cores (o nome de cada parte é o que a turma vê na loja):</span>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {AMOSTRAS.map((amostra, k) => (
                    <div key={k} style={{ width: 84, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImagemNaCor
                        imagem={previa}
                        camadas={paraSalvar}
                        cores={paraSalvar.map((c, n) => (c.tipo === 'claro' ? amostra[2] : amostra[n % 2]))}
                        alt=""
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {erro ? <span style={erroEstilo}>{erro}</span> : null}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="gild" carregando={enviando || salvando} onClick={salvar}>
            {modelo ? 'Salvar' : 'Adicionar à loja'}
          </Button>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PedidoDaComissao({
  pedido,
  modelos,
  preco,
  salvando,
  onPago,
  onApagar,
}: {
  pedido: Pedido;
  modelos: Modelo[];
  preco: number | null;
  salvando: string | null;
  onPago: (sim: boolean) => void;
  onApagar: () => void;
}) {
  const mobile = useIsMobile();
  return (
    <Card padding="var(--space-5) var(--space-6)">
      <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: mobile ? 'stretch' : 'center', flexDirection: mobile ? 'column' : 'row' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{pedido.formando}</span>
            <Badge tone={pedido.pago ? 'ok' : 'gild'}>{pedido.pago ? 'Pago' : 'Não pago'}</Badge>
          </div>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
            {ordenarItens(pedido.itens, modelos)
              .map(([chave, q]) => descreverItem(chave, q, modelos))
              .join(' · ')}{' '}
            ·{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {preco !== null ? reais(totalDoPedido(pedido.itens, preco)) : plural(quantidadeDoPedido(pedido.itens), 'adesivo', 'adesivos')}
            </strong>
          </span>
          {pedido.observacao ? <span style={pequeno}>“{pedido.observacao}”</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant={pedido.pago ? 'secondary' : 'primary'} size="sm" carregando={salvando === `pago-${pedido.formando}`} onClick={() => onPago(!pedido.pago)}>
            {pedido.pago ? 'Desmarcar pago' : 'Marcar pago'}
          </Button>
          <Button variant="ghost" size="sm" carregando={salvando === `apagar-${pedido.formando}`} onClick={onApagar}>
            Apagar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Every formando's childhood sticker, made from their photo in the frame:
 * to check them, and download one or all (a .zip) for the print shop.
 */
function AdesivosDeCrianca({ formandos, fotos, pedidos, modelos }: { formandos: string[]; fotos: Record<string, string>; pedidos: Pedido[]; modelos: Modelo[] }) {
  const mobile = useIsMobile();
  const [baixando, setBaixando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const crianca = modelos.find((m) => m.crianca);
  const pediram = new Map(pedidos.map((p) => [p.formando, crianca ? (p.itens[crianca.id] ?? 0) : 0]));
  const comFoto = formandos.filter((f) => fotos[f]);
  const semFoto = formandos.filter((f) => !fotos[f]);

  async function baixar(formando: string) {
    setBaixando(formando);
    setErro(null);
    try {
      salvarArquivo(await pngDoAdesivo(fotos[formando], formando), `adesivo-${slugDoNome(formando)}.png`);
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível baixar agora.'));
    } finally {
      setBaixando(null);
    }
  }

  async function baixarTodos(quem: string[]) {
    setBaixando('todos');
    setErro(null);
    try {
      const { zipSync } = await import('fflate');
      const arquivos: Record<string, Uint8Array> = {};
      for (const [i, f] of quem.entries()) {
        setProgresso(`${i + 1} de ${quem.length}`);
        const png = await pngDoAdesivo(fotos[f], f);
        const qtd = pediram.get(f) ?? 0;
        arquivos[`${qtd > 0 ? `${qtd}x ` : ''}${f}.png`] = new Uint8Array(await png.arrayBuffer());
      }
      salvarArquivo(new Blob([zipSync(arquivos, { level: 0 }) as BlobPart], { type: 'application/zip' }), 'adesivos-de-crianca.zip');
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível baixar agora.'));
    } finally {
      setBaixando(null);
      setProgresso(null);
    }
  }

  const quemPediu = comFoto.filter((f) => (pediram.get(f) ?? 0) > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <span style={titulo}>Adesivos de criança · {comFoto.length}</span>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" disabled={quemPediu.length === 0 || !!baixando} carregando={baixando === 'todos'} onClick={() => baixarTodos(quemPediu)}>
            {baixando === 'todos' && progresso ? `Montando ${progresso}…` : `Baixar de quem pediu (${quemPediu.length})`}
          </Button>
          <Button variant="ghost" size="sm" disabled={comFoto.length === 0 || !!baixando} onClick={() => baixarTodos(comFoto)}>
            Baixar todos
          </Button>
        </div>
      </div>
      <p style={pequeno}>
        O arquivo de cada um vem no tamanho do modelo (1181 × 1181), com o nome do formando e, para quem pediu, a quantidade na frente.
      </p>
      {erro ? <span style={erroEstilo}>{erro}</span> : null}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 'var(--space-5)' }}>
        {comFoto.map((f) => (
          <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center', textAlign: 'center' }}>
            <AdesivoCrianca foto={fotos[f]} nome={f} />
            <span style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 600 }}>{f}</span>
            {(pediram.get(f) ?? 0) > 0 ? <span style={{ ...pequeno, color: 'var(--gild-300)' }}>Pediu {pediram.get(f)}</span> : null}
            <Button variant="ghost" size="sm" style={{ height: 28 }} disabled={!!baixando} carregando={baixando === f} iconLeft={<Download size={14} />} onClick={() => baixar(f)}>
              Baixar
            </Button>
          </div>
        ))}
      </div>
      {semFoto.length > 0 ? <p style={pequeno}>Sem foto de criança no site ainda ({semFoto.length}): {semFoto.join(', ')}.</p> : null}
    </div>
  );
}
