import { useState } from 'react';
import { SectionEyebrowRule } from './SectionHeading';

/**
 * Lívia's own words to the class about her place in the vote: she gave up
 * the place as orator to give the homage to the teachers (`abriram_mao` in
 * votacao.sql). Written by her; until she sends it, the chat shows her
 * typing. Paste her text here as is: line breaks are kept.
 */
const TEXTO = '';

/** Her profile picture: the whole photo, shown round. Until the file is there, her initials show instead. */
const FOTO = '/assets/livia-whitaker-perfil.jpg';

/**
 * Lívia's message to the class, laid out like a chat message: her picture
 * and name at the top, the message in a bubble. Shown on /resultados next
 * to the result it explains.
 */
export function MensagemDaLivia() {
  const [semFoto, setSemFoto] = useState(false);
  const escrevendo = TEXTO.trim() === '';

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', alignItems: 'center' }}>
      <SectionEyebrowRule>Mensagem da Lívia</SectionEyebrowRule>
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--stroke-hair)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        {/* The chat's top bar: who it's from, and to whom. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: '12px 16px', background: '#1f2c34' }}>
          {semFoto ? (
            <span
              aria-hidden
              style={{
                width: 42,
                height: 42,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                background: 'var(--wall-500)',
                color: 'var(--chalk-050)',
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              LW
            </span>
          ) : (
            <img
              src={FOTO}
              alt=""
              width={42}
              height={42}
              onError={() => setSemFoto(true)}
              style={{ flex: '0 0 auto', borderRadius: '50%', objectFit: 'cover', background: 'var(--wall-500)' }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: '#e9edef' }}>Lívia Whitaker</span>
            <span style={{ fontSize: 'var(--fs-caption)', color: escrevendo ? '#25d366' : '#8696a0' }}>
              {escrevendo ? 'digitando…' : 'para a Turma 32'}
            </span>
          </div>
        </div>

        {/* The conversation, on the chat's dark wallpaper. */}
        <div
          style={{
            padding: '20px 16px 24px',
            minHeight: 140,
            background: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 18px 18px, #0b141a',
          }}
        >
          <div className="bolha-recebida" style={{ maxWidth: escrevendo ? 'max-content' : '88%' }}>
            {escrevendo ? (
              <span className="digitando" role="img" aria-label="A Lívia ainda está escrevendo a mensagem">
                <span />
                <span />
                <span />
              </span>
            ) : (
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--fs-body)', lineHeight: 1.45, color: '#e9edef' }}>{TEXTO}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
