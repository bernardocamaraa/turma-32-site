// Generates the link-preview images (the card WhatsApp, iMessage, Telegram…
// show when someone pastes a link) and the home-screen icons:
//
//   public/previas/turma-32.jpg         the site in general
//   public/previas/mesas/<slug>.jpg     one per formando, with their name,
//                                       for their personal /mesas/<link> URL
//   public/icone-180.png, icone-512.png the icon on a solid background
//
// middleware.ts picks the right image for each personal link. The images are
// plain files on purpose: nothing has to render at request time, so the
// preview can't fail because of it.
//
// Run again whenever src/lib/formandos.ts changes:
//   node scripts/gerar-previas.mjs
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
function cartao({ sobre, titulo, linha }) {
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
  <div class="mural"></div><div class="brilho"></div>
  <div class="tudo">
    <img class="logo" src="${LOGO}">
    <div class="sobre">${escapar(sobre)}</div>
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

async function salvar(html, arquivo, { largura = 1200, altura = 630, tipo = 'jpeg' } = {}) {
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

await salvar(icone(180), join(raiz, 'public/icone-180.png'), { largura: 180, altura: 180, tipo: 'png' });
await salvar(icone(512), join(raiz, 'public/icone-512.png'), { largura: 512, altura: 512, tipo: 'png' });

await navegador.close();
