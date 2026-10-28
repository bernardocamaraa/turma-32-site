// Remembers the committee code on this device so the committee area
// (/comissao, every tab) doesn't ask for it on every visit. Formandos don't
// need this: their own pages have their own way in. Storage can be blocked
// (private mode, previews) — then the area just asks. The key keeps its old
// name so codes saved before the area existed still work.

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
