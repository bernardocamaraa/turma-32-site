/**
 * The committee's suggested seating: a second map, made by the site, that
 * never touches the class's own (it changes nothing in the database). It
 * starts from scratch — who brings how many people, the tables, and the
 * affinities the committee keeps (who sits together, who apart) — and looks
 * for the arrangement where:
 *   - each formando's family sits whole at one table; a family bigger than a
 *     table splits in as few parts as possible, on neighbouring tables;
 *   - groups of friends and families sit at the same table, or at
 *     neighbouring ones;
 *   - pairs to keep apart are not at the same table nor next to each other;
 *   - no table has more than `maximo` chairs.
 * It tries a few thousand arrangements (from a fixed seed, so the same data
 * gives the same map; "Tentar outra" changes the seed) and keeps the best.
 */
import { POSICOES_MESAS, type Afinidade, type ConvidadosFormando, type Mesa, type Reserva } from './mesas';

/** A part of one formando's family: the whole family, or a piece of a family bigger than a table. */
type Bloco = { formando: string; lugares: number };

export type MesaSugerida = {
  id: string;
  /** Chairs it needs: exactly the people seated (0 for a table left free). */
  cadeiras: number;
  blocos: Bloco[];
  /** Why these people are together: the groups fully at this table or its neighbours. */
  motivos: string[];
};

export type Sugestao = {
  mesas: MesaSugerida[];
  /** In the map's own shape, to draw it with MapaMesas. */
  mapa: { mesas: Mesa[]; reservas: Reserva[] };
  pessoas: number;
  /** Families split in two (or more) tables. */
  divididos: string[];
  /** "Juntos" groups whose members all ended at the same or neighbouring tables, out of all. */
  gruposAtendidos: number;
  grupos: number;
  /** "Longe" pairs that ended at the same or neighbouring tables (should be 0). */
  separacoesQuebradas: string[];
  /** People who didn't fit at all (only if the tables are too few for everyone). */
  semLugar: Bloco[];
};

// ---------------------------------------------------------------------------

const LARGURA = 602;
const ALTURA = 336;

/** Distance between two tables' centres, in the floor plan's px. */
function distancias(ids: string[]) {
  const pos = new Map(POSICOES_MESAS.map((p) => [p.id, { x: (p.x * LARGURA) / 100, y: (p.y * ALTURA) / 100 }]));
  const d = new Map<string, number>();
  for (const a of ids)
    for (const b of ids) {
      const pa = pos.get(a);
      const pb = pos.get(b);
      d.set(`${a}|${b}`, pa && pb ? Math.hypot(pa.x - pb.x, pa.y - pb.y) : 9999);
    }
  return d;
}

/**
 * How close two tables are, 0 to 1: the same table 1; next to each other
 * (the plan's neighbours are 50–65 px apart) 0.6; one table between them
 * 0.25; farther, 0.
 */
function proximidade(dist: number) {
  if (dist === 0) return 1;
  if (dist <= 70) return 0.6;
  if (dist <= 135) return 0.25;
  return 0;
}
const VIZINHAS = 0.6;

/** A small seeded random generator (mulberry32): the same seed, the same map. */
function aleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A family split in as few parts as fit, as even as possible: 17 → 9 + 8 with 12-chair tables. */
function blocosDe(c: ConvidadosFormando, maximo: number): Bloco[] {
  if (c.total <= 0) return [];
  const partes = Math.ceil(c.total / maximo);
  const base = Math.floor(c.total / partes);
  return Array.from({ length: partes }, (_, i) => ({ formando: c.formando, lugares: base + (i < c.total % partes ? 1 : 0) }));
}

const juntar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`);
const primeiro = (n: string) => n.split(' ')[0];

export function sugerirMesas(entrada: {
  mesas: Mesa[];
  convidados: ConvidadosFormando[];
  afinidades: Afinidade[];
  maximo: number;
  semente?: number;
}): Sugestao {
  const { maximo } = entrada;
  // The tables the class sits at (not the teachers').
  const ids = entrada.mesas.filter((m) => !m.reservada_para).map((m) => m.id);
  const dist = distancias(ids);
  const perto = (a: string, b: string) => proximidade(dist.get(`${a}|${b}`) ?? 9999);

  const blocos = entrada.convidados.flatMap((c) => blocosDe(c, maximo));
  // Who each formando should be near (weight > 0) or away from (< 0), summed over the groups.
  const peso = new Map<string, number>();
  const somar = (a: string, b: string, w: number) => {
    if (a === b) return;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    peso.set(k, (peso.get(k) ?? 0) + w);
  };
  for (const g of entrada.afinidades) {
    for (let i = 0; i < g.pessoas.length; i++)
      for (let j = i + 1; j < g.pessoas.length; j++) somar(g.pessoas[i], g.pessoas[j], g.tipo === 'juntos' ? 1 : -4);
  }
  const pesoEntre = (a: string, b: string) => (a === b ? 6 : (peso.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 0));

  // Each "juntos" group as the indexes of its members' family parts: a
  // group whose parts are all at the same or neighbouring tables earns a
  // bonus on top of its pairs (that's what the committee is counting).
  const gruposIdx = entrada.afinidades
    .filter((g) => g.tipo === 'juntos')
    .map((g) => blocos.flatMap((b, i) => (g.pessoas.includes(b.formando) ? [i] : [])))
    .filter((idx) => idx.length > 1);
  const BONUS_GRUPO = 2;

  // Only the pairs that matter, as indexes into `blocos`: much faster to score.
  const pares: [number, number, number][] = [];
  for (let i = 0; i < blocos.length; i++)
    for (let j = i + 1; j < blocos.length; j++) {
      const w = pesoEntre(blocos[i].formando, blocos[j].formando);
      if (w) pares.push([i, j, w]);
    }

  /**
   * One attempt from a starting point (`semente`): a first arrangement, then
   * many small changes. Resolves to where each family sits and how good that is.
   */
  function tentar(semente: number) {
    const sorte = aleatorio(semente);
    const ocupacao = new Map(ids.map((id) => [id, 0]));
    const onde: (string | null)[] = blocos.map(() => null);

    /** How good an arrangement is: the closer the pairs that should be close (and the farther the ones that shouldn't), the better. */
    function nota() {
      let s = 0;
      for (const [i, j, w] of pares) {
        const a = onde[i];
        const b = onde[j];
        if (!a || !b) continue;
        const p = perto(a, b);
        // Apart pairs only count when close; together pairs get the closeness.
        s += w * p;
      }
      // A whole group together or side by side.
      for (const idx of gruposIdx) {
        let junto = true;
        for (let a = 0; a < idx.length && junto; a++)
          for (let b = a + 1; b < idx.length; b++) {
            const ma = onde[idx[a]];
            const mb = onde[idx[b]];
            if (!ma || !mb || perto(ma, mb) < VIZINHAS) {
              junto = false;
              break;
            }
          }
        if (junto) s += BONUS_GRUPO;
      }
      // Someone left without a seat is much worse than anything else.
      for (let i = 0; i < blocos.length; i++) if (!onde[i]) s -= 1000 * blocos[i].lugares;
      return s;
    }

    // A first arrangement: the biggest families first, each where it scores best and fits.
    const ordem = blocos.map((_, i) => i).sort((a, b) => blocos[b].lugares - blocos[a].lugares);
    for (const i of ordem) {
      let melhor: string | null = null;
      let melhorNota = -Infinity;
      for (const id of ids) {
        if ((ocupacao.get(id) ?? 0) + blocos[i].lugares > maximo) continue;
        onde[i] = id;
        // Prefer tables already with company it likes; then fuller ones (to leave whole tables free for big families).
        const n = nota() + (ocupacao.get(id) ?? 0) * 0.01 + sorte() * 0.001;
        if (n > melhorNota) {
          melhorNota = n;
          melhor = id;
        }
        onde[i] = null;
      }
      if (melhor) {
        onde[i] = melhor;
        ocupacao.set(melhor, (ocupacao.get(melhor) ?? 0) + blocos[i].lugares);
      }
    }

    // Then improve it: move one family, or swap two, keep what's better
    // (and sometimes, early on, something slightly worse — not to get stuck).
    let atual = nota();
    const passos = 20000;
    for (let k = 0; k < passos; k++) {
      const temperatura = 0.6 * (1 - k / passos);
      const i = Math.floor(sorte() * blocos.length);
      const de = onde[i];
      if (sorte() < 0.5) {
        // Move.
        const para = ids[Math.floor(sorte() * ids.length)];
        if (para === de || (ocupacao.get(para) ?? 0) + blocos[i].lugares > maximo) continue;
        onde[i] = para;
        const nova = nota();
        if (nova >= atual || sorte() < Math.exp((nova - atual) / Math.max(temperatura, 1e-6))) {
          if (de) ocupacao.set(de, (ocupacao.get(de) ?? 0) - blocos[i].lugares);
          ocupacao.set(para, (ocupacao.get(para) ?? 0) + blocos[i].lugares);
          atual = nova;
        } else onde[i] = de;
      } else {
        // Swap with a family at another table, if both fit.
        const j = Math.floor(sorte() * blocos.length);
        const para = onde[j];
        if (!de || !para || de === para) continue;
        const dif = blocos[j].lugares - blocos[i].lugares;
        if ((ocupacao.get(de) ?? 0) + dif > maximo || (ocupacao.get(para) ?? 0) - dif > maximo) continue;
        onde[i] = para;
        onde[j] = de;
        const nova = nota();
        if (nova >= atual || sorte() < Math.exp((nova - atual) / Math.max(temperatura, 1e-6))) {
          ocupacao.set(de, (ocupacao.get(de) ?? 0) + dif);
          ocupacao.set(para, (ocupacao.get(para) ?? 0) - dif);
          atual = nova;
        } else {
          onde[i] = de;
          onde[j] = para;
        }
      }
    }
    return { onde, nota: atual };
  }

  // A few attempts from different starting points; the best one wins (one
  // attempt alone can get stuck in an arrangement that's good, not the best).
  const base = entrada.semente ?? 32;
  let melhorTentativa = tentar(base);
  for (let t = 1; t < 16; t++) {
    const outra = tentar(base * 7919 + t * 104729);
    if (outra.nota > melhorTentativa.nota) melhorTentativa = outra;
  }
  const onde = melhorTentativa.onde;

  // ---- The result, explained ----
  const mesaDe = (f: string) => blocos.flatMap((b, i) => (b.formando === f && onde[i] ? [onde[i]!] : []));
  const juntosOuVizinhos = (nomes: string[]) => {
    const mesas = nomes.flatMap(mesaDe);
    return mesas.length > 0 && mesas.every((a) => mesas.every((b) => perto(a, b) >= VIZINHAS));
  };
  const gruposJuntos = entrada.afinidades.filter((g) => g.tipo === 'juntos');
  const atendidos = gruposJuntos.filter((g) => juntosOuVizinhos(g.pessoas));
  const separacoesQuebradas = entrada.afinidades
    .filter((g) => g.tipo === 'longe')
    .flatMap((g) => {
      const quebrados: string[] = [];
      for (let i = 0; i < g.pessoas.length; i++)
        for (let j = i + 1; j < g.pessoas.length; j++) {
          const a = mesaDe(g.pessoas[i]);
          const b = mesaDe(g.pessoas[j]);
          if (a.some((x) => b.some((y) => perto(x, y) >= VIZINHAS))) quebrados.push(`${g.pessoas[i]} e ${g.pessoas[j]}`);
        }
      return quebrados;
    });

  const mesasSugeridas: MesaSugerida[] = ids.map((id) => {
    const daMesa = blocos.filter((_, i) => onde[i] === id).sort((a, b) => b.lugares - a.lugares || a.formando.localeCompare(b.formando, 'pt-BR'));
    const aqui = new Set(daMesa.map((b) => b.formando));
    const motivos = atendidos
      .filter((g) => g.pessoas.some((p) => aqui.has(p)))
      .map((g) => {
        const naMesa = g.pessoas.filter((p) => aqui.has(p));
        const vizinhos = g.pessoas.filter((p) => !aqui.has(p));
        return vizinhos.length
          ? `${juntar(naMesa.map(primeiro))} perto de ${juntar(vizinhos.map(primeiro))} (mesa vizinha)`
          : `${juntar(naMesa.map(primeiro))} juntos`;
      });
    return { id, cadeiras: daMesa.reduce((s, b) => s + b.lugares, 0), blocos: daMesa, motivos };
  });

  const reservas: Reserva[] = [];
  blocos.forEach((b, i) => {
    if (!onde[i]) return;
    const ja = reservas.find((r) => r.formando === b.formando && r.mesa === onde[i]);
    if (ja) ja.lugares += b.lugares;
    else reservas.push({ formando: b.formando, mesa: onde[i]!, lugares: b.lugares });
  });
  const mapaMesas: Mesa[] = entrada.mesas.map((m) => {
    if (m.reservada_para) return m;
    const s = mesasSugeridas.find((x) => x.id === m.id);
    // A table left free still gets drawn: with the usual 10, all empty.
    return { ...m, capacidade: s && s.cadeiras > 0 ? s.cadeiras : 10 };
  });

  return {
    mesas: mesasSugeridas,
    mapa: { mesas: mapaMesas, reservas },
    pessoas: blocos.reduce((s, b) => s + b.lugares, 0),
    divididos: [...new Set(blocos.map((b) => b.formando))].filter((f) => new Set(mesaDe(f)).size > 1),
    gruposAtendidos: atendidos.length,
    grupos: gruposJuntos.length,
    separacoesQuebradas,
    semLugar: blocos.filter((_, i) => !onde[i]),
  };
}
