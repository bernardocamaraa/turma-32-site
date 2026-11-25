import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Minus, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { FORMANDOS } from '../lib/formandos';
import type { AlteracaoMesas, DadosMesas } from '../lib/mesas';
import { sugerirMesas } from '../lib/sugestaoMesas';
import { useIsMobile } from '../lib/useViewport';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { MapaMesas } from './MapaMesas';

const texto: CSSProperties = { margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' };
const pequeno: CSSProperties = { fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' };
const titulo: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h4)', fontWeight: 600, letterSpacing: '-.015em' };
const primeiroNome = (n: string) => n.split(' ')[0];

/**
 * Committee only: a second map, suggested by the site (lib/sugestaoMesas.ts)
 * from who brings how many people and the affinities kept below — never
 * changing the class's own map. Shows where each family would sit, why,
 * how many chairs each table needs, and lets the committee edit the groups.
 */
export function SugestaoMesas({
  dados,
  salvando,
  alterar,
}: {
  dados: DadosMesas;
  salvando: boolean;
  alterar: (a: AlteracaoMesas) => Promise<string | null>;
}) {
  const mobile = useIsMobile();
  const [maximo, setMaximo] = useState(12);
  const [semente, setSemente] = useState(32);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const afinidades = dados.afinidades ?? [];

  const sugestao = useMemo(
    () => sugerirMesas({ mesas: dados.mesas, convidados: dados.convidados, afinidades, maximo, semente }),
    [dados.mesas, dados.convidados, afinidades, maximo, semente],
  );
  const cadeiras = sugestao.mesas.reduce((s, m) => s + m.cadeiras, 0);
  const usadas = sugestao.mesas.filter((m) => m.cadeiras > 0).length;
  const aberta = sugestao.mesas.find((m) => m.id === selecionada) ?? null;

  async function copiarLista() {
    const linhas = sugestao.mesas
      .filter((m) => m.cadeiras > 0)
      .map((m) => `Mesa ${m.id} (${m.cadeiras} cadeiras): ${m.blocos.map((b) => `${b.formando} (${b.lugares})`).join(', ')}`);
    const conteudo = `Sugestão de mesas — Turma 32\n\n${linhas.join('\n')}`;
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie a lista:', conteudo);
    }
  }

  return (
    <Card padding={mobile ? 'var(--space-6)' : 'var(--space-7)'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', ...pequeno }}>
            <Sparkles size={16} color="var(--gild-300)" /> Comissão · sugestão de mapa
          </span>
          <span style={{ ...titulo, fontSize: 'var(--fs-h3)' }}>Uma sugestão de onde cada família senta</span>
          <p style={{ ...texto, maxWidth: '44rem' }}>
            Montada do zero pelo site, com quantas pessoas cada formando leva e os grupos de afinidade lá embaixo: cada família inteira numa mesa (as
            maiores que uma mesa, em mesas vizinhas), amigos e parentes na mesma mesa ou ao lado, e quem deve ficar longe, longe.{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Não muda nada no mapa da turma</strong>: é só para a comissão consultar.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Até</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderRadius: 'var(--radius-pill)', background: 'rgba(245,245,247,.08)' }}>
              <Passo rotulo="Menos cadeiras por mesa" desativado={maximo <= 6} onClick={() => setMaximo((m) => m - 1)}>
                <Minus size={16} />
              </Passo>
              <span aria-live="polite" style={{ minWidth: 30, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>
                {maximo}
              </span>
              <Passo rotulo="Mais cadeiras por mesa" desativado={maximo >= 20} onClick={() => setMaximo((m) => m + 1)}>
                <Plus size={16} />
              </Passo>
            </div>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>cadeiras por mesa</span>
          </div>
          <Button variant="secondary" size="sm" iconLeft={<RefreshCw size={15} />} onClick={() => setSemente((s) => s + 1)}>
            Tentar outra
          </Button>
          <Button variant="ghost" size="sm" onClick={copiarLista}>
            {copiado ? 'Lista copiada!' : 'Copiar a lista'}
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          <Numero rotulo="pessoas sentadas" valor={`${sugestao.pessoas - sugestao.semLugar.reduce((s, b) => s + b.lugares, 0)} de ${sugestao.pessoas}`} />
          <Numero rotulo={`cadeiras em ${usadas} mesas`} valor={String(cadeiras)} />
          <Numero rotulo="grupos juntos ou lado a lado" valor={`${sugestao.gruposAtendidos} de ${sugestao.grupos}`} destaque />
          <Numero rotulo="famílias em 2 mesas" valor={String(sugestao.divididos.length)} />
        </div>

        {sugestao.semLugar.length > 0 ? (
          <p style={{ ...texto, color: 'var(--state-error)' }}>
            Com até {maximo} cadeiras por mesa não cabe todo mundo: ficam sem lugar {sugestao.semLugar.map((b) => `${b.formando} (${b.lugares})`).join(', ')}. Aumente as cadeiras por mesa.
          </p>
        ) : null}
        {sugestao.separacoesQuebradas.length > 0 ? (
          <p style={{ ...texto, color: 'var(--gild-300)' }}>Não deu para afastar: {sugestao.separacoesQuebradas.join('; ')}.</p>
        ) : null}
        {sugestao.divididos.length > 0 ? (
          <p style={pequeno}>Em duas mesas vizinhas, por serem maiores que uma mesa: {sugestao.divididos.join(', ')}.</p>
        ) : null}

        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--stroke-hair)' }}>
          <MapaMesas mesas={sugestao.mapa.mesas} reservas={sugestao.mapa.reservas} formando="" selecionada={selecionada} onSelecionar={setSelecionada} />
        </div>

        {aberta ? (
          <Card variant="outline" padding="var(--space-5) var(--space-6)">
            <MesaDaSugestao mesa={aberta} />
          </Card>
        ) : (
          <p style={pequeno}>Toque numa mesa do mapa para ver quem senta nela e por quê.</p>
        )}

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-body)', fontWeight: 600 }}>Ver todas as mesas da sugestão</summary>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {sugestao.mesas.map((m) => (
              <Card key={m.id} variant="outline" padding="var(--space-4) var(--space-5)">
                <MesaDaSugestao mesa={m} />
              </Card>
            ))}
          </div>
        </details>

        <Afinidades dados={dados} salvando={salvando} alterar={alterar} />
      </div>
    </Card>
  );
}

function MesaDaSugestao({ mesa }: { mesa: ReturnType<typeof sugerirMesas>['mesas'][number] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>Mesa {mesa.id}</span>
        <span style={pequeno}>{mesa.cadeiras ? `${mesa.cadeiras} cadeiras` : 'livre (não precisa)'}</span>
      </div>
      {mesa.blocos.map((b) => (
        <span key={`${b.formando}-${b.lugares}`} style={{ fontSize: 'var(--fs-body-sm)' }}>
          {b.formando} <span style={{ color: 'var(--text-faint)' }}>· {b.lugares} {b.lugares === 1 ? 'pessoa' : 'pessoas'}</span>
        </span>
      ))}
      {mesa.motivos.map((m) => (
        <span key={m} style={{ fontSize: 13, color: 'var(--gild-300)' }}>
          {m}
        </span>
      ))}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(245,245,247,.05)' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: destaque ? 'var(--gild-300)' : undefined }}>{valor}</span>
      <span style={pequeno}>{rotulo}</span>
    </div>
  );
}

function Passo({ rotulo, desativado, onClick, children }: { rotulo: string; desativado: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desativado}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: desativado ? 'var(--text-faint)' : 'var(--chalk-050)',
        cursor: desativado ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/** The groups the suggestion uses: who sits together, who apart. Committee only. */
function Afinidades({ dados, salvando, alterar }: { dados: DadosMesas; salvando: boolean; alterar: (a: AlteracaoMesas) => Promise<string | null> }) {
  const [tipo, setTipo] = useState<'juntos' | 'longe'>('juntos');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const afinidades = dados.afinidades ?? [];
  const nomes = dados.convidados.length ? dados.convidados.map((c) => c.formando) : FORMANDOS;

  async function salvar() {
    setErro(null);
    const falha = await alterar({ salvarAfinidade: { tipo, pessoas: escolhidos } });
    if (falha) setErro(falha);
    else setEscolhidos([]);
  }
  async function apagar(id: string) {
    setErro(null);
    const falha = await alterar({ apagarAfinidade: id });
    if (falha) setErro(falha);
  }

  const lista = (t: 'juntos' | 'longe') => afinidades.filter((a) => a.tipo === t);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
      <span style={titulo}>Grupos de afinidade</span>
      <p style={pequeno}>A sugestão usa esses grupos. Só a comissão vê, e mudar aqui não mexe no mapa da turma.</p>

      {(['juntos', 'longe'] as const).map((t) => (
        <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>
            {t === 'juntos' ? 'Sentar juntos ou lado a lado' : 'Ficar longe'} · {lista(t).length}
          </span>
          {lista(t).length === 0 ? <span style={pequeno}>Nenhum grupo ainda.</span> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {lista(t).map((a) => (
              <span
                key={a.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  minHeight: 36,
                  padding: '4px 6px 4px 14px',
                  borderRadius: 'var(--radius-pill)',
                  background: t === 'juntos' ? 'rgba(169,211,232,.12)' : 'rgba(255,105,97,.12)',
                  fontSize: 'var(--fs-body-sm)',
                }}
              >
                {a.pessoas.map(primeiroNome).join(t === 'juntos' ? ' + ' : ' ↔ ')}
                <button
                  type="button"
                  aria-label={`Apagar o grupo ${a.pessoas.join(', ')}`}
                  disabled={salvando}
                  onClick={() => apagar(a.id)}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'rgba(245,245,247,.04)' }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>Novo grupo</span>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant={tipo === 'juntos' ? 'primary' : 'secondary'} size="sm" onClick={() => setTipo('juntos')}>
            Sentar juntos
          </Button>
          <Button variant={tipo === 'longe' ? 'primary' : 'secondary'} size="sm" onClick={() => setTipo('longe')}>
            Ficar longe
          </Button>
        </div>
        <span style={pequeno}>Toque nos nomes ({escolhidos.length} {escolhidos.length === 1 ? 'escolhido' : 'escolhidos'}):</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {nomes.map((n) => {
            const marcado = escolhidos.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={marcado}
                onClick={() => setEscolhidos((e) => (marcado ? e.filter((x) => x !== n) : [...e, n]))}
                style={{
                  minHeight: 36,
                  padding: '0 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: marcado ? '1px solid var(--gild-400)' : '1px solid var(--stroke-hair)',
                  background: marcado ? 'rgba(201,169,106,.18)' : 'transparent',
                  color: 'var(--chalk-050)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="gild" size="sm" disabled={escolhidos.length < 2 || escolhidos.length > 12} carregando={salvando} onClick={salvar}>
            Salvar grupo
          </Button>
          {escolhidos.length > 0 ? (
            <Badge>{escolhidos.map(primeiroNome).join(tipo === 'juntos' ? ' + ' : ' ↔ ')}</Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
