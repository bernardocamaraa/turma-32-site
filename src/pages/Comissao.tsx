import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/SectionHeading';
import { buscarDadosComissao, type ComissaoData } from '../lib/supabase';
import { useIsMobile } from '../lib/useViewport';

export function Comissao() {
  const mobile = useIsMobile();
  const [codigo, setCodigo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [dados, setDados] = useState<ComissaoData | null>(null);

  async function entrar() {
    setCarregando(true);
    setErroAcesso(null);
    try {
      const resultado = await buscarDadosComissao(codigo.trim());
      setDados(resultado);
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : 'Não foi possível entrar agora.');
    } finally {
      setCarregando(false);
    }
  }

  function sair() {
    setDados(null);
    setCodigo('');
  }

  function baixarPdf() {
    window.print();
  }

  function baixarCsv() {
    if (!dados) return;
    const linhas = [['convidado', 'formando', 'pessoas', 'whatsapp', 'quando']].concat(
      dados.rsvps.map((r) => [r.nome, r.formando, String(r.pessoas), r.whatsapp, r.criado_em]),
    );
    const csv = linhas.map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'turma32-confirmacoes.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      <PageHeader eyebrow="Área da comissão" title="Confirmações e mensagens" />

      {!dados ? (
        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
              Esta área é só da comissão. Digite o código combinado com a turma.
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
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: 'var(--space-5)' }}>
            <Stat label="Confirmações" value={pad(dados.rsvps.length)} />
            <Stat label="Pessoas confirmadas" value={pad(dados.rsvps.reduce((a, r) => a + r.pessoas, 0))} accent />
            <Stat label="Mensagens" value={pad(dados.mensagens.length)} />
          </div>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-5)', padding: 'var(--space-6) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Lista de presença
              </span>
              <div className="no-print" style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="ghost" onClick={baixarPdf}>
                  BAIXAR PDF
                </Button>
                <Button variant="ghost" onClick={baixarCsv}>
                  BAIXAR CSV
                </Button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr .5fr 1fr', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
                  {['Convidado', 'Formando', 'Pessoas', 'WhatsApp'].map((h) => (
                    <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                      {h}
                    </span>
                  ))}
                </div>
                {dados.rsvps.map((r) => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr .5fr 1fr', gap: 'var(--space-4)', padding: 'var(--space-5) var(--space-7)', borderBottom: '1px solid var(--stroke-hair)' }}>
                    <span style={{ fontSize: 'var(--fs-body)' }}>{r.nome}</span>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>{r.formando}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)' }}>{r.pessoas}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>{r.whatsapp}</span>
                  </div>
                ))}
              </div>
            </div>
            {dados.rsvps.length === 0 ? (
              <div style={{ padding: 'var(--space-7)' }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-faint)' }}>Ninguém confirmou ainda.</span>
              </div>
            ) : null}
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

          <div className="no-print" style={{ display: 'flex' }}>
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
