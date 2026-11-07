import { useState } from 'react';
import { normalizarWhatsapp } from '../lib/votacao';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { Select } from './Select';

const texto = { fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-muted)', margin: 0 };

/**
 * The way in for a formando on the class-wide pages (/votacao, /musica):
 * their WhatsApp. When the committee already has the number, that's all;
 * otherwise they pick their name among the ones with no number yet, and the
 * number gets tied to it (identificar_eleitor in votacao.sql).
 */
export function EntrarComWhatsapp({
  livres,
  entrando,
  erro,
  onEntrar,
  explicacao,
  botao,
}: {
  livres: string[];
  entrando: boolean;
  erro: string | null;
  /** Resolves to whether it worked, or 'semNome' when the number isn't on the list and a name is needed. */
  onEntrar: (whatsapp: string, nome?: string) => Promise<boolean | 'semNome'>;
  /** What the number is for, on this page. */
  explicacao: string;
  /** The button's label ("Entrar para votar"). */
  botao: string;
}) {
  const [numero, setNumero] = useState('');
  const [erroNumero, setErroNumero] = useState<string | null>(null);
  // Set once the number turned out not to be on the list.
  const [pedirNome, setPedirNome] = useState(false);
  const [nome, setNome] = useState('');
  const whatsapp = normalizarWhatsapp(numero);

  async function enviar() {
    if (!whatsapp) {
      setErroNumero('Esse número não parece um WhatsApp. Confira, por exemplo (21) 99999-9999.');
      return;
    }
    if (pedirNome && !nome) return;
    const resultado = await onEntrar(whatsapp, pedirNome ? nome : undefined);
    if (resultado === 'semNome') setPedirNome(true);
  }

  function corrigir() {
    setPedirNome(false);
    setNome('');
  }

  return (
    <Card padding="var(--space-7)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 420 }}>
        <p style={texto}>{explicacao}</p>
        <Input
          label="Seu WhatsApp"
          placeholder="(21) 99999-9999"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={numero}
          disabled={pedirNome}
          error={erroNumero ?? undefined}
          onChange={(e) => {
            setNumero(e.target.value);
            setErroNumero(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && numero.trim() && !entrando) enviar();
          }}
        />
        {pedirNome ? (
          livres.length > 0 ? (
            <>
              <p style={texto}>Esse número não está na lista da turma. Se ele estiver certo, escolha o seu nome:</p>
              <Select label="Seu nome" placeholder="Escolha o seu nome" options={livres} value={nome} onChange={(e) => setNome(e.target.value)} />
            </>
          ) : (
            <p style={texto}>Esse número não está na lista da turma. Confira se digitou certo ou fale com a comissão.</p>
          )
        ) : null}
        {erro ? <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--state-error)' }}>{erro}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {!pedirNome || livres.length > 0 ? (
            <Button size="lg" disabled={!numero.trim() || (pedirNome && !nome)} carregando={entrando} onClick={enviar}>
              {entrando ? 'Entrando…' : botao}
            </Button>
          ) : null}
          {pedirNome ? (
            <Button size="lg" variant="ghost" onClick={corrigir}>
              Corrigir o número
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
