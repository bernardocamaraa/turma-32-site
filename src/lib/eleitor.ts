// Remembers which formando is using this phone (their WhatsApp), so the
// number isn't retyped on every visit — shared by the vote (/votacao) and
// the stairs song (/musica): entering one enters the other. Storage can be
// blocked (private mode) — then the page just asks again. The key keeps the
// vote's name so numbers saved before /musica existed still work.

const CHAVE_ELEITOR = 'turma32-votacao-eleitor';

export function lerEleitor(): { whatsapp: string } | null {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ELEITOR) ?? 'null');
    return salvo && typeof salvo.whatsapp === 'string' ? { whatsapp: salvo.whatsapp } : null;
  } catch {
    return null;
  }
}

export function salvarEleitor(valor: { whatsapp: string } | null) {
  try {
    if (valor) localStorage.setItem(CHAVE_ELEITOR, JSON.stringify(valor));
    else localStorage.removeItem(CHAVE_ELEITOR);
  } catch {
    // ignore — see above
  }
}
