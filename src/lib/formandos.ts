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
 * Pires" → "maria-luiza-pires.png"). Só 29 dos 31 formandos têm assinatura
 * cadastrada até agora — os que faltam simplesmente não têm o arquivo, e a
 * lista mostra só o nome nesse caso.
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
  'maria-luiza-pires', 'matheus-veiga', 'pietra-machado', 'sophia-afonso',
  'susana-liu',
]);

/** The signature image of a graduate, or null while theirs hasn't arrived. */
export function assinaturaDe(nome: string): string | null {
  const slug = slugAssinatura(nome);
  return COM_ASSINATURA.has(slug) ? `/assets/assinaturas/${slug}.png` : null;
}
