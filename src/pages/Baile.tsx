import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { CountdownRow, SectionEyebrowRule } from '../components/SectionHeading';
import { AvisoConfirmacao } from '../components/AvisoConfirmacao';
import { Bloco, Grande, MapaInclinado, Pequeno, Revela, Titulo } from '../components/Cena';
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
      'Falando direto com o formando que te convidou. É ele quem cadastra os convidados dele, não existe confirmação por este site.',
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
      'Passeio completo. Mais detalhes na parte "Traje", logo acima nesta página.',
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
  const secao = { maxWidth: 'var(--maxw-page)', margin: '0 auto', padding: 'var(--space-10) var(--gutter-page) 0' };

  return (
    <main style={{ paddingBottom: 'var(--space-11)' }}>
      <header style={{ ...secao, paddingTop: 'var(--space-10)', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-5)' }}>
          <div style={{ animation: 'om-rise 1400ms var(--ease-out) 80ms both' }}>
            <SectionEyebrowRule>O baile</SectionEyebrowRule>
          </div>
          <div style={{ animation: 'om-rise 1400ms var(--ease-out) 250ms both' }}>
            <Titulo como="h1" tamanho="var(--fs-display-2)">
              Uma noite só,
              <br />
              do começo ao fim.
            </Titulo>
          </div>
          <p
            style={{
              margin: 0,
              maxWidth: '36rem',
              fontSize: 'var(--fs-body-lg)',
              lineHeight: 'var(--lh-normal)',
              color: 'var(--text-muted)',
              animation: 'om-rise 1400ms var(--ease-out) 420ms both',
            }}
          >
            O baile de formatura da Turma 32 e a colação de grau acontecem juntos, no mesmo dia e no mesmo salão.
          </p>
        </div>
      </header>

      <section style={secao}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(6, 1fr)', gap: mobile ? 12 : 20 }}>
          <Bloco coluna={mobile ? undefined : 'span 3'} destaque>
            <Pequeno>Quinta-feira</Pequeno>
            <Grande tamanho="clamp(48px, 6vw, 80px)">10 de dezembro de 2026</Grande>
          </Bloco>
          <Bloco atraso={100} coluna={mobile ? undefined : 'span 3'}>
            <Pequeno>Faltam</Pequeno>
            <CountdownRow {...countdown} />
          </Bloco>
          <Bloco coluna={mobile ? undefined : 'span 2'}>
            <Pequeno>Chegada dos formandos</Pequeno>
            <Grande tamanho="clamp(48px, 5vw, 64px)">18h30</Grande>
          </Bloco>
          <Bloco atraso={100} coluna={mobile ? undefined : 'span 2'}>
            <Pequeno>Abertura para convidados</Pequeno>
            <Grande tamanho="clamp(48px, 5vw, 64px)">19h</Grande>
          </Bloco>
          <Bloco atraso={200} coluna={mobile ? undefined : 'span 2'}>
            <Pequeno>Colação de grau</Pequeno>
            <Grande tamanho="clamp(24px, 2.4vw, 30px)">Durante o baile, no mesmo salão.</Grande>
            <Pequeno>Não há cerimônia em outro dia nem em outro endereço.</Pequeno>
          </Bloco>
        </div>
      </section>

      <section style={secao}>
        <Revela>
          <AvisoConfirmacao compact />
        </Revela>
      </section>

      <section id="traje" style={secao}>
        <Revela style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: '44rem' }}>
          <SectionEyebrowRule>Traje</SectionEyebrowRule>
          <Titulo>Passeio completo.</Titulo>
          <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)' }}>
            É uma noite de gala: vale caprichar. O que é melhor deixar no armário são jeans, bermuda, tênis e
            chinelo, e qualquer look de praia ou esportivo.
          </p>
        </Revela>
      </section>

      <section style={secao}>
        <Revela style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
          <SectionEyebrowRule>Como chegar</SectionEyebrowRule>
          <Titulo>Ballroom Casa de Festas, Nova Iguaçu.</Titulo>
        </Revela>
        <MapaInclinado />
      </section>

      <section id="duvidas" style={secao}>
        <Revela style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', marginBottom: 'var(--space-7)' }}>
          <SectionEyebrowRule>Perguntas frequentes</SectionEyebrowRule>
          <Titulo>As dúvidas de sempre.</Titulo>
        </Revela>
        <Revela>
          <div style={{ borderTop: '1px solid var(--stroke-hair)' }}>
            {DUVIDAS.map((d) => (
              <Duvida key={d.pergunta} {...d} />
            ))}
          </div>
        </Revela>
      </section>

      {/* "Fale com a comissão" escondido enquanto o Supabase está pausado
          (reativa só daqui a 90 dias) — devolver quando o banco voltar ao ar. */}
    </main>
  );
}

/**
 * One question. The answer slides open (grid rows 0fr → 1fr, so the height
 * animates without measuring) and the plus turns into a cross.
 */
function Duvida({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();

  return (
    <div style={{ borderBottom: '1px solid var(--stroke-hair)' }}>
      <button
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        aria-controls={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
          width: '100%',
          minHeight: 72,
          padding: 'var(--space-5) 0',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-body-lg)',
          fontWeight: 600,
          letterSpacing: '-.015em',
          lineHeight: 'var(--lh-snug)',
        }}
      >
        {pergunta}
        <Plus
          size={22}
          strokeWidth={1.6}
          aria-hidden
          style={{
            flex: '0 0 auto',
            color: 'var(--text-muted)',
            transform: aberta ? 'rotate(45deg)' : 'none',
            transition: 'transform var(--dur-slow) var(--ease-out)',
          }}
        />
      </button>
      <div
        id={id}
        style={{
          display: 'grid',
          gridTemplateRows: aberta ? '1fr' : '0fr',
          transition: 'grid-template-rows var(--dur-slow) var(--ease-out)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <p
            style={{
              margin: 0,
              padding: '0 var(--space-8) var(--space-6) 0',
              fontSize: 'var(--fs-body)',
              lineHeight: 'var(--lh-normal)',
              color: 'var(--text-muted)',
              maxWidth: '44rem',
              opacity: aberta ? 1 : 0,
              transition: 'opacity var(--dur-slow) var(--ease-out)',
            }}
          >
            {resposta}
          </p>
        </div>
      </div>
    </div>
  );
}
