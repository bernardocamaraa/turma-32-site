import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Download, Minus, Plus, ShoppingBag, TriangleAlert } from 'lucide-react';
import { AdesivoCrianca, baixarAdesivoCrianca } from '../components/AdesivoCrianca';
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
  MAXIMO_POR_MODELO,
  MODELOS,
  modeloPorId,
  PIX,
  quantidadeDoPedido,
  reais,
  totalDoPedido,
  urlDaLoja,
  type AcaoAdesivos,
  type AcessoAdesivos,
  type DadosAdesivos,
  type Itens,
  type Modelo,
  type Pedido,
} from '../lib/adesivos';
import { lerEleitor, salvarEleitor } from '../lib/eleitor';
import { useIsMobile } from '../lib/useViewport';

const texto: CSSProperties = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };
const pequeno: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const titulo: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' };
const erroEstilo: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' };

const primeiroNome = (nome: string) => nome.split(' ')[0];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "bernardo-camara" for the file name of a sticker. */
const slug = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * /adesivos: the store of the stickers handed out on the night. One link
 * for the whole class, entered with the WhatsApp like the vote and /musica
 * (the same number, remembered on the phone, enters all three). The
 * committee sees every order in its "Adesivos" tab, below.
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
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar agora.');
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

  const meu = dados?.meu ?? null;
  const travado = !!dados && (!dados.aberta || !!meu?.pago);
  const quantidade = quantidadeDoPedido(itens);
  const total = totalDoPedido(itens);
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
          No baile, a turma distribui adesivos. Escolha quais modelos você quer e quantos de cada, inclusive o seu adesivo de
          criança, feito com a sua foto.
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--space-5)',
            }}
          >
            {MODELOS.map((m, i) => (
              <CartaoModelo
                key={m.id}
                modelo={m}
                indice={i}
                voce={dados.voce!}
                foto={dados.fotoInfancia}
                quantidade={itens[m.id] ?? 0}
                travado={travado}
                onMudar={(q) => mudar(m.id, q)}
              />
            ))}
          </div>

          <Card padding="var(--space-6) var(--space-7)" accent={quantidade > 0 && mudou}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <ShoppingBag size={20} color="var(--gild-300)" />
                <span style={titulo}>Seu pedido</span>
                {meu ? <Badge tone={meu.pago ? 'ok' : 'gild'}>{meu.pago ? 'Pago' : 'Esperando pagamento'}</Badge> : null}
              </div>

              {quantidade > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {MODELOS.filter((m) => (itens[m.id] ?? 0) > 0).map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 'var(--fs-body)' }}>
                      <span>
                        {itens[m.id]}× {m.nome}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{reais(itens[m.id] * m.preco)}</span>
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
                    <span>{reais(total)}</span>
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
                      agir(
                        { acao: 'pedir', itens, observacao },
                        quantidade === 0 ? 'Pedido cancelado' : meu ? 'Pedido atualizado!' : 'Pedido feito!',
                      )
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

          {meu && !meu.pago ? <Pagamento total={totalDoPedido(meu.itens)} /> : null}
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
            O total do seu pedido é <strong style={{ color: 'var(--text-primary)' }}>{reais(total)}</strong>. A comissão vai avisar como pagar;
            quando ela confirmar o pagamento, o pedido aparece aqui como pago.
          </p>
        )}
      </div>
    </Card>
  );
}

/** One model on sale: its art, what it is, the price and how many. */
function CartaoModelo({
  modelo,
  indice,
  voce,
  foto,
  quantidade,
  travado,
  onMudar,
}: {
  modelo: Modelo;
  indice: number;
  voce: string;
  foto: string | null;
  quantidade: number;
  travado: boolean;
  onMudar: (q: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Each sticker a little crooked, like stuck on by hand.
  const giro = [-3, 2.5, -1.5, 3, -2.5][indice % 5];

  async function baixar() {
    if (!ref.current) return;
    setBaixando(true);
    setErro(null);
    try {
      await baixarAdesivoCrianca(ref.current, `adesivo-${slug(voce)}.png`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível baixar agora.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Card accent={quantidade > 0} padding={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        className="adesivo-vitrine"
        style={{
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: modelo.crianca ? '10%' : '16%',
          background: modelo.crianca
            ? 'radial-gradient(circle at 50% 40%, rgba(220,196,140,.18), transparent 65%), var(--ink-800)'
            : 'radial-gradient(circle at 50% 40%, rgba(169,211,232,.14), transparent 65%), var(--ink-800)',
          position: 'relative',
        }}
      >
        {modelo.crianca ? <Badge tone="gild" style={{ position: 'absolute', top: 16, left: 16 }}>Só seu</Badge> : null}
        <div className="adesivo-peca" style={{ transform: `rotate(${giro}deg)`, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {modelo.crianca ? (
            <div style={{ width: '100%', filter: 'drop-shadow(0 14px 22px rgba(0,0,0,.55))' }}>
              <AdesivoCrianca ref={ref} foto={foto} nome={voce} />
            </div>
          ) : (
            modelo.placa ? (
              <div className="adesivo-placa">
                <img src={modelo.imagem} alt={modelo.nome} style={{ display: 'block', width: '100%' }} />
              </div>
            ) : (
              <img src={modelo.imagem} alt={modelo.nome} className="adesivo-recorte" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            )
          )}
        </div>
      </div>

      <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-4)' }}>
            <span style={titulo}>{modelo.nome}</span>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--gild-300)', whiteSpace: 'nowrap' }}>{reais(modelo.preco)}</span>
          </div>
          <span style={pequeno}>{modelo.sobre}</span>
          {modelo.crianca && !foto ? (
            <span style={{ ...pequeno, color: 'var(--gild-300)' }}>
              A comissão ainda não tem a sua foto de criança. Mande para ela no WhatsApp: assim que ela colocar no site, a foto aparece aqui.
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Quantidade valor={quantidade} travado={travado} rotulo={modelo.nome} onMudar={onMudar} />
          {modelo.crianca && foto ? (
            <Button variant="ghost" size="sm" carregando={baixando} iconLeft={<Download size={16} />} onClick={baixar}>
              Baixar
            </Button>
          ) : null}
        </div>
        {erro ? <span style={erroEstilo}>{erro}</span> : null}
      </div>
    </Card>
  );
}

/** − 3 + */
function Quantidade({ valor, travado, rotulo, onMudar }: { valor: number; travado: boolean; rotulo: string; onMudar: (q: number) => void }) {
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
        onChange={(e) => onMudar(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))}
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
      <button
        type="button"
        aria-label={`Mais ${rotulo}`}
        disabled={travado || valor >= MAXIMO_POR_MODELO}
        style={botao(travado || valor >= MAXIMO_POR_MODELO)}
        onClick={() => onMudar(valor + 1)}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Committee tab
// ---------------------------------------------------------------------------

/**
 * The committee's tab: open or close the store, every order (mark it paid,
 * delete it), the total of each model to send to the print shop, who hasn't
 * ordered, and each childhood sticker ready to download.
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
      setErroCarregar(e instanceof Error ? e.message : 'Não foi possível abrir agora.');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function agir(acao: AcaoAdesivos, chave: string) {
    setSalvando(chave);
    setErro(null);
    try {
      setDados(await buscarAdesivos({ codigo }, acao));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar agora.');
    } finally {
      setSalvando(null);
    }
  }

  const pedidos = dados?.pedidos ?? [];
  const porModelo = useMemo(
    () => MODELOS.map((m) => ({ modelo: m, quantidade: pedidos.reduce((s, p) => s + (p.itens[m.id] ?? 0), 0) })),
    [pedidos],
  );

  if (!dados) return <CarregandoSecao erro={erroCarregar} onTentar={carregar} />;

  const feitos = new Set(pedidos.map((p) => p.formando));
  const faltam = (dados.formandos ?? []).filter((f) => !feitos.has(f));
  const total = pedidos.reduce((s, p) => s + totalDoPedido(p.itens), 0);
  const recebido = pedidos.filter((p) => p.pago).reduce((s, p) => s + totalDoPedido(p.itens), 0);

  function baixarPlanilha() {
    const cabecalho = ['Formando', ...MODELOS.map((m) => m.nome), 'Total (R$)', 'Pago', 'Observação'];
    const linhas = pedidos.map((p) => [
      p.formando,
      ...MODELOS.map((m) => String(p.itens[m.id] ?? 0)),
      totalDoPedido(p.itens).toFixed(2).replace('.', ','),
      p.pago ? 'Sim' : 'Não',
      p.observacao ?? '',
    ]);
    const csv = [cabecalho, ...linhas].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'pedidos-adesivos.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
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
              <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Loja de adesivos</span>
              <span style={{ fontSize: 'var(--fs-body)' }}>
                {dados.aberta ? 'Aberta, a turma pode pedir e mudar o pedido.' : 'Fechada, ninguém consegue pedir ou mudar o pedido.'}
              </span>
            </div>
            <Button
              size="lg"
              variant={dados.aberta ? 'secondary' : 'primary'}
              carregando={salvando === 'aberta'}
              onClick={() => agir({ acao: 'aberta', sim: !dados.aberta }, 'aberta')}
            >
              {dados.aberta ? 'Fechar loja' : 'Abrir loja'}
            </Button>
          </div>
          <BotoesLink url={urlDaLoja()} mensagem="A loja de adesivos da formatura está aberta! Escolha os seus, inclusive o seu adesivo de criança:" />
        </div>
        {erro ? <span style={{ display: 'block', marginTop: 'var(--space-3)', ...erroEstilo }}>{erro}</span> : null}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 'var(--space-5)' }}>
        <Numero rotulo="Pedidos" valor={`${pedidos.length}/${dados.formandos?.length ?? 0}`} />
        <Numero rotulo="Adesivos" valor={String(porModelo.reduce((s, m) => s + m.quantidade, 0))} />
        <Numero rotulo="Total" valor={reais(total)} />
        <Numero rotulo="Já pago" valor={reais(recebido)} destaque />
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-6) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Para a gráfica: quantos de cada modelo</span>
          <Button variant="secondary" size="sm" disabled={pedidos.length === 0} onClick={baixarPlanilha}>
            Baixar planilha
          </Button>
        </div>
        {porModelo.map(({ modelo, quantidade }) => (
          <div key={modelo.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)', fontSize: 'var(--fs-body)' }}>
            <span>{modelo.nome}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{quantidade}</span>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={titulo}>Pedidos · {pedidos.length}</span>
        {pedidos.length === 0 ? <p style={texto}>Ninguém pediu ainda.</p> : null}
        {pedidos.map((p) => (
          <PedidoDaComissao
            key={p.formando}
            pedido={p}
            foto={dados.fotos?.[p.formando] ?? null}
            salvando={salvando}
            onPago={(sim) => agir({ acao: 'pago', formando: p.formando, sim }, `pago-${p.formando}`)}
            onApagar={() => {
              if (window.confirm(`Apagar o pedido de ${p.formando}? Não dá pra desfazer.`)) agir({ acao: 'apagar', formando: p.formando }, `apagar-${p.formando}`);
            }}
          />
        ))}
      </div>

      {faltam.length > 0 ? (
        <Card padding="var(--space-6) var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Ainda não pediram · {faltam.length}</span>
            <p style={texto}>{faltam.join(', ')}</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <Card padding="var(--space-5) var(--space-6)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>{rotulo}</span>
        <span style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, lineHeight: 1.1, color: destaque ? 'var(--state-ok)' : undefined }}>{valor}</span>
      </div>
    </Card>
  );
}

function PedidoDaComissao({
  pedido,
  foto,
  salvando,
  onPago,
  onApagar,
}: {
  pedido: Pedido;
  foto: string | null;
  salvando: string | null;
  onPago: (sim: boolean) => void;
  onApagar: () => void;
}) {
  const mobile = useIsMobile();
  const ref = useRef<SVGSVGElement>(null);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const criancas = pedido.itens.crianca ?? 0;

  async function baixar() {
    if (!ref.current) return;
    setBaixando(true);
    setErro(null);
    try {
      await baixarAdesivoCrianca(ref.current, `adesivo-${slug(pedido.formando)}.png`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível baixar agora.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Card padding="var(--space-5) var(--space-6)">
      <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: mobile ? 'stretch' : 'center', flexDirection: mobile ? 'column' : 'row' }}>
        {criancas > 0 ? (
          <div style={{ width: 96, flex: '0 0 auto' }}>
            <AdesivoCrianca ref={ref} foto={foto} nome={pedido.formando} />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{pedido.formando}</span>
            <Badge tone={pedido.pago ? 'ok' : 'gild'}>{pedido.pago ? 'Pago' : 'Não pago'}</Badge>
          </div>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
            {Object.entries(pedido.itens)
              .map(([id, q]) => `${q}× ${modeloPorId(id)?.nome ?? id}`)
              .join(' · ')}{' '}
            · <strong style={{ color: 'var(--text-primary)' }}>{reais(totalDoPedido(pedido.itens))}</strong>
          </span>
          {pedido.observacao ? <span style={pequeno}>“{pedido.observacao}”</span> : null}
          {criancas > 0 && !foto ? <span style={{ ...pequeno, color: 'var(--gild-300)' }}>Pediu o adesivo de criança, mas ainda não tem foto no site.</span> : null}
          {erro ? <span style={erroEstilo}>{erro}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          {criancas > 0 && foto ? (
            <Button variant="secondary" size="sm" carregando={baixando} iconLeft={<Download size={16} />} onClick={baixar}>
              Adesivo
            </Button>
          ) : null}
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
