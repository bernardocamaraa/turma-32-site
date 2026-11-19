// Draws the ready-made sticker models the committee can put on sale in one
// click (tab "Adesivos" → "Modelos prontos"): round, 1181 px across like the
// childhood sticker's model, transparent outside the circle. They're built
// from the class's own pieces — the 32 (spray and plain), the Terceirão
// logo, the signatures, the wall texture — in its colours: black, white,
// the 32's ice-blue shadow, the childhood sticker's blue and the ball's gold.
//
//   public/adesivos-prontos/<id>.png   one per model in MODELOS below
//   src/lib/adesivosProntos.ts         the list the site shows (names, descriptions)
//
// Run again after changing a design:
//   node scripts/gerar-adesivos.mjs
// Or only some:  node scripts/gerar-adesivos.mjs selo
// Needs Playwright, like gerar-previas.mjs. Uses the installed "Inter
// Display" if present (Arial otherwise) and Roboto Slab from scripts/fontes
// (the typeface of the childhood sticker).

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dados = (arquivo, tipo) => `data:${tipo};base64,${readFileSync(join(raiz, arquivo)).toString('base64')}`;
const img = (nome) => dados(`public/assets/${nome}`, 'image/png');

const LOGO = img('logo-32.png');
const LISO = img('logo-32-liso.png');
const TERCEIRAO = img('logo-terceirao.png');
const ASSINATURAS = img('assinaturas-mural.png');
const MURO = img('wall-texture.png');
const SLAB_700 = dados('scripts/fontes/roboto-slab-700.woff2', 'font/woff2');
const SLAB_900 = dados('scripts/fontes/roboto-slab-900.woff2', 'font/woff2');

const L = 1181;
const C = L / 2;
const SLAB = "'Slab', Georgia, serif";
const DISPLAY = "'Inter Display', Inter, Arial, sans-serif";
const AZUL = '#2b5b91';
const GELO = '#a9d3e8';
const GELO_FORTE = '#6fc3f2';
const OURO = ['#efe0bd', '#dcc48c', '#c9a96a', '#a4854a'];

/** A path for text along a circle of radius r: over the top (reads left to right) or under the bottom. */
function arco(id, r, embaixo = false) {
  return embaixo
    ? `<path id="${id}" d="M ${C - r} ${C} A ${r} ${r} 0 0 0 ${C + r} ${C}" fill="none"/>`
    : `<path id="${id}" d="M ${C - r} ${C} A ${r} ${r} 0 0 1 ${C + r} ${C}" fill="none"/>`;
}

/** Text on an arc, centred. `graus`: how much of the circle it spans (the letters spread to fill it). */
function textoNoArco(id, r, texto, { tamanho, cor, fonte = SLAB, peso = 700, graus, contorno }) {
  const comprimento = graus ? ` textLength="${((r * graus * Math.PI) / 180).toFixed(1)}" lengthAdjust="spacing"` : '';
  const traco = contorno ? ` stroke="${contorno.cor}" stroke-width="${contorno.largura}" paint-order="stroke" stroke-linejoin="round"` : '';
  return `<text font-family="${fonte}" font-weight="${peso}" font-size="${tamanho}" fill="${cor}"${traco}>
    <textPath href="#${id}" startOffset="50%" text-anchor="middle"${comprimento}>${texto}</textPath></text>`;
}

/** A six-pointed star, like the childhood sticker's. */
function estrela(x, y, r, cor) {
  const p = [];
  for (let i = 0; i < 12; i++) {
    const raio = i % 2 === 0 ? r : r * 0.6;
    const a = (Math.PI / 6) * i;
    p.push(`${(x + raio * Math.cos(a)).toFixed(1)},${(y + raio * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${cor}"/>`;
}

/** Three stars down each side, as on the childhood sticker. */
const estrelasDosLados = (cor, x = 92) =>
  [-1, 1].map((lado) => [[-124, 27], [0, 47], [124, 27]].map(([dy, r]) => estrela(lado < 0 ? x : L - x, C + dy, r, cor)).join('')).join('');

/** An image centred at (x, y), `largura` wide, keeping its proportions. */
const imagem = (src, x, y, largura, altura, extra = '') =>
  `<image href="${src}" x="${x - largura / 2}" y="${y - altura / 2}" width="${largura}" height="${altura}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;

const MODELOS = [
  {
    id: 'terceirao',
    nome: 'Terceirão',
    descricao: 'O logo do Terceirão no azul do adesivo de criança, com a data do baile.',
    svg: () => `
      <defs>${arco('t', 470)}${arco('b', 540, true)}</defs>
      <circle cx="${C}" cy="${C}" r="${C}" fill="${AZUL}"/>
      <circle cx="${C}" cy="${C}" r="${C - 120}" fill="none" stroke="#ffffff" stroke-opacity=".14" stroke-width="3"/>
      ${textoNoArco('t', 470, '10/12/2026', { tamanho: 92, cor: '#ffffff', graus: 50 })}
      ${textoNoArco('b', 540, 'FORMANDOS', { tamanho: 92, cor: '#ffffff', graus: 62 })}
      ${estrelasDosLados('#c7d1d9')}
      <g filter="url(#sombra)">${imagem(TERCEIRAO, C, C + 6, 860, 261)}</g>`,
  },
  {
    id: 'muro',
    nome: '32 no muro',
    descricao: 'O 32 de grafite sobre o muro, com o brilho azul.',
    svg: () => `
      <defs>${arco('t', 470)}${arco('b', 528, true)}
        <radialGradient id="brilho"><stop offset="0" stop-color="${GELO}" stop-opacity=".55"/><stop offset=".6" stop-color="${GELO}" stop-opacity="0"/></radialGradient>
        <pattern id="muro" width="1181" height="664" patternUnits="userSpaceOnUse"><image href="${MURO}" width="1181" height="664" preserveAspectRatio="xMidYMid slice"/></pattern>
      </defs>
      <circle cx="${C}" cy="${C}" r="${C}" fill="#0b0b0c"/>
      <circle cx="${C}" cy="${C}" r="${C}" fill="url(#muro)" opacity=".9"/>
      <circle cx="${C}" cy="${C + 10}" r="460" fill="url(#brilho)"/>
      ${imagem(LOGO, C, C + 14, 640, 723, 'filter="url(#sombra)"')}
      ${textoNoArco('t', 476, 'TURMA 32', { tamanho: 88, cor: GELO, fonte: DISPLAY, peso: 900, graus: 64 })}
      ${textoNoArco('b', 528, '10 · 12 · 2026', { tamanho: 64, cor: '#ffffff', fonte: DISPLAY, peso: 700, graus: 40 })}
      <circle cx="${C}" cy="${C}" r="${C - 16}" fill="none" stroke="${GELO}" stroke-width="5" stroke-dasharray="2 18" stroke-linecap="round"/>`,
  },
  {
    id: 'sobrevivi',
    nome: 'Sobrevivi ao Terceirão',
    descricao: 'O clássico da formatura, com o 32 no meio.',
    svg: () => `
      <defs>${arco('t', 452)}${arco('b', 516, true)}</defs>
      <circle cx="${C}" cy="${C}" r="${C}" fill="#ffffff"/>
      <circle cx="${C}" cy="${C}" r="${C - 22}" fill="none" stroke="#000000" stroke-width="16"/>
      <circle cx="${C}" cy="${C}" r="${C - 52}" fill="none" stroke="${GELO_FORTE}" stroke-width="6"/>
      ${textoNoArco('t', 452, 'SOBREVIVI AO', { tamanho: 104, cor: '#000000', fonte: SLAB, peso: 900, graus: 86 })}
      ${imagem(LISO, C, C + 8, 540, 574)}
      ${textoNoArco('b', 516, 'TERCEIRÃO', { tamanho: 112, cor: GELO_FORTE, fonte: SLAB, peso: 900, graus: 72, contorno: { cor: '#000000', largura: 14 } })}
      ${estrela(118, C, 30, '#000000')}${estrela(L - 118, C, 30, '#000000')}`,
  },
  {
    id: 'assinaturas',
    nome: 'Assinaturas da turma',
    descricao: 'A assinatura de todo mundo em volta do 32.',
    svg: () => `
      <defs>${arco('b', 506, true)}
        <clipPath id="dentro"><circle cx="${C}" cy="${C}" r="${C}"/></clipPath>
        <radialGradient id="vinheta"><stop offset=".25" stop-color="#000" stop-opacity=".92"/><stop offset=".55" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="${C}" cy="${C}" r="${C}" fill="#111113"/>
      <g clip-path="url(#dentro)" opacity=".8">
        ${imagem(ASSINATURAS, C - 300, C - 300, 1100, 631)}${imagem(ASSINATURAS, C + 300, C + 330, 1100, 631)}
        ${imagem(ASSINATURAS, C + 360, C - 330, 1100, 631)}${imagem(ASSINATURAS, C - 360, C + 300, 1100, 631)}
      </g>
      <circle cx="${C}" cy="${C}" r="${C}" fill="url(#vinheta)"/>
      ${imagem(LOGO, C, C - 10, 470, 531, 'filter="url(#sombra)"')}
      <path d="M ${C - 520} ${C + 120} A 520 520 0 0 0 ${C + 520} ${C + 120}" fill="none" stroke="#000" stroke-opacity=".75" stroke-width="120"/>
      ${textoNoArco('b', 506, 'A TURMA TODA ASSINA', { tamanho: 58, cor: GELO, fonte: DISPLAY, peso: 800, graus: 92 })}
      <circle cx="${C}" cy="${C}" r="${C - 10}" fill="none" stroke="#ffffff" stroke-width="6"/>`,
  },
  {
    id: 'selo',
    nome: 'Selo dourado',
    descricao: 'Um selo de formando, no dourado do baile.',
    svg: () => {
      const dentes = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        dentes.push(`<circle cx="${(C + (C - 34) * Math.cos(a)).toFixed(1)}" cy="${(C + (C - 34) * Math.sin(a)).toFixed(1)}" r="30" fill="url(#ouro)"/>`);
      }
      return `
      <defs>${arco('t', 404)}${arco('b', 470, true)}
        <linearGradient id="ouro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${OURO[0]}"/><stop offset=".35" stop-color="${OURO[1]}"/><stop offset=".7" stop-color="${OURO[2]}"/><stop offset="1" stop-color="${OURO[3]}"/></linearGradient>
      </defs>
      ${dentes.join('')}
      <circle cx="${C}" cy="${C}" r="${C - 40}" fill="url(#ouro)"/>
      <circle cx="${C}" cy="${C}" r="${C - 66}" fill="#121212"/>
      <circle cx="${C}" cy="${C}" r="${C - 92}" fill="none" stroke="url(#ouro)" stroke-width="4"/>
      <circle cx="${C}" cy="${C}" r="300" fill="none" stroke="url(#ouro)" stroke-width="4" stroke-dasharray="3 14" stroke-linecap="round"/>
      ${textoNoArco('t', 404, 'FORMANDOS', { tamanho: 84, cor: 'url(#ouro)', fonte: SLAB, peso: 900, graus: 78 })}
      ${textoNoArco('b', 470, 'TURMA 32 · 2026', { tamanho: 70, cor: 'url(#ouro)', fonte: SLAB, peso: 700, graus: 70 })}
      ${imagem(LISO, C, C, 400, 425)}
      ${estrela(C - 418, C, 24, OURO[1])}${estrela(C + 418, C, 24, OURO[1])}`;
    },
  },
  {
    id: 'data',
    nome: '10.12',
    descricao: 'A data do baile, grande, no azul do 32.',
    svg: () => `
      <defs>${arco('t', 484)}${arco('b', 548, true)}</defs>
      <circle cx="${C}" cy="${C}" r="${C}" fill="${GELO}"/>
      <circle cx="${C}" cy="${C}" r="${C - 120}" fill="#ffffff" stroke="#000000" stroke-width="10"/>
      ${textoNoArco('t', 484, 'O BAILE DA TURMA 32', { tamanho: 66, cor: '#000000', fonte: DISPLAY, peso: 900, graus: 92 })}
      ${textoNoArco('b', 548, '★ NOVA IGUAÇU ★', { tamanho: 60, cor: '#000000', fonte: DISPLAY, peso: 800, graus: 60 })}
      <text x="${C + 12}" y="${C + 70}" text-anchor="middle" font-family="${SLAB}" font-weight="900" font-size="300" fill="${GELO_FORTE}" letter-spacing="-8">10.12</text>
      <text x="${C}" y="${C + 58}" text-anchor="middle" font-family="${SLAB}" font-weight="900" font-size="300" fill="#000000" letter-spacing="-8">10.12</text>
      <text x="${C}" y="${C + 200}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" font-size="104" fill="#000000" letter-spacing="18">2026</text>
      ${imagem(LISO, C, C - 245, 190, 202)}`,
  },
  {
    id: 'formados',
    nome: 'Formados',
    descricao: 'FORMADOS com a sombra azul do 32 e a coroa.',
    svg: () => {
      const coroa = (x, y, k, cor, traco) =>
        `<path transform="translate(${x} ${y}) scale(${k})" d="M -100 40 L -112 -60 L -50 -10 L 0 -80 L 50 -10 L 112 -60 L 100 40 Z" fill="${cor}" stroke="${traco}" stroke-width="${18 / k}" stroke-linejoin="round"/>`;
      const palavra = (y, texto, tamanho) => `
        <text x="${C + 16}" y="${y + 16}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" font-size="${tamanho}" fill="${GELO_FORTE}" stroke="#000" stroke-width="16" paint-order="stroke" stroke-linejoin="round" letter-spacing="-4">${texto}</text>
        <text x="${C}" y="${y}" text-anchor="middle" font-family="${DISPLAY}" font-weight="900" font-size="${tamanho}" fill="#ffffff" stroke="#000" stroke-width="16" paint-order="stroke" stroke-linejoin="round" letter-spacing="-4">${texto}</text>`;
      return `
      <defs>${arco('b', 528, true)}
        <pattern id="muro2" width="1181" height="664" patternUnits="userSpaceOnUse"><image href="${MURO}" width="1181" height="664" preserveAspectRatio="xMidYMid slice"/></pattern>
      </defs>
      <circle cx="${C}" cy="${C}" r="${C}" fill="#0b0b0c"/>
      <circle cx="${C}" cy="${C}" r="${C}" fill="url(#muro2)" opacity=".85"/>
      ${coroa(C + 12, C - 250 + 12, 1.25, GELO_FORTE, '#000')}
      ${coroa(C, C - 250, 1.25, '#000000', '#ffffff')}
      ${palavra(C + 40, 'FORMA-', 236)}
      ${palavra(C + 250, 'DOS!', 250)}
      ${textoNoArco('b', 528, 'TURMA 32 · 2026', { tamanho: 62, cor: GELO, fonte: DISPLAY, peso: 800, graus: 62 })}
      <circle cx="${C}" cy="${C}" r="${C - 16}" fill="none" stroke="#ffffff" stroke-width="5" stroke-dasharray="2 18" stroke-linecap="round"/>`;
    },
  },
];

function pagina(m) {
  return `<!doctype html><html><head><style>
    @font-face { font-family: 'Slab'; font-weight: 700; src: url(${SLAB_700}) format('woff2'); }
    @font-face { font-family: 'Slab'; font-weight: 900; src: url(${SLAB_900}) format('woff2'); }
    * { margin: 0; } html, body { width: ${L}px; height: ${L}px; background: transparent; overflow: hidden; }
    svg { display: block; }
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}" viewBox="0 0 ${L} ${L}">
    <defs>
      <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".45"/></filter>
      <clipPath id="corte"><circle cx="${C}" cy="${C}" r="${C}"/></clipPath>
    </defs>
    <g clip-path="url(#corte)">${m.svg()}</g>
  </svg></body></html>`;
}

const SO = process.argv[2];
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const aba = await navegador.newPage({ viewport: { width: L, height: L } });
for (const m of MODELOS) {
  if (SO && !m.id.includes(SO)) continue;
  await aba.setContent(pagina(m), { waitUntil: 'load' });
  await aba.evaluate(() => document.fonts.ready);
  await aba.screenshot({ path: join(raiz, 'public/adesivos-prontos', `${m.id}.png`), omitBackground: true });
  console.log(`✓ public/adesivos-prontos/${m.id}.png`);
}
await navegador.close();

const lista = MODELOS.map((m) => `  { id: '${m.id}', nome: '${m.nome}', descricao: '${m.descricao}', imagem: '/adesivos-prontos/${m.id}.png' },`).join('\n');
writeFileSync(
  join(raiz, 'src/lib/adesivosProntos.ts'),
  `// Generated by scripts/gerar-adesivos.mjs — change the designs there and run it again.

/** Ready-made sticker models the committee can put on sale in one click (tab "Adesivos"). */
export type AdesivoPronto = { id: string; nome: string; descricao: string; imagem: string };

export const ADESIVOS_PRONTOS: AdesivoPronto[] = [
${lista}
];
`,
);
console.log('✓ src/lib/adesivosProntos.ts');
