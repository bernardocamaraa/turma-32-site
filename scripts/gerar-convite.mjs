// Generates the invitation image the formandos send to their guests:
//
//   public/convite/turma-32-convite.png   1080×1920, the size of a WhatsApp
//                                         or Instagram story
//
// Same look as the link previews (scripts/gerar-previas.mjs): black, the
// signature wall faded behind, the 32 logo with the ice-blue glow. Kept
// short on purpose — the logo, the name and the three facts of the night.
//
//   node scripts/gerar-convite.mjs
//
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
const asset = (nome) => `data:image/png;base64,${readFileSync(join(raiz, 'public', 'assets', nome)).toString('base64')}`;
const LOGO = asset('logo-32.png');
const MURAL = asset('assinaturas-mural.png');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { margin: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; background: #000; overflow: hidden; position: relative;
       font-family: "Inter Display", "Inter", Arial, sans-serif; color: #f5f5f7;
       -webkit-font-smoothing: antialiased; }
.mural { position: absolute; inset: -40px; background: url(${MURAL}) center/1500px;
         opacity: .18; -webkit-mask-image: radial-gradient(ellipse 75% 55% at 50% 42%, #000 10%, transparent 78%); }
.brilho { position: absolute; left: 50%; top: 640px; width: 900px; height: 900px; margin: -450px 0 0 -450px;
          border-radius: 50%; background: radial-gradient(circle, rgba(169,211,232,.26), rgba(169,211,232,0) 62%); }
.tudo { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
        justify-content: center; text-align: center; padding: 0 90px 40px; }
.sobre { font-size: 32px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: #a9d3e8; }
.logo { height: 420px; margin: 60px 0 44px; filter: drop-shadow(0 0 60px rgba(169,211,232,.35)); }
h1 { font-size: 156px; font-weight: 800; line-height: .95; letter-spacing: -.045em; padding-bottom: .06em;
     background: linear-gradient(180deg, #fff 40%, #a1a1a6 100%); -webkit-background-clip: text; color: transparent; }
.regua { width: 120px; height: 2px; background: #a9d3e8; opacity: .6; margin: 80px 0; }
.data { font-size: 60px; font-weight: 700; letter-spacing: -.02em; }
.linha { margin-top: 22px; font-size: 38px; color: #a1a1a6; letter-spacing: -.005em; }
</style></head><body>
<div class="mural"></div><div class="brilho"></div>
<div class="tudo">
  <div class="sobre">Baile de formatura</div>
  <img class="logo" src="${LOGO}">
  <h1>Turma 32</h1>
  <div class="regua"></div>
  <div class="data">10 de dezembro · 19h</div>
  <div class="linha">Ballroom Casa de Festas, Nova Iguaçu</div>
  <div class="linha">Traje passeio completo</div>
</div></body></html>`;

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
await pagina.setContent(html, { waitUntil: 'load' });
await pagina.evaluate(() => document.fonts.ready);
const arquivo = join(raiz, 'public/convite/turma-32-convite.png');
mkdirSync(dirname(arquivo), { recursive: true });
await pagina.screenshot({ path: arquivo, type: 'png' });
console.log('✓', arquivo.replace(raiz + '/', ''));
await navegador.close();
