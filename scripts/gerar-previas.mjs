// Generates the link-preview images (the card WhatsApp, iMessage, Telegram…
// show when someone pastes a link) and the home-screen icons:
//
//   public/previas/turma-32.jpg         the site in general
//   public/previas/mesas/<slug>.jpg     one per formando, with their name,
//                                       for their personal /mesas/<link> URL
//   public/previas/musica.jpg           the stairs-song link (/musica)
//   public/icone-180.png, icone-512.png the icon on a solid background
//
// middleware.ts picks the right image for each personal link. The images are
// plain files on purpose: nothing has to render at request time, so the
// preview can't fail because of it.
//
// Run again whenever src/lib/formandos.ts changes:
//   node scripts/gerar-previas.mjs
// Or only the images whose path contains a word, leaving the rest as is:
//   node scripts/gerar-previas.mjs musica
// Needs Playwright (npx playwright install chromium, or a global install)
// and the Inter font — it uses the installed "Inter Display" if present,
// with Arial as the fallback.

import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Embedded as data URIs: a page built with setContent can't load file:// URLs.
const asset = (nome) => `data:image/png;base64,${readFileSync(join(raiz, 'public', 'assets', nome)).toString('base64')}`;
const LOGO = asset('logo-32.png');
const MURAL = asset('assinaturas-mural.png');

// The names come straight from the site's own list, so the two never drift.
const formandos = [...readFileSync(join(raiz, 'src/lib/formandos.ts'), 'utf8').matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);

/** Same slug rule as the rest of the site ("João Pedro Jardim" → "joao-pedro-jardim"). */
export function slug(nome) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Everything centered: WhatsApp's compose bar crops the preview to a square
 * from the middle, so the logo and the name have to sit there to survive it.
 */
/** One eighth note (♪), or two beamed (♫), as SVG, drawn in the site's ice blue. */
function nota({ x, y, tamanho, giro, opacidade, dupla }) {
  const desenho = dupla
    ? '<path d="M22 6 L58 0 L58 46" fill="none" stroke="currentColor" stroke-width="5"/><path d="M22 6 L22 52" stroke="currentColor" stroke-width="5"/>' +
      '<path d="M22 6 L58 0 L58 10 L22 16 Z" fill="currentColor"/>' +
      '<ellipse cx="14" cy="54" rx="10" ry="7.5" transform="rotate(-22 14 54)" fill="currentColor"/>' +
      '<ellipse cx="50" cy="48" rx="10" ry="7.5" transform="rotate(-22 50 48)" fill="currentColor"/>'
    : '<path d="M30 4 L30 50" stroke="currentColor" stroke-width="5"/>' +
      '<path d="M30 4 C34 16 48 18 46 34 C44 24 38 22 30 20 Z" fill="currentColor"/>' +
      '<ellipse cx="22" cy="52" rx="10" ry="7.5" transform="rotate(-22 22 52)" fill="currentColor"/>';
  return `<svg viewBox="0 0 64 64" style="position:absolute; left:${x}px; top:${y}px; width:${tamanho}px; height:${tamanho}px;
    transform: rotate(${giro}deg); opacity:${opacidade}; color:#a9d3e8; filter: drop-shadow(0 0 14px rgba(169,211,232,.45));">${desenho}</svg>`;
}

function cartao({ sobre, titulo, linha, enfeite = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #000; overflow: hidden; position: relative;
         font-family: "Inter Display", "Inter", Arial, sans-serif; color: #f5f5f7;
         -webkit-font-smoothing: antialiased; }
  .mural { position: absolute; inset: -20px; background: url(${MURAL}) center/1250px;
           opacity: .26; -webkit-mask-image: radial-gradient(ellipse 62% 80% at 50% 45%, #000 10%, transparent 75%); }
  .brilho { position: absolute; left: 50%; top: 150px; width: 520px; height: 520px; margin: -260px 0 0 -260px;
            border-radius: 50%; background: radial-gradient(circle, rgba(169,211,232,.3), rgba(169,211,232,0) 62%); }
  .tudo { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center; padding: 0 80px; }
  .logo { height: 210px; filter: drop-shadow(0 0 36px rgba(169,211,232,.3)); margin-bottom: 26px; }
  .sobre { font-size: 26px; font-weight: 600; color: #a9d3e8; letter-spacing: -.01em; margin-bottom: 10px; }
  /* At most ~600px wide, so a long name wraps instead of being cut off by
     the square crop (which keeps the middle 630px). */
  h1 { max-width: 600px; text-wrap: balance; font-size: 68px; font-weight: 800; line-height: 1; letter-spacing: -.04em; padding-bottom: .06em;
       background: linear-gradient(180deg, #fff 40%, #a1a1a6 100%); -webkit-background-clip: text; color: transparent; }
  .linha { margin-top: 16px; font-size: 24px; color: #a1a1a6; letter-spacing: -.005em; }
  </style></head><body>
  <div class="mural"></div><div class="brilho"></div>${enfeite}
  <div class="tudo">
    <img class="logo" src="${LOGO}">
    ${sobre ? `<div class="sobre">${escapar(sobre)}</div>` : ''}
    <h1>${titulo}</h1>
    <div class="linha">${escapar(linha)}</div>
  </div></body></html>`;
}

function icone(tamanho) {
  return `<!doctype html><html><head><style>
  * { margin: 0; } body { width: ${tamanho}px; height: ${tamanho}px; background: #000; display: flex;
  align-items: center; justify-content: center; overflow: hidden; }
  div { position: absolute; inset: 0; background: radial-gradient(circle, rgba(169,211,232,.3), rgba(169,211,232,0) 62%); }
  img { position: relative; height: ${Math.round(tamanho * 0.78)}px; }
  </style></head><body><div></div><img src="${LOGO}"></body></html>`;
}

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 } });

const SO = process.argv[2];

async function salvar(html, arquivo, { largura = 1200, altura = 630, tipo = 'jpeg' } = {}) {
  if (SO && !arquivo.includes(SO)) return;
  await pagina.setViewportSize({ width: largura, height: altura });
  await pagina.setContent(html, { waitUntil: 'load' });
  await pagina.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(arquivo), { recursive: true });
  await pagina.screenshot({ path: arquivo, type: tipo, ...(tipo === 'jpeg' ? { quality: 86 } : {}) });
  console.log('✓', arquivo.replace(raiz + '/', ''));
}

await salvar(
  cartao({ sobre: 'Baile de formatura', titulo: 'Turma 32', linha: '10 de dezembro de 2026 · Nova Iguaçu' }),
  join(raiz, 'public/previas/turma-32.jpg'),
);

for (const nome of formandos) {
  await salvar(
    cartao({
      sobre: 'Mapa das mesas',
      titulo: escapar(nome),
      linha: 'Escolha onde a sua família vai sentar no baile.',
    }),
    join(raiz, 'public/previas/mesas', `${slug(nome)}.jpg`),
  );
}

// Notes around the edges and a couple near the middle — clear of the
// text, and enough of them inside the square crop to read as "music".
const NOTAS = [
  { x: 70, y: 70, tamanho: 120, giro: -14, opacidade: 0.55, dupla: true },
  { x: 180, y: 380, tamanho: 84, giro: 10, opacidade: 0.4 },
  { x: 60, y: 470, tamanho: 64, giro: -8, opacidade: 0.28, dupla: true },
  { x: 310, y: 150, tamanho: 58, giro: 16, opacidade: 0.32 },
  { x: 990, y: 60, tamanho: 100, giro: 12, opacidade: 0.5 },
  { x: 1040, y: 330, tamanho: 120, giro: -10, opacidade: 0.5, dupla: true },
  { x: 880, y: 470, tamanho: 70, giro: 8, opacidade: 0.32 },
  { x: 840, y: 170, tamanho: 56, giro: -18, opacidade: 0.3, dupla: true },
  { x: 345, y: 40, tamanho: 50, giro: -6, opacidade: 0.4 },
  { x: 790, y: 30, tamanho: 52, giro: 14, opacidade: 0.38, dupla: true },
];

await salvar(
  cartao({ titulo: 'Música', linha: 'Clique aqui para escolher', enfeite: NOTAS.map(nota).join('') }),
  join(raiz, 'public/previas/musica.jpg'),
);

await salvar(icone(180), join(raiz, 'public/icone-180.png'), { largura: 180, altura: 180, tipo: 'png' });
await salvar(icone(512), join(raiz, 'public/icone-512.png'), { largura: 512, altura: 512, tipo: 'png' });

await navegador.close();
