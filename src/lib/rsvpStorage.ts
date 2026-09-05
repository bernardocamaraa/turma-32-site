export type Confirmacao = {
  formando: string;
  nome: string;
  pessoas: number;
  acompanhantes: string[];
};

const KEY = 'turma32-rsvp';

/**
 * The site has no login, so "one confirmation per guest" is enforced only in
 * this browser's storage — it stops accidental double-submits, not someone
 * clearing their cache or using another device/browser.
 */
export function getConfirmacaoLocal(): Confirmacao | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Confirmacao>;
    // Older confirmations (saved before "acompanhantes" existed) won't have it.
    return { formando: parsed.formando ?? '', nome: parsed.nome ?? '', pessoas: parsed.pessoas ?? 1, acompanhantes: parsed.acompanhantes ?? [] };
  } catch {
    return null;
  }
}

export function setConfirmacaoLocal(value: Confirmacao) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* localStorage unavailable — confirmation still recorded server-side */
  }
}

export function clearConfirmacaoLocal() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
