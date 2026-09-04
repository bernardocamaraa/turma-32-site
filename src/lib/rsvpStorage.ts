export type Confirmacao = {
  formando: string;
  nome: string;
  pessoas: number;
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
    return raw ? (JSON.parse(raw) as Confirmacao) : null;
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
