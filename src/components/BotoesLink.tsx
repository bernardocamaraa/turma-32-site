import { useState } from 'react';
import { Button } from './Button';

/**
 * What the committee does with a formando's personal link — on the table
 * map and on the vote alike: copy it, send it on WhatsApp with a ready
 * message, or replace it if it leaked (the old one stops working at once).
 */
export function BotoesLink({
  formando,
  url,
  mensagem,
  salvando,
  onNovoLink,
}: {
  formando: string;
  url: string;
  /** The WhatsApp message; the URL is appended to it. */
  mensagem: string;
  salvando: boolean;
  onNovoLink: () => void;
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
    if (!window.confirm(`Gerar um link novo para ${formando}? O link antigo para de funcionar na hora.`)) return;
    onNovoLink();
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
        href={`https://wa.me/?text=${encodeURIComponent(`${mensagem} ${url}`)}`}
      >
        Mandar no WhatsApp
      </Button>
      <Button variant="ghost" size="sm" disabled={salvando} onClick={trocar}>
        Novo link
      </Button>
    </div>
  );
}
