const LOGO = '/assets/logo-32-pequena.png';

/**
 * The spinning ring, in the ice blue of the class logo, fading in from
 * nothing to white at its head. Sized by the text around it, so inside a
 * button it matches the label; `daCorDoTexto` paints it in the button's own
 * text color instead (the ice would vanish on a white pill).
 */
export function Roda({ daCorDoTexto = false }: { daCorDoTexto?: boolean }) {
  return <span aria-hidden className={daCorDoTexto ? 'roda roda-texto' : 'roda'} />;
}

/**
 * Something still on the way: the ring turning around the 32, and what's
 * happening under it. It only fades in after a moment, so a quick load
 * doesn't flash it. `tela` takes the room of a whole page (one still
 * downloading), the rest sits in a section of one.
 */
export function Carregando({ texto = 'Carregando…', tela = false }: { texto?: string; tela?: boolean }) {
  return (
    <div
      role="status"
      className="carregando"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-5)',
        minHeight: tela ? '60vh' : undefined,
        padding: tela ? 'var(--space-9) var(--gutter-page)' : 'var(--space-9) 0',
        textAlign: 'center',
      }}
    >
      <span aria-hidden style={{ position: 'relative', display: 'grid', placeItems: 'center', fontSize: 64 }}>
        <span className="roda roda-grande" />
        <img src={LOGO} alt="" className="carregando-logo" style={{ position: 'absolute', height: 30, width: 'auto' }} />
      </span>
      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-faint)' }}>{texto}</span>
    </div>
  );
}
