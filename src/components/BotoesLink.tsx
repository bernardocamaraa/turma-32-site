import { useState } from 'react';
import { Button } from './Button';

/**
 * What the committee does with a link: copy it, send it on WhatsApp with a
 * ready message — straight to the formando's chat when their number is
 * known — and, for a personal link, replace it if it leaked (the old one
 * stops working at once).
 */
export function BotoesLink({
  url,
  mensagem,
  telefone,
  novoLink,
}: {
  url: string;
  /** The WhatsApp message; the URL is appended to it. */
  mensagem: string;
  /** Digits with country code: opens that person's chat instead of asking whom to send to. */
  telefone?: string | null;
  /** Only for personal links: whose link it is, and how to replace it. */
  novoLink?: { formando: string; salvando: boolean; onNovoLink: () => void };
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard can be blocked (old browser, no permission): show the URL
      // so it can be copied by hand.
      window.prompt('Copie o link:', url);
    }
  }

  function trocar() {
    if (!novoLink) return;
    if (!window.confirm(`Gerar um link novo para ${novoLink.formando}? O link antigo para de funcionar na hora.`)) return;
    novoLink.onNovoLink();
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginLeft: -12 }}>
      <Button variant="ghost" size="sm" onClick={copiar}>
        {copiado ? 'Copiado' : 'Copiar link'}
      </Button>
      <Button
        as="a"
        variant="ghost"
        size="sm"
        target="_blank"
        rel="noreferrer"
        href={`https://wa.me/${telefone ?? ''}?text=${encodeURIComponent(`${mensagem} ${url}`)}`}
      >
        Mandar no WhatsApp
      </Button>
      {novoLink ? (
        <Button variant="ghost" size="sm" disabled={novoLink.salvando} onClick={trocar}>
          Novo link
        </Button>
      ) : null}
    </div>
  );
}
