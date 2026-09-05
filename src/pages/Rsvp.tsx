import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Dialog } from '../components/Dialog';
import { FORMANDOS, cotaDe } from '../lib/formandos';
import { formatPhone } from '../lib/phone';
import { enviarRsvp } from '../lib/supabase';
import { clearConfirmacaoLocal, getConfirmacaoLocal, setConfirmacaoLocal } from '../lib/rsvpStorage';
import { useIsMobile } from '../lib/useViewport';

const NOMES_ORDENADOS = FORMANDOS.map((f) => f.nome);

export function Rsvp() {
  const [confirmacao, setConfirmacao] = useState(getConfirmacaoLocal);
  const [formando, setFormando] = useState('');
  const [nome, setNome] = useState('');
  const [whats, setWhats] = useState('');
  const [pessoas, setPessoas] = useState(1);
  const [acompanhantes, setAcompanhantes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const mobile = useIsMobile();

  const cota = formando ? cotaDe(formando) : 0;
  const opcoesPessoas = useMemo(() => Array.from({ length: cota || 0 }, (_, i) => i + 1), [cota]);
  const numAcompanhantes = pessoas - 1;
  const acompanhantesPreenchidos = acompanhantes.slice(0, numAcompanhantes).every((a) => a.trim());
  const naoPodeEnviar =
    !nome.trim() || !whats.trim() || !formando || (numAcompanhantes > 0 && !acompanhantesPreenchidos) || enviando;

  function escolherPessoas(n: number) {
    setPessoas(n);
    setAcompanhantes((atual) => {
      const proximo = atual.slice(0, n - 1);
      while (proximo.length < n - 1) proximo.push('');
      return proximo;
    });
  }

  function setNomeAcompanhante(i: number, valor: string) {
    setAcompanhantes((atual) => {
      const proximo = [...atual];
      proximo[i] = valor;
      return proximo;
    });
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const nomesAcompanhantes = acompanhantes.slice(0, numAcompanhantes).map((a) => a.trim());
    try {
      await enviarRsvp({
        formando,
        nome: nome.trim(),
        whatsapp: whats.trim(),
        pessoas,
        acompanhantes: nomesAcompanhantes,
      });
      const registro = { formando, nome: nome.trim(), pessoas, acompanhantes: nomesAcompanhantes };
      setConfirmacaoLocal(registro);
      setConfirmacao(registro);
      setDialogAberto(true);
    } catch (e) {
      const detalhe = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null;
      setErro(detalhe ? `Não foi possível confirmar agora: ${detalhe}` : 'Não foi possível confirmar agora. Tente de novo em instantes.');
      console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  function refazer() {
    clearConfirmacaoLocal();
    setConfirmacao(null);
    setFormando('');
    setNome('');
    setWhats('');
    setPessoas(1);
    setAcompanhantes([]);
  }

  return (
    <main
      style={{
        maxWidth: 'var(--maxw-page)',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'grid',
        gap: 'var(--space-8)',
        alignItems: 'start',
        gridTemplateColumns: mobile ? '1fr' : '1fr .8fr',
        animation: 'om-fade-up 620ms var(--ease-out) both',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
            Confirmação de presença
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
            Confirmar presença
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)', maxWidth: '48ch' }}>
            Baile de formatura da Turma 32 · <span style={{ fontFamily: 'var(--font-mono)' }}>10.12.2026 · 19h</span> · Ballroom Casa de Festas.
          </p>
        </div>

        {confirmacao ? (
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ display: 'flex' }}>
                <Badge tone="accent">PRESENÇA CONFIRMADA</Badge>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', maxWidth: '44ch' }}>
                {confirmacao.nome} · {confirmacao.pessoas} {confirmacao.pessoas === 1 ? 'lugar' : 'lugares'} no convite de {confirmacao.formando}.
              </p>
              {confirmacao.acompanhantes.length > 0 ? (
                <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-muted)' }}>
                  Acompanhantes: {confirmacao.acompanhantes.join(', ')}
                </span>
              ) : null}
              <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>
                Uma confirmação por convidado. Se algo estiver errado, refaça abaixo.
              </span>
              <div style={{ display: 'flex' }}>
                <Button variant="ghost" onClick={refazer}>
                  REFAZER MINHA CONFIRMAÇÃO
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="var(--space-7)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
              <Select
                label="Você é convidado de qual formando?"
                placeholder="Escolha o formando"
                options={NOMES_ORDENADOS}
                value={formando}
                onChange={(e) => {
                  setFormando(e.target.value);
                  setPessoas(1);
                }}
              />
              <Input label="Seu nome" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Input
                label="WhatsApp"
                placeholder="(21) 99999-9999"
                value={whats}
                onChange={(e) => setWhats(formatPhone(e.target.value))}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                  Quantas pessoas vêm
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {opcoesPessoas.map((n) => (
                    <Button
                      key={n}
                      variant={pessoas === n ? 'primary' : 'ghost'}
                      style={{ width: 56, height: 44, padding: 0 }}
                      onClick={() => escolherPessoas(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>
                  {formando
                    ? `O convite de ${formando} dá direito a ${cota} ${cota === 1 ? 'convidado' : 'convidados'}.`
                    : 'Escolha o formando para ver quantos convidados o convite permite.'}
                </span>
              </div>
              {numAcompanhantes > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  {Array.from({ length: numAcompanhantes }, (_, i) => (
                    <Input
                      key={i}
                      label={`Nome do acompanhante ${i + 1}`}
                      placeholder="Nome completo"
                      value={acompanhantes[i] ?? ''}
                      onChange={(e) => setNomeAcompanhante(i, e.target.value)}
                    />
                  ))}
                </div>
              ) : null}
              {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
              <Button fullWidth size="lg" disabled={naoPodeEnviar} onClick={enviar}>
                {enviando ? 'ENVIANDO…' : 'CONFIRMAR PRESENÇA'}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <Card variant="tagged" padding="var(--space-7)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Seu convite
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Formando
            </span>
            <span style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, lineHeight: 1.15 }}>{formando || 'Escolha na lista'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Convidados do convite
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
              {formando ? String(cota).padStart(2, '0') : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Prazo
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>30.11.2026 — depois disso a lista fecha</span>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--fs-body-sm)', lineHeight: 'var(--lh-normal)', color: 'var(--text-faint)', maxWidth: '36ch' }}>
            Escolha na lista o formando que te convidou. Cada convite tem o seu número de convidados.
          </p>
        </div>
      </Card>

      <Dialog
        open={dialogAberto}
        title="Presença confirmada"
        onClose={() => setDialogAberto(false)}
        footer={<Button onClick={() => setDialogAberto(false)}>FECHAR</Button>}
      >
        {nome.trim() || 'Presença'}, anotamos {pessoas} {pessoas === 1 ? 'lugar' : 'lugares'} no convite de {formando}.
        {numAcompanhantes > 0 ? ` Acompanhantes: ${acompanhantes.slice(0, numAcompanhantes).join(', ')}.` : ''}
      </Dialog>
    </main>
  );
}
