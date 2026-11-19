import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as EventoPonteiro, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Circle,
  Copy,
  Crown,
  Heart,
  Image as Imagem,
  PenLine,
  Sparkle,
  Star,
  Trash2,
  Type,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { ARCO_IRIS, CORES, fundoDaCor, nomeDaCor } from '../lib/cores';
import {
  alcaDe,
  carregarFontes,
  coresOriginaisDoLogo,
  desenhar,
  elementoEm,
  FONTES,
  FORMAS,
  LADO,
  NOME_DA_FORMA,
  novoId,
  pesoDaFonte,
  prepararImagens,
  type Design,
  type Elemento,
  type Forma,
  type Recursos,
} from '../lib/criacao';
import { useIsMobile } from '../lib/useViewport';

const C = LADO / 2;
const rotulo: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' };
const pequeno: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };

const ICONE_DA_FORMA: Record<Forma, ReactNode> = {
  estrela: <Star size={18} />,
  estrela6: <Sparkle size={18} />,
  coracao: <Heart size={18} />,
  coroa: <Crown size={18} />,
  raio: <Zap size={18} />,
  brilho: <Sparkle size={18} strokeWidth={3} />,
  circulo: <Circle size={18} />,
};

/** A button of the editor's panels. */
function Botao({
  children,
  onClick,
  ativo,
  desativado,
  titulo,
  perigo,
  estilo,
}: {
  children: ReactNode;
  onClick: () => void;
  ativo?: boolean;
  desativado?: boolean;
  titulo?: string;
  perigo?: boolean;
  estilo?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desativado}
      title={titulo}
      aria-pressed={ativo}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 40,
        padding: '0 12px',
        borderRadius: 'var(--radius-sm)',
        border: ativo ? '1px solid var(--gild-400)' : '1px solid var(--stroke-hair)',
        background: ativo ? 'rgba(201,169,106,.16)' : 'rgba(245,245,247,.06)',
        color: perigo ? 'var(--state-error)' : 'var(--chalk-050)',
        fontSize: 14,
        fontWeight: 500,
        cursor: desativado ? 'default' : 'pointer',
        opacity: desativado ? 0.4 : 1,
        ...estilo,
      }}
    >
      {children}
    </button>
  );
}

/** A row of colour swatches (with the rainbow and any other colour). */
function Cores({ valor, onCor, arcoIris = true, original }: { valor: string; onCor: (c: string) => void; arcoIris?: boolean; original?: string }) {
  const opcoes = [
    ...(original ? [{ nome: 'Original', cor: original }] : []),
    ...(arcoIris ? [{ nome: 'Arco-íris (LGBT)', cor: ARCO_IRIS }] : []),
    ...CORES.filter((c) => c.cor !== original),
  ];
  const outra = !opcoes.some((c) => c.cor === valor);
  const bolinha = (marcada: boolean): CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flex: '0 0 auto',
    boxShadow: marcada ? '0 0 0 2px var(--ink-850), 0 0 0 4px var(--chalk-050)' : 'inset 0 0 0 1px rgba(255,255,255,.2)',
  });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
      {opcoes.map((c) => (
        <button
          key={c.cor}
          type="button"
          aria-label={c.nome}
          title={c.nome}
          aria-pressed={valor === c.cor}
          onClick={() => onCor(c.cor)}
          style={{ ...bolinha(valor === c.cor), background: fundoDaCor(c.cor) }}
        />
      ))}
      <label title="Outra cor" style={{ ...bolinha(outra), position: 'relative', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
        <input
          type="color"
          aria-label="Outra cor"
          value={valor.startsWith('#') ? valor : '#ffffff'}
          onChange={(e) => onCor(e.target.value.toLowerCase())}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </label>
    </div>
  );
}

function Deslizante({ rotulo: r, valor, min, max, passo, onValor, formato }: { rotulo: string; valor: number; min: number; max: number; passo: number; onValor: (v: number) => void; formato?: (v: number) => string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...rotulo, display: 'flex', justifyContent: 'space-between' }}>
        {r}
        <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>{formato ? formato(valor) : valor}</span>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => onValor(Number(e.target.value))} style={{ accentColor: 'var(--gild-400)', width: '100%' }} />
    </label>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--ink-850)', border: '1px solid var(--stroke-hair)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-body)', fontWeight: 600 }}>{titulo}</h3>
      {children}
    </section>
  );
}

const NOME_DO_TIPO: Record<Elemento['tipo'], string> = { foto: 'Foto de criança', logo: 'Logo da 32', assinatura: 'Assinatura', texto: 'Texto', forma: 'Forma' };

type Arrasto = { modo: 'mover'; id: string; dx: number; dy: number } | { modo: 'alca'; id: string; escala: number; giro: number; dist: number; ang: number };

/**
 * The sticker editor ("Crie seu adesivo"): the sticker on the left (drag an
 * element to move it, its gold corner to resize and turn it), the panels on
 * the right (add things, change the selected one, the background). Opens
 * over the page; `onSalvar` gets the finished design.
 */
export function EditorAdesivo({
  inicial,
  nomeInicial,
  recursos,
  salvando,
  erro,
  onSalvar,
  onFechar,
}: {
  inicial: Design;
  nomeInicial: string;
  recursos: Recursos;
  salvando: boolean;
  erro: string | null;
  onSalvar: (d: Design, nome: string) => void;
  onFechar: () => void;
}) {
  const mobile = useIsMobile();
  const [design, setDesign] = useState<Design>(inicial);
  const [historico, setHistorico] = useState<Design[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [nome, setNome] = useState(nomeInicial);
  const [prontas, setProntas] = useState<Map<string, CanvasImageSource>>(new Map());
  const canvas = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<Arrasto | null>(null);
  const sel = design.elementos.find((e) => e.id === selecionado) ?? null;

  // Fonts first; then the pictures each time the design asks for new ones.
  useEffect(() => {
    carregarFontes().then(() => setProntas((p) => new Map(p)));
  }, []);
  useEffect(() => {
    let ativo = true;
    prepararImagens(design, recursos).then((m) => ativo && setProntas(m));
    return () => {
      ativo = false;
    };
  }, [design, recursos]);

  // No page scroll under the editor.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  // Draw on every change, at the screen's sharpness.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const lado = Math.round(c.clientWidth * (window.devicePixelRatio || 1));
    if (c.width !== lado) {
      c.width = lado;
      c.height = lado;
    }
    desenhar(c.getContext('2d')!, design, prontas, { escala: lado / LADO, selecionado });
  });

  /** Changes the design, remembering how it was (for "Desfazer") unless told not to. */
  function mudar(f: (d: Design) => Design, lembrar = true) {
    setDesign((d) => {
      if (lembrar) setHistorico((h) => [...h.slice(-49), d]);
      return f(d);
    });
  }
  function mudarElemento(id: string, campos: Partial<Elemento>, lembrar = true) {
    mudar((d) => ({ ...d, elementos: d.elementos.map((e) => (e.id === id ? ({ ...e, ...campos } as Elemento) : e)) }), lembrar);
  }
  function desfazer() {
    setHistorico((h) => {
      if (!h.length) return h;
      setDesign(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function adicionar(e: Elemento) {
    mudar((d) => ({ ...d, elementos: [...d.elementos, e] }));
    setSelecionado(e.id);
  }
  const noMeio = { x: C, y: C, giro: 0 };
  const adicionarForma = (forma: Forma) => adicionar({ id: novoId(), tipo: 'forma', ...noMeio, escala: 0.8, forma, cor: '#ffd21f', contorno: '#000000' });

  function apagar() {
    if (!sel) return;
    mudar((d) => ({ ...d, elementos: d.elementos.filter((e) => e.id !== sel.id) }));
    setSelecionado(null);
  }
  function duplicar() {
    if (!sel) return;
    const copia = { ...sel, id: novoId(), x: sel.x + 40, y: sel.y + 40 } as Elemento;
    adicionar(copia);
  }
  function camada(para: 'frente' | 'tras') {
    if (!sel) return;
    mudar((d) => {
      const resto = d.elementos.filter((e) => e.id !== sel.id);
      return { ...d, elementos: para === 'frente' ? [...resto, sel] : [sel, ...resto] };
    });
  }

  // ---- Pointer on the sticker ----
  function ponto(ev: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * LADO, y: ((ev.clientY - r.top) / r.height) * LADO };
  }
  function apertar(ev: EventoPonteiro<HTMLCanvasElement>) {
    const p = ponto(ev);
    const ctx = canvas.current!.getContext('2d')!;
    if (sel) {
      const a = alcaDe(sel, prontas, ctx);
      if (Math.hypot(p.x - a.x, p.y - a.y) < 48) {
        ev.currentTarget.setPointerCapture(ev.pointerId);
        setHistorico((h) => [...h.slice(-49), design]);
        arrasto.current = { modo: 'alca', id: sel.id, escala: sel.escala, giro: sel.giro, dist: Math.hypot(p.x - sel.x, p.y - sel.y), ang: Math.atan2(p.y - sel.y, p.x - sel.x) };
        return;
      }
    }
    const e = elementoEm(design, prontas, ctx, p.x, p.y);
    setSelecionado(e?.id ?? null);
    if (e) {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      setHistorico((h) => [...h.slice(-49), design]);
      arrasto.current = { modo: 'mover', id: e.id, dx: p.x - e.x, dy: p.y - e.y };
    }
  }
  function mover(ev: EventoPonteiro<HTMLCanvasElement>) {
    const a = arrasto.current;
    if (!a) return;
    const p = ponto(ev);
    if (a.modo === 'mover') {
      mudarElemento(a.id, { x: Math.max(0, Math.min(LADO, p.x - a.dx)), y: Math.max(0, Math.min(LADO, p.y - a.dy)) }, false);
    } else {
      const e = design.elementos.find((x) => x.id === a.id);
      if (!e) return;
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      const giro = a.giro + ((ang - a.ang) * 180) / Math.PI;
      mudarElemento(a.id, { escala: Math.max(0.1, Math.min(4, (a.escala * dist) / Math.max(1, a.dist))), giro: ((giro + 540) % 360) - 180 }, false);
    }
  }
  const soltar = () => {
    arrasto.current = null;
  };
  function teclado(ev: KeyboardEvent<HTMLCanvasElement>) {
    if (!sel) return;
    const passo = ev.shiftKey ? 40 : 10;
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
    if (d) {
      ev.preventDefault();
      mudarElemento(sel.id, { x: sel.x + d[0], y: sel.y + d[1] });
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      apagar();
    }
  }

  // ---- Panels ----
  const adicionarPainel = (
    <Secao titulo="Adicionar">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Botao
          desativado={!recursos.foto}
          titulo={recursos.foto ? 'A sua foto de criança' : 'A comissão ainda não tem a sua foto de criança'}
          onClick={() => adicionar({ id: novoId(), tipo: 'foto', ...noMeio, escala: 0.8, formato: 'circulo', borda: '#ffffff', larguraBorda: 16 })}
        >
          <Imagem size={18} /> Foto de criança
        </Botao>
        <Botao onClick={() => adicionar({ id: novoId(), tipo: 'logo', ...noMeio, escala: 1, variante: 'grafite', cores: null })}>
          <Crown size={18} /> Logo da 32
        </Botao>
        <Botao
          desativado={!recursos.assinatura}
          titulo={recursos.assinatura ? 'A sua assinatura' : 'A sua assinatura ainda não está no site'}
          onClick={() => adicionar({ id: novoId(), tipo: 'assinatura', ...noMeio, escala: 1, cor: '#ffffff' })}
        >
          <PenLine size={18} /> Assinatura
        </Botao>
        <Botao
          onClick={() =>
            adicionar({ id: novoId(), tipo: 'texto', ...noMeio, escala: 0.7, conteudo: 'TURMA 32', fonte: 'Roboto Slab', cor: '#ffffff', contorno: '#000000', larguraContorno: 8, curva: 0 })
          }
        >
          <Type size={18} /> Texto
        </Botao>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FORMAS.map((f) => (
          <Botao key={f} onClick={() => adicionarForma(f)} titulo={NOME_DA_FORMA[f]}>
            {ICONE_DA_FORMA[f]} <span style={{ fontSize: 13 }}>{NOME_DA_FORMA[f]}</span>
          </Botao>
        ))}
      </div>
    </Secao>
  );

  const selecionadoPainel = sel ? (
    <Secao titulo={NOME_DO_TIPO[sel.tipo]}>
      {sel.tipo === 'texto' ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Texto</span>
            <input
              value={sel.conteudo}
              maxLength={40}
              onChange={(e) => mudarElemento(sel.id, { conteudo: e.target.value }, false)}
              onFocus={() => setHistorico((h) => [...h.slice(-49), design])}
              style={{ height: 44, padding: '0 12px', fontSize: 16, color: 'var(--chalk-050)', background: 'var(--ink-800)', border: '1px solid var(--stroke-hair)', borderRadius: 'var(--radius-sm)' }}
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Fonte</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FONTES.map((f) => (
                <Botao key={f} ativo={sel.fonte === f} titulo={f} onClick={() => mudarElemento(sel.id, { fonte: f })} estilo={{ fontFamily: `"${f}"`, fontSize: 17, fontWeight: pesoDaFonte(f) }}>
                  {['Pacifico', 'Caveat'].includes(f) ? 'Turma 32' : 'TURMA 32'}
                </Botao>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Cor</span>
            <Cores valor={sel.cor} onCor={(c) => mudarElemento(sel.id, { cor: c })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Contorno</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Botao ativo={!sel.contorno} onClick={() => mudarElemento(sel.id, { contorno: null })}>
                Sem contorno
              </Botao>
            </div>
            <Cores valor={sel.contorno ?? ''} onCor={(c) => mudarElemento(sel.id, { contorno: c, larguraContorno: sel.larguraContorno || 8 })} />
            {sel.contorno ? (
              <Deslizante rotulo="Espessura do contorno" valor={sel.larguraContorno} min={1} max={24} passo={1} onValor={(v) => mudarElemento(sel.id, { larguraContorno: v }, false)} />
            ) : null}
          </div>
          <Deslizante
            rotulo="Curva"
            valor={sel.curva}
            min={-180}
            max={180}
            passo={5}
            onValor={(v) => mudarElemento(sel.id, { curva: v }, false)}
            formato={(v) => (v === 0 ? 'reto' : v > 0 ? 'para cima' : 'para baixo')}
          />
        </>
      ) : null}

      {sel.tipo === 'forma' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FORMAS.map((f) => (
              <Botao key={f} ativo={sel.forma === f} titulo={NOME_DA_FORMA[f]} onClick={() => mudarElemento(sel.id, { forma: f })}>
                {ICONE_DA_FORMA[f]}
              </Botao>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Cor</span>
            <Cores valor={sel.cor} onCor={(c) => mudarElemento(sel.id, { cor: c })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Contorno</span>
            <div>
              <Botao ativo={!sel.contorno} onClick={() => mudarElemento(sel.id, { contorno: null })}>
                Sem contorno
              </Botao>
            </div>
            <Cores valor={sel.contorno ?? ''} onCor={(c) => mudarElemento(sel.id, { contorno: c })} />
          </div>
        </>
      ) : null}

      {sel.tipo === 'foto' ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <Botao ativo={sel.formato === 'circulo'} onClick={() => mudarElemento(sel.id, { formato: 'circulo' })}>
              Redonda
            </Botao>
            <Botao ativo={sel.formato === 'quadrado'} onClick={() => mudarElemento(sel.id, { formato: 'quadrado' })}>
              Quadrada
            </Botao>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={rotulo}>Borda</span>
            <Cores valor={sel.borda} onCor={(c) => mudarElemento(sel.id, { borda: c, larguraBorda: sel.larguraBorda || 16 })} />
            <Deslizante rotulo="Espessura da borda" valor={sel.larguraBorda} min={0} max={50} passo={1} onValor={(v) => mudarElemento(sel.id, { larguraBorda: v }, false)} />
          </div>
          <span style={pequeno}>A parte da foto que aparece é a mesma do seu adesivo de criança (dá para ajustar lá, em “Ajustar foto”).</span>
        </>
      ) : null}

      {sel.tipo === 'logo' ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <Botao ativo={sel.variante === 'grafite'} onClick={() => mudarElemento(sel.id, { variante: 'grafite', cores: null })}>
              Grafite
            </Botao>
            <Botao ativo={sel.variante === 'liso'} onClick={() => mudarElemento(sel.id, { variante: 'liso', cores: null })}>
              Lisa
            </Botao>
          </div>
          {(['Sombra', 'Preenchimento'] as const).map((parte, i) => {
            const originais = coresOriginaisDoLogo(sel.variante);
            const atuais = sel.cores ?? originais;
            return (
              <div key={parte} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={rotulo}>
                  {parte}: <span style={{ fontWeight: 400 }}>{nomeDaCor(atuais[i], { tipo: 'matiz', nome: parte, cor: originais[i] })}</span>
                </span>
                <Cores
                  valor={atuais[i]}
                  original={originais[i]}
                  onCor={(c) => {
                    const novas: [string, string] = [...atuais] as [string, string];
                    novas[i] = c;
                    mudarElemento(sel.id, { cores: novas[0] === originais[0] && novas[1] === originais[1] ? null : novas });
                  }}
                />
              </div>
            );
          })}
        </>
      ) : null}

      {sel.tipo === 'assinatura' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={rotulo}>Cor</span>
          <Cores valor={sel.cor} onCor={(c) => mudarElemento(sel.id, { cor: c })} />
        </div>
      ) : null}

      <Deslizante rotulo="Tamanho" valor={Math.round(sel.escala * 100)} min={10} max={400} passo={1} onValor={(v) => mudarElemento(sel.id, { escala: v / 100 }, false)} formato={(v) => `${v}%`} />
      <Deslizante rotulo="Girar" valor={Math.round(sel.giro)} min={-180} max={180} passo={1} onValor={(v) => mudarElemento(sel.id, { giro: v }, false)} formato={(v) => `${v}°`} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Botao onClick={() => camada('frente')} titulo="Trazer para a frente">
          <ArrowUpToLine size={16} /> Frente
        </Botao>
        <Botao onClick={() => camada('tras')} titulo="Mandar para trás">
          <ArrowDownToLine size={16} /> Trás
        </Botao>
        <Botao onClick={duplicar}>
          <Copy size={16} /> Duplicar
        </Botao>
        <Botao onClick={apagar} perigo>
          <Trash2 size={16} /> Apagar
        </Botao>
      </div>
    </Secao>
  ) : (
    <p style={{ ...pequeno, margin: 0 }}>Toque em algo no adesivo para mudar a cor, o tamanho, girar ou apagar.</p>
  );

  const fundoPainel = (
    <Secao titulo="Fundo e borda">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(
          [
            ['cor', 'Cor'],
            ['degrade', 'Degradê'],
            ['arcoiris', 'Arco-íris'],
            ['muro', 'Muro'],
          ] as const
        ).map(([tipo, nomeTipo]) => (
          <Botao key={tipo} ativo={design.fundo.tipo === tipo} onClick={() => mudar((d) => ({ ...d, fundo: { ...d.fundo, tipo, cor1: tipo === 'muro' && d.fundo.tipo !== 'muro' ? '#111111' : d.fundo.cor1 } }))}>
            {nomeTipo}
          </Botao>
        ))}
      </div>
      {design.fundo.tipo !== 'arcoiris' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={rotulo}>{design.fundo.tipo === 'degrade' ? 'Primeira cor' : design.fundo.tipo === 'muro' ? 'Cor por baixo do muro' : 'Cor'}</span>
          <Cores arcoIris={false} valor={design.fundo.cor1} onCor={(c) => mudar((d) => ({ ...d, fundo: { ...d.fundo, cor1: c } }))} />
        </div>
      ) : null}
      {design.fundo.tipo === 'degrade' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={rotulo}>Segunda cor</span>
          <Cores arcoIris={false} valor={design.fundo.cor2} onCor={(c) => mudar((d) => ({ ...d, fundo: { ...d.fundo, cor2: c } }))} />
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>Borda</span>
        <Cores valor={design.borda.cor} onCor={(c) => mudar((d) => ({ ...d, borda: { cor: c, largura: d.borda.largura || 20 } }))} />
        <Deslizante rotulo="Espessura" valor={design.borda.largura} min={0} max={80} passo={1} onValor={(v) => mudar((d) => ({ ...d, borda: { ...d.borda, largura: v } }), false)} />
      </div>
    </Secao>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crie seu adesivo"
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#000', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: mobile ? '12px 16px 48px' : '20px 32px 48px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 2, padding: '8px 0', background: '#000' }}>
          <button type="button" onClick={onFechar} aria-label="Fechar o editor" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(245,245,247,.1)', color: 'var(--chalk-050)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={20} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 700, flex: 1, minWidth: 140 }}>Crie seu adesivo</span>
          <Botao onClick={desfazer} desativado={!historico.length} titulo="Desfazer">
            <Undo2 size={16} /> Desfazer
          </Botao>
          <button
            type="button"
            disabled={salvando}
            onClick={() => {
              setSelecionado(null);
              onSalvar(design, nome.trim() || 'Meu adesivo');
            }}
            style={{ height: 44, padding: '0 22px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gild-400)', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}
          >
            {salvando ? 'Salvando…' : 'Salvar adesivo'}
          </button>
        </header>
        {erro ? <span style={{ color: 'var(--state-error)', fontSize: 'var(--fs-body-sm)' }}>{erro}</span> : null}

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1fr) 400px', gap: 'var(--space-6)', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center', position: mobile ? 'static' : 'sticky', top: 76 }}>
            <canvas
              ref={canvas}
              tabIndex={0}
              aria-label="O seu adesivo. Toque em algo para escolher; arraste para mover; o círculo dourado no canto aumenta e gira. Com o teclado: setas movem, Delete apaga."
              onPointerDown={apertar}
              onPointerMove={mover}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              onKeyDown={teclado}
              style={{
                width: mobile ? '100%' : 'min(100%, 560px)',
                aspectRatio: '1',
                touchAction: 'none',
                cursor: 'grab',
                borderRadius: '50%',
                background: 'repeating-conic-gradient(#1c1c1e 0% 25%, #2c2c2e 0% 50%) 50% / 28px 28px',
                boxShadow: '0 24px 60px rgba(0,0,0,.6)',
              }}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: mobile ? '100%' : 'min(100%, 560px)' }}>
              <span style={rotulo}>Nome do adesivo</span>
              <input
                value={nome}
                maxLength={40}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Meu adesivo"
                style={{ height: 44, padding: '0 12px', fontSize: 16, color: 'var(--chalk-050)', background: 'var(--ink-800)', border: '1px solid var(--stroke-hair)', borderRadius: 'var(--radius-sm)' }}
              />
            </label>
            <span style={{ ...pequeno, textAlign: 'center' }}>O adesivo sai redondo, com 6 cm. O que está fora do círculo não aparece.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {adicionarPainel}
            {selecionadoPainel}
            {fundoPainel}
          </div>
        </div>
      </div>
    </div>
  );
}
