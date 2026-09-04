import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { Input } from '../components/Input';
import { MapEmbed, MAPS_LINK } from '../components/MapEmbed';
import { CountdownRow, PageHeader } from '../components/SectionHeading';
import { Dialog } from '../components/Dialog';
import { useCountdown } from '../lib/countdown';
import { useIsMobile } from '../lib/useViewport';
import { enviarMensagem } from '../lib/supabase';

export function Baile() {
  const navigate = useNavigate();
  const countdown = useCountdown();
  const mobile = useIsMobile();

  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const naoPodeEnviar = !nome.trim() || !mensagem.trim() || enviando;

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await enviarMensagem({ nome: nome.trim(), mensagem: mensagem.trim() });
      setMensagem('');
      setEnviado(true);
    } catch (e) {
      setErro('Não foi possível enviar agora. Tente de novo em instantes.');
      console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 'var(--maxw-page)',
        margin: '0 auto',
        padding: 'var(--space-9) var(--gutter-page) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        animation: 'om-fade-up 620ms var(--ease-out) both',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <PageHeader eyebrow="O baile" title="Baile de formatura da Turma 32" />
        <p style={{ margin: 0, marginTop: 'calc(-1 * var(--space-4))', fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '60ch' }}>
          A colação de grau acontece no mesmo dia, no mesmo local, durante o baile. Uma noite só, do começo ao fim.
        </p>
      </div>

      <Card variant="tagged" padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.1fr .9fr' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-8)' }}>
            <div style={{ display: 'flex' }}>
              <Badge tone="gild">TRAJE ESPORTE FINO</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <Field label="Data" value="10 de dezembro de 2026" />
              <Field label="Chegada dos Formandos:" value="18h30" />
              <Field label="Abertura para convidados" value="19h" />
              <Field label="Local" value="Ballroom Casa de Festas · Nova Iguaçu" />
            </div>
            <div style={{ display: 'flex' }}>
              <Button size="lg" onClick={() => navigate('/rsvp')}>
                CONFIRMAR PRESENÇA
              </Button>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 'var(--space-6)',
              padding: 'var(--space-8)',
              background: 'var(--wall-500)',
              backgroundImage: 'url(/assets/wall-texture.png)',
              backgroundSize: '420px',
              backgroundBlendMode: 'overlay',
              ...(mobile ? { borderTop: '1px solid var(--stroke-hair)' } : { borderLeft: '1px solid var(--stroke-hair)' }),
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Colação de grau
              </span>
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '40ch' }}>
                Acontece durante o baile, no mesmo salão. Não há cerimônia em outro dia nem em outro endereço.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Falta
              </span>
              <CountdownRow {...countdown} />
            </div>
          </div>
        </div>
      </Card>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-6)', padding: 'var(--space-7) var(--space-8)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Como chegar
          </span>
          <Button variant="secondary" as="a" href={MAPS_LINK} target="_blank" rel="noopener noreferrer" iconLeft={<Icon name="map-pin" size={16} />}>
            Abrir no Maps
          </Button>
        </div>
        <div style={{ borderTop: '1px solid var(--stroke-hair)' }}>
          <MapEmbed height={360} />
        </div>
      </Card>

      <Card padding="var(--space-7)">
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
              Fale com a comissão
            </span>
            <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '52ch' }}>
              Dúvida sobre convite, presença ou traje? Escreva aqui e a comissão recebe.
            </p>
          </div>
          <Input label="Seu nome" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Sua mensagem
            </span>
            <textarea
              rows={4}
              placeholder="Escreva a sua dúvida"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                background: 'var(--ink-900)',
                color: 'var(--text-primary)',
                border: '1px solid var(--stroke-hair)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-4)',
                fontFamily: 'var(--font-core)',
                fontSize: 'var(--fs-body)',
                lineHeight: 'var(--lh-normal)',
              }}
            />
          </div>
          {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
          <Button size="lg" disabled={naoPodeEnviar} onClick={enviar}>
            {enviando ? 'ENVIANDO…' : 'ENVIAR MENSAGEM'}
          </Button>
        </div>
      </Card>

      <Dialog open={enviado} title="Mensagem enviada" onClose={() => setEnviado(false)} footer={<Button onClick={() => setEnviado(false)}>FECHAR</Button>}>
        A comissão recebeu a sua mensagem.
      </Dialog>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--fs-h4)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
