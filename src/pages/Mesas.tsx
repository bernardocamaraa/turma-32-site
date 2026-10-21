import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { MapaMesas } from '../components/MapaMesas';
import { Select } from '../components/Select';
import { PageHeader } from '../components/SectionHeading';
import { FORMANDOS } from '../lib/formandos';
import { buscarMesas, type AlteracaoMesas, type DadosMesas } from '../lib/mesas';
import { useIsMobile } from '../lib/useViewport';

const POLL_MS = 20000;
const CHAVE_LOGIN = 'turma32-mesas';

// Remembers who's on this device so a formando coming back doesn't retype
// the code. Storage can be blocked (private mode, previews) — then the page
// just asks again.
function lerLogin(): { nome: string; codigo: string } | null {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_LOGIN) ?? 'null');
    return salvo && typeof salvo.nome === 'string' && typeof salvo.codigo === 'string' ? salvo : null;
  } catch {
    return null;
  }
}

function salvarLogin(valor: { nome: string; codigo: string } | null) {
  try {
    if (valor) localStorage.setItem(CHAVE_LOGIN, JSON.stringify(valor));
    else localStorage.removeItem(CHAVE_LOGIN);
  } catch {
    // ignore — see lerLogin
  }
}

const rotuloCampo = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '.18em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-faint)',
};

export function Mesas() {
  const mobile = useIsMobile();
  const [nome, setNome] = useState(() => lerLogin()?.nome ?? '');
  const [codigo, setCodigo] = useState(() => lerLogin()?.codigo ?? '');
  const [dados, setDados] = useState<DadosMesas | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setEntrando(true);
    setErroAcesso(null);
    try {
      const resultado = await buscarMesas(codigo.trim());
      setDados(resultado);
      salvarLogin({ nome, codigo: codigo.trim() });
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
      salvarLogin(null);
    } finally {
      setEntrando(false);
    }
  }

  // Coming back on the same device: log straight in with what was saved.
  useEffect(() => {
    if (nome && codigo) entrar();
  }, []);

  // Other formandos are filling tables at the same time — refresh the map
  // every so often so the counts don't go stale while someone is deciding.
  const logado = dados !== null;
  useEffect(() => {
    if (!logado) return;
    let ativo = true;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const resultado = await buscarMesas(codigo.trim());
        if (ativo) setDados(resultado);
      } catch (e) {
        console.error(e);
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [logado, codigo]);

  /** Applies a change and returns the error message to show, or null if it worked. */
  async function alterar(alteracao: AlteracaoMesas): Promise<string | null> {
    setSalvando(true);
    try {
      setDados(await buscarMesas(codigo.trim(), alteracao));
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
    salvarLogin(null);
    setDados(null);
    setCodigo('');
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
  const ocupadosOutros = naMesa.reduce((s, r) => s + (r.formando === nome ? 0 : r.lugares), 0);
  const maximo = mesa ? Math.max(Math.min(mesa.capacidade - ocupadosOutros, meusNaMesa + restante), 0) : 0;
  const bloqueada = !!mesa?.reservada_para && !dados?.comissao;
  const fechado = !!dados && !dados.abertas && !dados.comissao;

  function selecionar(id: string) {
    setSelecionada(id);
    setErro(null);
    if (!dados) return;
    const m = dados.mesas.find((x) => x.id === id);
    const meus = dados.reservas.find((r) => r.mesa === id && r.formando === nome)?.lugares ?? 0;
    const outros = dados.reservas.filter((r) => r.mesa === id && r.formando !== nome).reduce((s, r) => s + r.lugares, 0);
    // Already seated here → start from that; otherwise suggest the whole
    // group, or as much of it as still fits.
    setQuantidade(meus > 0 ? meus : Math.max(Math.min(restante, (m?.capacidade ?? 0) - outros), 0));
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
        animation: 'om-fade-up 620ms var(--ease-out) both',
      }}
    >
      <PageHeader eyebrow="Área dos formandos" title="Mapa das mesas" />

      {!dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              Escolha seu nome e digite o código da turma para marcar a mesa da sua família.
              Cada mesa tem 10 lugares e vai enchendo conforme a turma marca.
            </p>
            <Select label="Seu nome" options={FORMANDOS} value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input
              label="Código da turma"
              placeholder="••••••"
              type="password"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setErroAcesso(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nome && codigo.trim() && !entrando) entrar();
              }}
            />
            {erroAcesso ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erroAcesso}</span> : null}
            <div style={{ display: 'flex' }}>
              <Button size="lg" disabled={!nome || !codigo.trim() || entrando} onClick={entrar}>
                {entrando ? 'ENTRANDO…' : 'ENTRAR'}
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
                <span style={rotuloCampo}>{dados.comissao ? 'Comissão · marcando lugares de' : 'Você'}</span>
                {dados.comissao ? (
                  <Select
                    options={FORMANDOS}
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      setSelecionada(null);
                      salvarLogin({ nome: e.target.value, codigo: codigo.trim() });
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 'var(--fs-h4)', fontFamily: 'var(--font-display)' }}>{nome}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                <Numero label="Pessoas" valor={total} />
                <Numero label="Marcadas" valor={marcados} destaque />
                <Numero label="Faltam" valor={restante} />
              </div>
            </div>
            <p style={{ margin: 'var(--space-4) 0 0', fontSize: 'var(--fs-body-sm)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              {fechado
                ? 'A comissão fechou o mapa. Ele fica só para consulta.'
                : total === 0
                  ? 'A comissão ainda não cadastrou quantas pessoas você leva. Assim que cadastrar, você consegue marcar.'
                  : restante > 0
                    ? `Toque numa mesa para marcar. Se couber, coloque todo mundo na mesma; se não, dá para dividir entre mesas vizinhas.`
                    : 'Todos os seus lugares estão marcados. Toque numa das suas mesas para mudar.'}
            </p>
          </Card>

          <Card padding={mobile ? 'var(--space-4)' : 'var(--space-6)'}>
            {mobile ? (
              <span style={{ display: 'block', marginBottom: 'var(--space-3)', ...rotuloCampo }}>Arraste para o lado para ver o mapa todo</span>
            ) : null}
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 560, maxWidth: 960, margin: '0 auto' }}>
                <MapaMesas mesas={dados.mesas} reservas={dados.reservas} formando={nome} selecionada={selecionada} onSelecionar={selecionar} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
              <Legenda cor="var(--gild-400)" texto="Seus lugares" />
              <Legenda cor="var(--ice-300)" texto="Outros formandos" />
              <Legenda texto="Livre" />
              <span style={{ ...rotuloCampo, letterSpacing: '.1em' }}>Borda tracejada: mesa reservada</span>
            </div>
          </Card>

          {mesa ? (
            <Card accent padding="var(--space-6)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h3)' }}>
                    Mesa {mesa.id}
                    {mesa.reservada_para ? (
                      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>
                        {' '}
                        · {mesa.reservada_para === 'professores' ? 'professores' : 'comissão'}
                      </span>
                    ) : null}
                  </h2>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
                    {ocupadosOutros + meusNaMesa} de {mesa.capacidade} ocupados
                  </span>
                </div>

                {naMesa.length > 0 ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {naMesa
                      .slice()
                      .sort((a, b) => a.formando.localeCompare(b.formando, 'pt-BR'))
                      .map((r) => (
                        <li key={r.formando} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: 'var(--fs-body)' }}>
                          <span style={{ color: r.formando === nome ? 'var(--gild-300)' : 'var(--text-primary)' }}>
                            {r.formando}
                            {r.formando === nome ? ' (você)' : ''}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {r.lugares} {r.lugares === 1 ? 'lugar' : 'lugares'}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Ninguém marcou essa mesa ainda.</span>
                )}

                {bloqueada ? (
                  <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
                    Essa mesa é reservada {mesa.reservada_para === 'professores' ? 'aos professores' : 'à comissão'}. Só a comissão marca lugares nela.
                  </span>
                ) : fechado ? null : maximo === 0 && meusNaMesa === 0 ? (
                  <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
                    {total === 0 ? 'Você ainda não tem lugares para distribuir.' : restante === 0 ? 'Você já marcou todos os seus lugares em outras mesas.' : 'Essa mesa está cheia.'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <span style={rotuloCampo}>Seus lugares aqui</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" size="sm" disabled={quantidade <= 0 || salvando} onClick={() => setQuantidade((q) => q - 1)} style={{ width: 36, padding: 0 }}>
                          −
                        </Button>
                        <span aria-live="polite" style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
                          {quantidade}
                        </span>
                        <Button variant="secondary" size="sm" disabled={quantidade >= maximo || salvando} onClick={() => setQuantidade((q) => q + 1)} style={{ width: 36, padding: 0 }}>
                          +
                        </Button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <Button
                        disabled={salvando || quantidade === meusNaMesa || quantidade > maximo}
                        onClick={() => marcar(quantidade)}
                      >
                        {salvando ? 'SALVANDO…' : meusNaMesa > 0 ? 'ATUALIZAR' : 'MARCAR'}
                      </Button>
                      {meusNaMesa > 0 ? (
                        <Button
                          variant="ghost"
                          disabled={salvando}
                          onClick={() => marcar(0)}
                        >
                          SAIR DESTA MESA
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
                {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
              </div>
            </Card>
          ) : null}

          {dados.comissao ? <PainelComissao dados={dados} salvando={salvando} alterar={alterar} /> : null}

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

function Numero({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={rotuloCampo}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1, color: destaque ? 'var(--gild-400)' : undefined }}>
        {String(valor).padStart(2, '0')}
      </span>
    </div>
  );
}

function Legenda({ cor, texto }: { cor?: string; texto: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: cor ?? 'transparent',
          border: `1px solid ${cor ?? 'var(--stroke-muted)'}`,
        }}
      />
      {texto}
    </span>
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
  const capacidade = dados.mesas.reduce((s, m) => s + m.capacidade, 0);

  async function salvarTotal(formando: string, atual: number) {
    const texto = rascunho[formando];
    if (texto === undefined) return;
    const total = Number(texto);
    const descartar = () =>
      setRascunho((r) => {
        const resto = { ...r };
        delete resto[formando];
        return resto;
      });
    if (texto.trim() === '' || !Number.isInteger(total) || total === atual) {
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
          <span style={rotuloCampo}>Comissão · pessoas por formando</span>
          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
            {totalPessoas} pessoas para {capacidade} lugares. Mapa {dados.abertas ? 'aberto para a turma' : 'fechado para a turma'}.
          </span>
          {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
        </div>
        <Button variant={dados.abertas ? 'secondary' : 'primary'} disabled={salvando} onClick={alternarMapa}>
          {dados.abertas ? 'FECHAR MAPA' : 'ABRIR MAPA'}
        </Button>
      </div>
      {dados.convidados.map((c) => {
        const marcados = marcadosPor.get(c.formando) ?? 0;
        const completo = c.total > 0 && marcados === c.total;
        return (
          <div
            key={c.formando}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 64px 112px',
              alignItems: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-7)',
              borderBottom: '1px solid var(--stroke-hair)',
            }}
          >
            <span style={{ fontSize: 'var(--fs-body)' }}>{c.formando}</span>
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              aria-label={`Pessoas de ${c.formando}`}
              value={rascunho[c.formando] ?? String(c.total)}
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)', color: completo ? 'var(--state-ok)' : 'var(--text-faint)', textAlign: 'right' }}>
              {marcados}/{c.total} no mapa
            </span>
          </div>
        );
      })}
    </Card>
  );
}
