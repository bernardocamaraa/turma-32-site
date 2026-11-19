// Draws the ready-made sticker models the committee can put on sale in one
// click (tab "Adesivos" → "Modelos prontos"): round, 1181 px across like the
// childhood sticker's model, transparent outside the circle. They're built
// from the class's own pieces — the 32, the Terceirão logo, the
// signatures — in the look described at MODELOS below.
//
//   public/adesivos-prontos/<id>.png   one per model in MODELOS below
//   src/lib/adesivosProntos.ts         the list the site shows (names, descriptions)
//
// Run again after changing a design:
//   node scripts/gerar-adesivos.mjs
// Or only some:  node scripts/gerar-adesivos.mjs selo
// Needs Playwright, like gerar-previas.mjs. Uses the installed "Inter
// Display" if present (Arial otherwise), and Anton, Epilogue and Roboto Slab
// from scripts/fontes (all OFL).

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
const ANTON_400 = dados('scripts/fontes/anton-400.woff2', 'font/woff2');
const EPILOGUE_800 = dados('scripts/fontes/epilogue-800.woff2', 'font/woff2');

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

// The look, chosen by the ui-ux-pro-max skill's design system for "graduation
// sticker streetwear youth graffiti": brutalism / neubrutalism — flat loud
// colours, thick black outlines, hard offset shadows (like the 32's own),
// big condensed type in straight blocks (Anton, with Epilogue). No
// gradients, no soft shadows.
const ROSA = '#EC4899';
const AMBAR = '#F59E0B';
const AZUL_FORTE = '#2563EB';
const PRETO = '#000000';
const BRANCO = '#ffffff';
const ANTON = "'Anton', Impact, sans-serif";
const EPILOGUE = "'Epilogue', Arial, sans-serif";
// The disc sits up and left, leaving a black crescent below right: the hard shadow.
const DX = -14;
const CX = C + DX;
const RD = C - 46;

/** The sticker's base: black all round, the coloured disc on it with a thick outline. */
const base = (cor, traco = PRETO) => `
  <circle cx="${C}" cy="${C}" r="${C}" fill="${PRETO}"/>
  <circle cx="${CX}" cy="${CX}" r="${RD}" fill="${cor}" stroke="${traco}" stroke-width="14"/>`;

/** A straight label: a box with a black outline and a hard shadow, text in it. */
function etiqueta(x, y, texto, { largura, altura, fundo = PRETO, cor = BRANCO, tamanho, giro = 0, fonte = ANTON, peso = 400, sombra = PRETO, espaco = 2 }) {
  return `<g transform="rotate(${giro} ${x} ${y})">
    <rect x="${x - largura / 2 + 12}" y="${y - altura / 2 + 12}" width="${largura}" height="${altura}" fill="${sombra}"/>
    <rect x="${x - largura / 2}" y="${y - altura / 2}" width="${largura}" height="${altura}" fill="${fundo}" stroke="${PRETO}" stroke-width="10"/>
    <text x="${x}" y="${y + tamanho * 0.36}" text-anchor="middle" font-family="${fonte}" font-weight="${peso}" font-size="${tamanho}" fill="${cor}" letter-spacing="${espaco}">${texto}</text>
  </g>`;
}

/** Big type with a black outline and a hard shadow behind it. */
function letreiro(x, y, texto, { tamanho, cor = BRANCO, sombra = PRETO, desloca = 14, giro = 0, espaco = 2, contorno = 16 }) {
  const t = (dx, dy, fill) =>
    `<text x="${x + dx}" y="${y + dy}" text-anchor="middle" font-family="${ANTON}" font-size="${tamanho}" fill="${fill}" stroke="${PRETO}" stroke-width="${contorno}" paint-order="stroke" stroke-linejoin="round" letter-spacing="${espaco}">${texto}</text>`;
  return `<g transform="rotate(${giro} ${x} ${y})">${t(desloca, desloca, sombra)}${t(0, 0, cor)}</g>`;
}

/** A shape drawn twice: a hard black shadow, then itself. */
const comSombra = (desenho, d = 16) => `<g transform="translate(${d} ${d})" filter="url(#tudoPreto)">${desenho}</g>${desenho}`;

const MODELOS = [
  {
    id: 'terceirao',
    nome: 'Terceirão',
    descricao: 'O logo do Terceirão num bloco preto, com a data do baile.',
    svg: () => `
      ${base(AZUL_FORTE)}
      ${etiqueta(CX, 300, '10.12.2026', { largura: 470, altura: 120, fundo: AMBAR, cor: PRETO, tamanho: 92, giro: -4 })}
      <g transform="rotate(-5 ${CX} ${CX + 10})">
        <rect x="${CX - 430 + 16}" y="${CX - 125 + 16}" width="860" height="270" fill="${ROSA}"/>
        <rect x="${CX - 430}" y="${CX - 125}" width="860" height="270" fill="${PRETO}" stroke="${PRETO}" stroke-width="10"/>
        ${imagem(TERCEIRAO, CX, CX + 10, 790, 240)}
      </g>
      ${letreiro(CX, 905, 'FORMANDOS', { tamanho: 150, espaco: 4 })}`,
  },
  {
    id: 'trinta-e-dois',
    nome: '32',
    descricao: 'O 32 grandão, com TURMA e 2026.',
    svg: () => `
      ${base(AMBAR)}
      ${etiqueta(CX, 215, 'TURMA', { largura: 330, altura: 124, tamanho: 104, giro: -3, espaco: 6 })}
      <g transform="rotate(5 ${CX} ${CX + 20})">${imagem(LISO, CX, CX + 20, 600, 638)}</g>
      ${etiqueta(CX + 10, 955, '2026', { largura: 290, altura: 124, fundo: ROSA, cor: PRETO, tamanho: 104, giro: 4, espaco: 6 })}`,
  },
  {
    id: 'sobrevivi',
    nome: 'Sobrevivi ao Terceirão',
    descricao: 'O clássico da formatura, em letras grandes.',
    svg: () => `
      ${base(ROSA)}
      ${imagem(LISO, CX, 255, 190, 202)}
      ${letreiro(CX, 560, 'SOBREVIVI', { tamanho: 200, espaco: 4, giro: -4 })}
      ${etiqueta(CX, 655, 'AO', { largura: 190, altura: 130, fundo: AZUL_FORTE, cor: BRANCO, tamanho: 112, giro: 5 })}
      ${letreiro(CX, 905, 'TERCEIRÃO', { tamanho: 182, espaco: 3, giro: -4, cor: AMBAR })}`,
  },
  {
    id: 'assinaturas',
    nome: 'Assinaturas da turma',
    descricao: 'As assinaturas de todo mundo, com o 32 no meio.',
    svg: () => `
      <defs><clipPath id="disco"><circle cx="${CX}" cy="${CX}" r="${RD}"/></clipPath></defs>
      ${base(BRANCO)}
      <g clip-path="url(#disco)" filter="url(#tudoPreto)" opacity=".9">
        ${imagem(ASSINATURAS, CX - 300, CX - 290, 1100, 631)}${imagem(ASSINATURAS, CX + 300, CX + 320, 1100, 631)}
        ${imagem(ASSINATURAS, CX + 360, CX - 320, 1100, 631)}${imagem(ASSINATURAS, CX - 360, CX + 300, 1100, 631)}
      </g>
      <circle cx="${CX}" cy="${CX}" r="${RD}" fill="none" stroke="${PRETO}" stroke-width="14"/>
      ${comSombra(`<circle cx="${CX}" cy="${CX}" r="255" fill="${AMBAR}" stroke="${PRETO}" stroke-width="14"/>`, 18)}
      ${imagem(LISO, CX, CX + 4, 350, 372)}`,
  },
  {
    id: 'carimbo',
    nome: 'Formado',
    descricao: 'Um carimbo de FORMADO, com a fita da turma.',
    svg: () => `
      ${base('#111111', BRANCO)}
      <circle cx="${CX}" cy="${CX}" r="440" fill="none" stroke="${AMBAR}" stroke-width="18"/>
      <circle cx="${CX}" cy="${CX}" r="400" fill="none" stroke="${AMBAR}" stroke-width="6" stroke-dasharray="4 22" stroke-linecap="round"/>
      ${imagem(LISO, CX, CX - 230, 170, 181)}
      ${letreiro(CX, CX + 90, 'FORMADO', { tamanho: 215, cor: AMBAR, sombra: ROSA, giro: -8, espaco: 6, contorno: 0, desloca: 12 })}
      ${etiqueta(CX, CX + 220, 'TURMA 32 · 2026', { largura: 720, altura: 110, fundo: ROSA, cor: PRETO, tamanho: 64, giro: -8, fonte: EPILOGUE, peso: 800, espaco: 4, sombra: BRANCO })}`,
  },
  {
    id: 'data',
    nome: '10.12',
    descricao: 'A data do baile, gigante.',
    svg: () => {
      const linhas = [];
      for (let k = 40; k < L; k += 84) linhas.push(`<line x1="${k}" y1="0" x2="${k}" y2="${L}"/><line x1="0" y1="${k}" x2="${L}" y2="${k}"/>`);
      return `
      <defs><clipPath id="disco2"><circle cx="${CX}" cy="${CX}" r="${RD}"/></clipPath></defs>
      ${base(BRANCO)}
      <g clip-path="url(#disco2)" stroke="${PRETO}" stroke-opacity=".12" stroke-width="3">${linhas.join('')}</g>
      <circle cx="${CX}" cy="${CX}" r="${RD}" fill="none" stroke="${PRETO}" stroke-width="14"/>
      ${etiqueta(CX, 285, 'O BAILE DA TURMA 32', { largura: 720, altura: 104, tamanho: 52, fonte: EPILOGUE, peso: 800, espaco: 2, giro: -3 })}
      ${letreiro(CX, CX + 150, '10.12', { tamanho: 380, cor: PRETO, sombra: ROSA, contorno: 0, desloca: 18, espaco: 4 })}
      ${etiqueta(CX, 900, '2026', { largura: 300, altura: 130, fundo: AZUL_FORTE, cor: BRANCO, tamanho: 110, giro: 4, espaco: 8 })}`;
    },
  },
  {
    id: 'formados',
    nome: 'Formados',
    descricao: 'FORMADOS! com a coroa do 32.',
    svg: () => {
      const coroa = `<path transform="translate(${CX} 300) scale(1.35)" d="M -100 40 L -112 -60 L -50 -10 L 0 -80 L 50 -10 L 112 -60 L 100 40 Z" fill="${ROSA}" stroke="${PRETO}" stroke-width="11" stroke-linejoin="round"/>`;
      return `
      ${base(AMBAR)}
      ${comSombra(coroa, 14)}
      ${letreiro(CX, 640, 'FORMA-', { tamanho: 270, espaco: 6, giro: -4 })}
      ${letreiro(CX, 900, 'DOS!', { tamanho: 270, espaco: 8, giro: -4, cor: BRANCO, sombra: AZUL_FORTE })}`;
    },
  },
];

function pagina(m) {
  return `<!doctype html><html><head><style>
    @font-face { font-family: 'Slab'; font-weight: 700; src: url(${SLAB_700}) format('woff2'); }
    @font-face { font-family: 'Slab'; font-weight: 900; src: url(${SLAB_900}) format('woff2'); }
    @font-face { font-family: 'Anton'; font-weight: 400; src: url(${ANTON_400}) format('woff2'); }
    @font-face { font-family: 'Epilogue'; font-weight: 800; src: url(${EPILOGUE_800}) format('woff2'); }
    * { margin: 0; } html, body { width: ${L}px; height: ${L}px; background: transparent; overflow: hidden; }
    svg { display: block; }
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}" viewBox="0 0 ${L} ${L}">
    <defs>
      <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".45"/></filter>
      <filter id="tudoPreto"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
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
