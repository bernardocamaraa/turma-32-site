/**
 * Os 31 formandos da turma: aparecem na página "A turma" e no seletor de
 * nome do mapa das mesas. O convite e a lista de convidados de cada formando
 * são tratados fora do site, no portal da casa de festas.
 *
 * Os mesmos nomes estão em `supabase/mesas.sql` (convidados_formando): se
 * mudar aqui, mude lá também, com a grafia idêntica.
 */
export const FORMANDOS: string[] = [
  'Anna Carolina Russo',
  'Anna Clara Ribeiro',
  'Arthur Caetano',
  'Arthur Oliveira',
  'Bernardo Câmara',
  'Bernardo Ignácio',
  'Caio Bezerra',
  'Carolina Warrak',
  'Enzo Louro',
  'Geovanna Russo',
  'Guilherme Warrak',
  'Isabella Guimarães',
  'Isabella Monteiro',
  'João Pedro Jardim',
  'Laís Boldrim',
  'Laura Viana',
  'Lívia Whitaker',
  'Lorenzo Nunes',
  'Lucas Loyola',
  'Lucas Varejão',
  'Luiza Goes',
  'Maian Costa',
  'Maria Clara Bispo',
  'Maria Clara França',
  'Maria Eduarda Barroso',
  'Maria Luiza Pires',
  'Matheus Veiga',
  'Pietra Machado',
  'Sophia Afonso',
  'Suellen Bazillio',
  'Susana Liu',
];

/**
 * Nomes viram o slug dos arquivos em /assets/assinaturas (ex.: "Maria Luiza
 * Pires" → "maria-luiza-pires.png"). Quem não estiver em COM_ASSINATURA
 * simplesmente não tem o arquivo, e a lista mostra só o nome nesse caso.
 */
function slugAssinatura(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const COM_ASSINATURA = new Set([
  'anna-carolina-russo', 'anna-clara-ribeiro', 'arthur-caetano', 'arthur-oliveira',
  'bernardo-camara', 'bernardo-ignacio', 'caio-bezerra', 'carolina-warrak',
  'enzo-louro', 'geovanna-russo', 'guilherme-warrak', 'isabella-guimaraes',
  'isabella-monteiro', 'joao-pedro-jardim', 'lais-boldrim', 'laura-viana',
  'livia-whitaker', 'lorenzo-nunes', 'lucas-loyola', 'lucas-varejao',
  'luiza-goes', 'maian-costa', 'maria-clara-bispo', 'maria-eduarda-barroso',
  'maria-clara-franca', 'maria-luiza-pires', 'matheus-veiga', 'pietra-machado',
  'sophia-afonso', 'suellen-bazillio', 'susana-liu',
]);

/** The signature image of a graduate, or null while theirs hasn't arrived. */
export function assinaturaDe(nome: string): string | null {
  const slug = slugAssinatura(nome);
  return COM_ASSINATURA.has(slug) ? `/assets/assinaturas/${slug}.png` : null;
}


/**
 * The signature of a name as the committee wrote it on a vote's options,
 * which isn't always the full name ("João Pedro", "Maian"): the graduate
 * with that exact name, or else the only one whose name starts with it.
 * Null when it matches no one, or more than one.
 */
export function assinaturaDoCandidato(nome: string): string | null {
  const chave = slugAssinatura(nome);
  if (!chave) return null;
  const exato = FORMANDOS.find((f) => slugAssinatura(f) === chave);
  if (exato) return assinaturaDe(exato);
  const comeca = FORMANDOS.filter((f) => slugAssinatura(f).startsWith(`${chave}-`));
  return comeca.length === 1 ? assinaturaDe(comeca[0]) : null;
}
