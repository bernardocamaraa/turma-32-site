export type Formando = {
  nome: string;
  cota: number;
};

const NOMES = [
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
  'Maria Eduarda Oliveira',
  'Maria Luiza Pires',
  'Matheus Veiga',
  'Pietra Machado',
  'Sophia Afonso',
  'Suellen Bazillio',
  'Susana Liu',
];

/** Placeholder quota — every invitation currently allows 4 guests. Update per-formando if this varies. */
const COTA_PADRAO = 4;

export const FORMANDOS: Formando[] = NOMES.map((nome) => ({ nome, cota: COTA_PADRAO }));

export function cotaDe(nome: string): number {
  return FORMANDOS.find((f) => f.nome === nome)?.cota ?? 0;
}
