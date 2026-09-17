import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { MapEmbed, MAPS_LINK } from '../components/MapEmbed';
import { CountdownRow, PageHeader, SectionEyebrowRule } from '../components/SectionHeading';
import { AvisoConfirmacao } from '../components/AvisoConfirmacao';
import { useCountdown } from '../lib/countdown';
import { useIsMobile } from '../lib/useViewport';

/**
 * Só entram aqui respostas que a comissão já fechou. Dúvidas cuja resposta
 * ainda depende da casa de festas (estacionamento, horário de encerramento,
 * cardápio) ficam de fora de propósito — melhor não responder do que
 * responder errado; quem perguntar cai no formulário do fim da página.
 */
const DUVIDAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: 'Como eu confirmo a minha presença?',
    resposta:
      'Falando direto com o formando que te convidou. É ele quem cadastra os convidados dele — não existe confirmação por este site.',
  },
  {
    pergunta: 'Posso levar mais alguém comigo?',
    resposta:
      'Cada formando tem uma quantidade de convites para distribuir. Se quiser levar mais alguém, combine antes com o formando que te convidou.',
  },
  {
    pergunta: 'Que horas eu devo chegar?',
    resposta:
      'Os convidados entram a partir das 19h. Os formandos chegam mais cedo, às 18h30, para a organização da entrada.',
  },
  {
    pergunta: 'A colação de grau é em outro dia ou em outro lugar?',
    resposta:
      'Não. A colação acontece na mesma noite, no mesmo salão, durante o baile. É um evento só, do começo ao fim.',
  },
  {
    pergunta: 'Qual é o traje?',
    resposta:
      'Passeio completo. Terno ou vestido longo/midi — e evite azul marinho, que é a cor usada pela turma.',
  },
  {
    pergunta: 'Posso tirar fotos durante a festa?',
    resposta:
      'Pode, e a gente quer ver! O álbum deste site abre durante o baile para todo mundo publicar as fotos da noite.',
  },
  {
    pergunta: 'Onde exatamente é a festa?',
    resposta:
      'No Ballroom Casa de Festas, em Nova Iguaçu. O mapa e o botão "Abrir no Maps" estão logo acima, nesta mesma página.',
  },
];

export function Baile() {
  const countdown = useCountdown();
  const mobile = useIsMobile();

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex' }}>
                <Badge tone="gild">TRAJE PASSEIO COMPLETO</Badge>
              </div>
              <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>
                Recomendamos evitar a cor azul marinho.
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <Field label="Data" value="10 de dezembro de 2026" />
              <Field label="Chegada dos formandos" value="18h30" />
              <Field label="Abertura para convidados" value="19h" />
              <Field label="Local" value="Ballroom Casa de Festas · Nova Iguaçu" />
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
              <Rotulo>Colação de grau</Rotulo>
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '40ch' }}>
                Acontece durante o baile, no mesmo salão. Não há cerimônia em outro dia nem em outro endereço.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--stroke-hair)' }}>
              <Rotulo>Falta</Rotulo>
              <CountdownRow {...countdown} />
            </div>
          </div>
        </div>
      </Card>

      <AvisoConfirmacao compact />

      <section id="traje" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <SectionEyebrowRule>Traje</SectionEyebrowRule>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-snug)' }}>
            Passeio completo
          </h2>
          <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', maxWidth: '60ch' }}>
            É uma noite de gala: vale caprichar. Abaixo, o que funciona bem — e
            o que é melhor deixar no armário.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2,1fr)', gap: 'var(--space-5)' }}>
          <Card padding="var(--space-7)" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Rotulo>Elas</Rotulo>
              <Lista
                itens={[
                  'Vestido longo ou midi de festa',
                  'Salto confortável — a noite é longa e tem pista',
                  'Maquiagem e cabelo de gala, se quiser caprichar',
                ]}
              />
            </div>
          </Card>
          <Card padding="var(--space-7)" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Rotulo>Eles</Rotulo>
              <Lista
                itens={[
                  'Terno completo, com gravata',
                  'Sapato social fechado',
                  'Smoking também é bem-vindo',
                ]}
              />
            </div>
          </Card>
        </div>

        <Card padding="var(--space-7)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Rotulo>Melhor evitar</Rotulo>
            <Lista
              tone="var(--gild-300)"
              itens={[
                'Azul marinho — é a cor usada pela turma na noite',
                'Jeans, bermuda, tênis e chinelo',
                'Look de praia ou esportivo',
              ]}
            />
          </div>
        </Card>
      </section>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: mobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: mobile ? 'var(--space-4)' : 'var(--space-6)',
            flexDirection: mobile ? 'column' : 'row',
            padding: mobile ? 'var(--space-6)' : 'var(--space-7) var(--space-8)',
          }}
        >
          <Rotulo>Como chegar</Rotulo>
          <Button variant="secondary" as="a" href={MAPS_LINK} target="_blank" rel="noopener noreferrer" iconLeft={<Icon name="map-pin" size={16} />}>
            Abrir no Maps
          </Button>
        </div>
        <div style={{ borderTop: '1px solid var(--stroke-hair)' }}>
          <MapEmbed height={360} />
        </div>
      </Card>

      <section id="duvidas" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <SectionEyebrowRule>Perguntas frequentes</SectionEyebrowRule>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-snug)' }}>
            As dúvidas de sempre
          </h2>
        </div>
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {DUVIDAS.map((d, i) => (
            <Duvida key={d.pergunta} {...d} primeira={i === 0} />
          ))}
        </Card>
      </section>

      {/* "Fale com a comissão" escondido enquanto o Supabase está pausado
          (reativa só daqui a 90 dias) — devolver quando o banco voltar ao ar. */}
    </main>
  );
}

function Duvida({ pergunta, resposta, primeira }: { pergunta: string; resposta: string; primeira: boolean }) {
  const [aberta, setAberta] = useState(false);

  return (
    <div style={{ borderTop: primeira ? 'none' : '1px solid var(--stroke-hair)' }}>
      <button
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
          width: '100%',
          padding: 'var(--space-6) var(--space-7)',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 'var(--fs-body-lg)',
          fontWeight: 600,
          lineHeight: 'var(--lh-snug)',
        }}
      >
        {pergunta}
        <Icon
          name="chevron-down"
          size={18}
          style={{
            flex: '0 0 auto',
            color: 'var(--accent)',
            transform: aberta ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--dur) var(--ease-out)',
          }}
        />
      </button>
      {aberta ? (
        <p
          style={{
            margin: 0,
            padding: '0 var(--space-7) var(--space-6)',
            fontSize: 'var(--fs-body)',
            lineHeight: 'var(--lh-normal)',
            color: 'var(--text-muted)',
            maxWidth: '68ch',
            animation: 'om-fade-up 260ms var(--ease-out) both',
          }}
        >
          {resposta}
        </p>
      ) : null}
    </div>
  );
}

function Lista({ itens, tone }: { itens: string[]; tone?: string }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {itens.map((item) => (
        <li key={item} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'baseline' }}>
          <span style={{ flex: '0 0 auto', width: 6, height: 6, borderRadius: '50%', background: tone ?? 'var(--accent)' }} />
          <span style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Rotulo>{label}</Rotulo>
      <span style={{ fontSize: 'var(--fs-h4)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
