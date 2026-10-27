// Remembers the committee code on this device so it isn't retyped on every
// visit, and is shared by the table map and the vote. Formandos don't need
// this: their personal link is the login. Storage can be blocked (private
// mode, previews) — then the page just asks.

const CHAVE_CODIGO = 'turma32-mesas-comissao';

export function lerCodigo(): string {
  try {
    return localStorage.getItem(CHAVE_CODIGO) ?? '';
  } catch {
    return '';
  }
}

export function salvarCodigo(valor: string | null) {
  try {
    if (valor) localStorage.setItem(CHAVE_CODIGO, valor);
    else localStorage.removeItem(CHAVE_CODIGO);
  } catch {
    // ignore — see above
  }
}
