import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { MapaMesas } from '../components/MapaMesas';
import { Select } from '../components/Select';
import { PageHeader } from '../components/SectionHeading';
import { FORMANDOS } from '../lib/formandos';
import { Minus, Plus, X } from 'lucide-react';
import { buscarMesas, POSICOES_MESAS, urlDoFormando, type AcessoMesas, type AlteracaoMesas, type DadosMesas } from '../lib/mesas';
import { lerCodigo, salvarCodigo } from '../lib/codigoComissao';
import { BotoesLink } from '../components/BotoesLink';
import { useIsMobile } from '../lib/useViewport';

const POLL_MS = 20000;

const rotuloCampo = {
  fontSize: 'var(--fs-body-sm)',
  color: 'var(--text-faint)',
};

/**
 * Two ways in:
 * - /mesas/<link>: a formando's personal URL. Opens straight on the map and
 *   can only move that formando's seats (the Edge Function decides whose,
 *   from the link — not from anything this page sends).
 * - /mesas: the committee, with its code. Can move anyone's seats and gets
 *   the panel with each formando's link to send out.
 */
export function Mesas() {
  const mobile = useIsMobile();
  const { link } = useParams<{ link?: string }>();
  const [codigo, setCodigo] = useState(() => (link ? '' : lerCodigo()));
  // Whose seats the committee is moving; for a formando it comes from the link.
  const [escolhido, setEscolhido] = useState('');
  const [dados, setDados] = useState<DadosMesas | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const areaMapa = useRef<HTMLDivElement>(null);
  const rolagemMapa = useRef<HTMLDivElement>(null);

  // Opening a table plays its animation on the map, and the details panel
  // sits over (or, on a phone, under) part of the screen — so bring the
  // whole map into view if it isn't already.
  useEffect(() => {
    if (!selecionada) return;
    const r = areaMapa.current?.getBoundingClientRect();
    if (!r) return;
    const alturaMenu = 60;
    const visivel = mobile ? window.innerHeight * 0.45 : window.innerHeight;
    if (r.top < alturaMenu || r.bottom > visivel) window.scrollBy({ top: r.top - alturaMenu, behavior: 'smooth' });
    // On a phone the map is wider than the screen: slide it sideways so the
    // open table is centered, not hidden off the right edge.
    const faixa = rolagemMapa.current;
    const p = POSICOES_MESAS.find((m) => m.id === selecionada);
    if (mobile && faixa && p) {
      faixa.scrollTo({ left: (p.x / 100) * faixa.scrollWidth - faixa.clientWidth / 2, behavior: 'smooth' });
    }
  }, [selecionada, mobile]);

  const acesso: AcessoMesas = link ? { link } : { codigo: codigo.trim() };
  const nome = dados?.voce ?? escolhido;

  async function entrar() {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const resultado = await buscarMesas(acesso);
      setDados(resultado);
      if (!link) salvarCodigo(codigo.trim());
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
      if (!link) salvarCodigo(null);
    } finally {
      setEntrando(false);
    }
  }

  // A personal link logs in by itself; the committee too, with a saved code.
  useEffect(() => {
    if (link || codigo) entrar();
  }, [link]);

  // Other formandos are filling tables at the same time — refresh the map
  // every so often so the counts don't go stale while someone is deciding.
  const logado = dados !== null;
  useEffect(() => {
    if (!logado) return;
    let ativo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const resultado = await buscarMesas(acesso);
        if (ativo) setDados(resultado);
      } catch (e) {
        console.error(e);
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [logado, link, codigo]);

  /** Applies a change and returns the error message to show, or null if it worked. */
  async function alterar(alteracao: AlteracaoMesas): Promise<string | null> {
    setSalvando(true);
    try {
      setDados(await buscarMesas(acesso, alteracao));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Não foi possível salvar agora.';
    } finally {
      setSalvando(false);
    }
  }

  async function marcar(lugares: number) {
    if (!mesa) return;
    setErro(null);
    const falha = await alterar({ formando: nome, mesa: mesa.id, lugares });
    setErro(falha);
    if (!falha) setQuantidade(lugares);
  }

  function sair() {
    salvarCodigo(null);
    setDados(null);
    setCodigo('');
    setEscolhido('');
    setSelecionada(null);
    setErro(null);
  }

  const total = dados?.convidados.find((c) => c.formando === nome)?.total ?? 0;
  const minhas = dados?.reservas.filter((r) => r.formando === nome) ?? [];
  const marcados = minhas.reduce((s, r) => s + r.lugares, 0);
  const restante = Math.max(total - marcados, 0);

  const mesa = dados?.mesas.find((m) => m.id === selecionada) ?? null;
  const naMesa = dados?.reservas.filter((r) => r.mesa === selecionada) ?? [];
  const meusNaMesa = naMesa.find((r) => r.formando === nome)?.lugares ?? 0;
  // The teachers at table P hold seats without being formandos.
  const fixos = mesa?.ocupantes_fixos ?? [];
  const ocupadosOutros = naMesa.reduce((s, r) => s + (r.formando === nome ? 0 : r.lugares), 0) + fixos.length;
  const maximo = mesa ? Math.max(Math.min(mesa.capacidade - ocupadosOutros, meusNaMesa + restante), 0) : 0;
  const bloqueada = !!mesa?.reservada_para && !dados?.comissao;
  const fechado = !!dados && !dados.abertas && !dados.comissao;

  function selecionar(id: string | null) {
    setSelecionada(id);
    setErro(null);
    if (!dados || !id) return;
    const m = dados.mesas.find((x) => x.id === id);
    const meus = dados.reservas.find((r) => r.mesa === id && r.formando === nome)?.lugares ?? 0;
    const outros =
      dados.reservas.filter((r) => r.mesa === id && r.formando !== nome).reduce((s, r) => s + r.lugares, 0) + (m?.ocupantes_fixos?.length ?? 0);
    // Already seated here → start from that; otherwise suggest the whole
    // group, or as much of it as still fits.
    setQuantidade(meus > 0 ? meus : Math.max(Math.min(restante, (m?.capacidade ?? 0) - outros), 0));
  }

  // The panel opens on the side of the map away from the table.
  const posicao = POSICOES_MESAS.find((p) => p.id === selecionada);
  const ladoDoPainel: 'esquerda' | 'direita' = posicao && posicao.x > 50 ? 'esquerda' : 'direita';
  const ocupados = ocupadosOutros + meusNaMesa;
  const livres = mesa ? Math.max(mesa.capacidade - ocupados, 0) : 0;
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  const conteudoPainel = mesa ? (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingRight: 40 }}>
        <span style={rotuloCampo}>
          {mesa.reservada_para === 'professores' ? 'Mesa dos professores' : mesa.reservada_para ? 'Mesa reservada' : 'Mesa'}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.1 }}>
          {ocupados === 0 ? 'Livre' : livres === 0 ? 'Completa' : plural(livres, 'lugar livre', 'lugares livres')}
        </span>
      </div>

      {naMesa.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {naMesa
            .slice()
            .sort((a, b) => (a.formando === nome ? -1 : b.formando === nome ? 1 : a.formando.localeCompare(b.formando, 'pt-BR')))
            .map((r, i) => (
              <li
                key={r.formando}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4) 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--stroke-hair)',
                  animation: `om-fade-up 600ms var(--ease-out) ${200 + i * 70}ms both`,
                }}
              >
                <span
                  aria-hidden
                  style={{ flex: '0 0 auto', width: 10, height: 10, borderRadius: '50%', background: r.formando === nome ? 'var(--gild-400)' : 'var(--ice-300)' }}
                />
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-body)', fontWeight: 500 }}>
                  {r.formando}
                  {r.formando === nome ? <span style={{ color: 'var(--gild-300)', fontWeight: 400 }}> · você</span> : null}
                </span>
                <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>{plural(r.lugares, 'lugar', 'lugares')}</span>
              </li>
            ))}
        </ul>
      ) : fixos.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Ninguém marcou essa mesa ainda.</p>
      ) : null}

      {fixos.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {fixos.map((pessoa, i) => (
            <li
              key={pessoa}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                height: 34,
                padding: '0 14px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(245,245,247,.08)',
                fontSize: 'var(--fs-body-sm)',
                fontWeight: 500,
                animation: `om-fade-up 600ms var(--ease-out) ${200 + i * 50}ms both`,
              }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--smoke-300)' }} />
              {pessoa}
            </li>
          ))}
        </ul>
      ) : null}

      {bloqueada ? (
        <p style={{ margin: 0, fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
          {mesa.reservada_para === 'professores' ? 'Essa mesa é reservada aos professores.' : 'Essa mesa é reservada.'}
        </p>
      ) : fechado ? null : maximo === 0 && meusNaMesa === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
          {total === 0 ? 'Você ainda não tem lugares para distribuir.' : restante === 0 ? 'Você já marcou todos os seus lugares em outras mesas.' : 'Essa mesa está cheia.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Seus lugares aqui</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderRadius: 'var(--radius-pill)', background: 'rgba(245,245,247,.08)' }}>
              <BotaoPasso rotulo="Menos um lugar" disabled={quantidade <= 0 || salvando} onClick={() => setQuantidade((q) => q - 1)}>
                <Minus size={16} strokeWidth={2} />
              </BotaoPasso>
              <span aria-live="polite" style={{ minWidth: 36, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600 }}>
                {quantidade}
              </span>
              <BotaoPasso rotulo="Mais um lugar" disabled={quantidade >= maximo || salvando} onClick={() => setQuantidade((q) => q + 1)}>
                <Plus size={16} strokeWidth={2} />
              </BotaoPasso>
            </div>
          </div>
          <Button
            fullWidth
            size="lg"
            disabled={salvando || quantidade === meusNaMesa || quantidade > maximo}
            onClick={() => marcar(quantidade)}
          >
            {salvando
              ? 'Salvando…'
              : meusNaMesa > 0 && quantidade === meusNaMesa
                ? `${plural(quantidade, 'lugar marcado', 'lugares marcados')} aqui`
                : meusNaMesa > 0
                ? quantidade === 0
                  ? 'Sair desta mesa'
                  : `Mudar para ${plural(quantidade, 'lugar', 'lugares')}`
                : `Marcar ${plural(quantidade, 'lugar', 'lugares')}`}
          </Button>
          {meusNaMesa > 0 && quantidade !== 0 ? (
            <Button variant="ghost" disabled={salvando} onClick={() => marcar(0)} style={{ alignSelf: 'center' }}>
              Sair desta mesa
            </Button>
          ) : null}
        </div>
      )}
      {erro ? <p style={{ margin: 0, fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</p> : null}
    </>
  ) : null;

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
      <PageHeader eyebrow="Área dos formandos" title="Mapa das mesas." />

      {!dados && link ? (
        // A personal link: nothing to type, just loading or a dead link.
        <Card padding="var(--space-7)">
          <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: erroAcesso ? 'var(--state-error)' : 'var(--text-muted)' }}>
            {erroAcesso ?? 'Abrindo o seu mapa…'}
          </p>
          {erroAcesso && !entrando ? (
            <div style={{ display: 'flex', marginTop: 'var(--space-5)' }}>
              <Button variant="secondary" onClick={entrar}>
                Tentar de novo
              </Button>
            </div>
          ) : null}
        </Card>
      ) : !dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              Cada formando marca a mesa pelo link pessoal que recebeu da comissão. Se você
              é formando, abra o seu link. Esta entrada é só da comissão.
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
              <Button size="lg" disabled={!codigo.trim() || entrando} onClick={entrar}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card padding={mobile ? 'var(--space-6)' : 'var(--space-7)'}>
            <div
              style={{
                display: 'flex',
                alignItems: mobile ? 'stretch' : 'flex-end',
                justifyContent: 'space-between',
                gap: 'var(--space-6)',
                flexDirection: mobile ? 'column' : 'row',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, maxWidth: '34rem' }}>
                {dados.comissao ? (
                  <Select
                    label="Marcando os lugares de"
                    options={FORMANDOS}
                    placeholder="Escolha um formando"
                    value={escolhido}
                    onChange={(e) => {
                      setEscolhido(e.target.value);
                      setSelecionada(null);
                    }}
                  />
                ) : (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.1 }}>
                    Olá, {nome.split(' ')[0]}.
                  </span>
                )}
                <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
                  {dados.comissao && !nome
                    ? 'Escolha um formando acima para marcar os lugares dele.'
                    : fechado
                      ? 'A comissão fechou o mapa. Ele fica só para consulta.'
                      : total === 0
                        ? 'A comissão ainda não cadastrou quantas pessoas você leva. Assim que cadastrar, você consegue marcar.'
                        : restante > 0
                          ? 'Toque numa mesa para ver quem está nela e marcar os seus lugares. Se couber, coloque todo mundo na mesma.'
                          : 'Todos os seus lugares estão marcados. Toque numa das suas mesas para mudar.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-7)' }}>
                <Numero label={total > 0 ? `você + ${total - 1}` : 'pessoas'} valor={total} />
                <Numero label="marcadas" valor={marcados} destaque />
                <Numero label="faltam" valor={restante} />
              </div>
            </div>
          </Card>

          <div ref={areaMapa} style={{ position: 'relative' }}>
            <Card padding={mobile ? 'var(--space-4)' : 'var(--space-7)'} style={{ overflow: 'hidden' }}>
              {mobile ? (
                <span style={{ display: 'block', marginBottom: 'var(--space-3)', ...rotuloCampo }}>Arraste para o lado para ver o mapa todo.</span>
              ) : null}
              <div ref={rolagemMapa} style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: mobile ? 660 : 560, maxWidth: 960, margin: '0 auto' }}>
                  <MapaMesas
                    mesas={dados.mesas}
                    reservas={dados.reservas}
                    formando={nome}
                    selecionada={selecionada}
                    onSelecionar={selecionar}
                    painel={mobile ? 'baixo' : ladoDoPainel}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginTop: 'var(--space-5)' }}>
                <Legenda cor="var(--gild-400)" texto="Seus lugares" />
                <Legenda cor="var(--ice-300)" texto="Outros formandos" />
                <Legenda cor="var(--smoke-300)" texto="Professores" />
                <Legenda texto="Livre" />
                <Legenda tracejada texto="Mesa reservada" />
              </div>
            </Card>

            {mesa && !mobile ? (
              <PainelMesa key={mesa.id} modo="ao-lado" lado={ladoDoPainel} onFechar={() => selecionar(null)}>
                {conteudoPainel}
              </PainelMesa>
            ) : null}
          </div>

          {mesa && mobile ? (
            <PainelMesa key={mesa.id} modo="folha" lado={ladoDoPainel} onFechar={() => selecionar(null)}>
              {conteudoPainel}
            </PainelMesa>
          ) : null}

          {dados.comissao ? <PainelComissao dados={dados} salvando={salvando} alterar={alterar} /> : null}

          {dados.comissao ? (
            <div style={{ display: 'flex' }}>
              <Button variant="ghost" onClick={sair}>
                Sair
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function Numero({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: '-.035em',
          lineHeight: 1,
          color: destaque ? 'var(--gild-400)' : undefined,
        }}
      >
        {valor}
      </span>
      <span style={rotuloCampo}>{label}</span>
    </div>
  );
}

function Legenda({ cor, texto, tracejada }: { cor?: string; texto: string; tracejada?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: cor ?? 'transparent',
          border: `1px ${tracejada ? 'dashed' : 'solid'} ${cor ?? 'var(--stroke-muted)'}`,
        }}
      />
      {texto}
    </span>
  );
}

function BotaoPasso({ rotulo, disabled, onClick, children }: { rotulo: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: disabled ? 'transparent' : 'rgba(245,245,247,.12)',
        color: 'var(--chalk-050)',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur) var(--ease-out)',
      }}
    >
      {children}
    </button>
  );
}

/**
 * The open table's details, in frosted glass: floating beside the map on a
 * wide screen (on the side away from the table), or rising from the bottom
 * edge as a sheet on a phone, where there's no room beside it.
 */
function PainelMesa({
  modo,
  lado,
  onFechar,
  children,
}: {
  modo: 'ao-lado' | 'folha';
  lado: 'esquerda' | 'direita';
  onFechar: () => void;
  children: ReactNode;
}) {
  const posicao: CSSProperties =
    modo === 'ao-lado'
      ? {
          position: 'absolute',
          top: '50%',
          [lado === 'direita' ? 'right' : 'left']: 24,
          width: 340,
          maxHeight: 'calc(100% - 48px)',
          transform: 'translateY(-50%)',
          borderRadius: 'var(--radius-lg)',
          animation: 'painel-ao-lado 560ms var(--ease-out) 140ms backwards',
        }
      : {
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          maxHeight: '60vh',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom))',
          animation: 'painel-folha 520ms var(--ease-snap) backwards',
        };

  return (
    <div
      role="dialog"
      aria-label="Detalhes da mesa"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        padding: 'var(--space-6)',
        overflowY: 'auto',
        background: 'rgba(30,30,32,.78)',
        backdropFilter: 'var(--blur-scrim)',
        WebkitBackdropFilter: 'var(--blur-scrim)',
        border: '1px solid var(--stroke-hair)',
        boxShadow: 'var(--shadow-overlay)',
        ...posicao,
      }}
    >
      {modo === 'folha' ? (
        <span aria-hidden style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, background: 'rgba(245,245,247,.24)', marginTop: -8 }} />
      ) : null}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        style={{
          position: 'absolute',
          top: modo === 'folha' ? 20 : 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(245,245,247,.12)',
          color: 'var(--chalk-050)',
          cursor: 'pointer',
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>
      {children}
    </div>
  );
}

/**
 * Only shown with the committee code: how many people each formando brings
 * (copied from the venue's portal) and the open/closed switch for the map.
 */
function PainelComissao({
  dados,
  salvando,
  alterar,
}: {
  dados: DadosMesas;
  salvando: boolean;
  alterar: (a: AlteracaoMesas) => Promise<string | null>;
}) {
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const marcadosPor = new Map<string, number>();
  for (const r of dados.reservas) marcadosPor.set(r.formando, (marcadosPor.get(r.formando) ?? 0) + r.lugares);
  const totalPessoas = dados.convidados.reduce((s, c) => s + c.total, 0);
  const professores = dados.mesas.reduce((s, m) => s + (m.ocupantes_fixos?.length ?? 0), 0);
  const capacidade = dados.mesas.reduce((s, m) => s + m.capacidade, 0);

  // The committee types each formando's guests only, as the venue's portal
  // lists them; the formando takes a seat too, so what's stored (and what
  // the map counts) is guests + 1.
  async function salvarTotal(formando: string, atual: number) {
    const texto = rascunho[formando];
    if (texto === undefined) return;
    const convidados = Number(texto);
    const total = convidados + 1;
    const descartar = () =>
      setRascunho((r) => {
        const resto = { ...r };
        delete resto[formando];
        return resto;
      });
    if (texto.trim() === '' || !Number.isInteger(convidados) || convidados < 0 || total === atual) {
      descartar();
      return;
    }
    const falha = await alterar({ definirConvidados: { formando, total } });
    setErro(falha);
    // On failure keep what was typed, so the committee sees what was refused.
    if (!falha) descartar();
  }

  async function alternarMapa() {
    setErro(await alterar({ definirMesasAbertas: !dados.abertas }));
  }

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-5)',
          flexWrap: 'wrap',
          padding: 'var(--space-6) var(--space-7)',
          borderBottom: '1px solid var(--stroke-hair)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={rotuloCampo}>Comissão · convidados e links por formando</span>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
            Digite só os convidados de cada formando, sem contar ele: o site soma o formando sozinho.
          </span>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
            {totalPessoas} pessoas da turma{professores ? ` e ${professores} professores` : ''} para {capacidade} lugares. Mapa{' '}
            {dados.abertas ? 'aberto para a turma' : 'fechado para a turma'}.
          </span>
          {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
        </div>
        <Button variant={dados.abertas ? 'secondary' : 'primary'} disabled={salvando} onClick={alternarMapa}>
          {dados.abertas ? 'Fechar mapa' : 'Abrir mapa'}
        </Button>
      </div>
      {dados.convidados.map((c) => {
        const marcados = marcadosPor.get(c.formando) ?? 0;
        const completo = c.total > 0 && marcados === c.total;
        return (
          <div
            key={c.formando}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-7)',
              borderBottom: '1px solid var(--stroke-hair)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 200px', alignItems: 'center', gap: 'var(--space-4)' }}>
              <span style={{ fontSize: 'var(--fs-body)' }}>{c.formando}</span>
              <input
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                placeholder="—"
                aria-label={`Convidados de ${c.formando}, sem contar o formando`}
                // 0 people stored means "not filled in yet": show an empty box, not "-1".
                value={rascunho[c.formando] ?? (c.total > 0 ? String(c.total - 1) : '')}
                onChange={(e) => setRascunho((r) => ({ ...r, [c.formando]: e.target.value }))}
                onBlur={() => salvarTotal(c.formando, c.total)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                style={{
                  height: 32,
                  width: '100%',
                  padding: '0 var(--space-3)',
                  background: 'rgba(244,247,250,.04)',
                  border: '1px solid var(--stroke-muted)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-body)',
                }}
              />
              <span style={{ fontSize: 'var(--fs-body-sm)', color: completo ? 'var(--state-ok)' : 'var(--text-faint)', textAlign: 'right' }}>
                {c.total > 0 ? `+1 = ${c.total} lugares · ${marcados} no mapa` : 'Falta preencher'}
              </span>
            </div>
            {c.link ? (
              <BotoesLink
                url={urlDoFormando(c.link)}
                mensagem={`Oi ${c.formando.split(' ')[0]}! Esse é o seu link para marcar a mesa da sua família na formatura. Não passe pra ninguém:`}
                // Known once the formando has entered the vote: the message
                // then opens straight in their chat.
                telefone={c.whatsapp}
                novoLink={{ formando: c.formando, salvando, onNovoLink: async () => setErro(await alterar({ novoLink: c.formando })) }}
              />
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}
