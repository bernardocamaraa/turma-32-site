// Generates the invitation image the formandos send to their guests:
//
//   public/convite/turma-32-convite.png   1080×1920, the size of a WhatsApp
//                                         or Instagram story, with a QR code
//                                         that opens the site
//
// Same look as the link previews (scripts/gerar-previas.mjs): black, the
// signature wall faded behind, the 32 logo with the ice-blue glow.
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
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const asset = (nome) => `data:image/png;base64,${readFileSync(join(raiz, 'public', 'assets', nome)).toString('base64')}`;
const LOGO = asset('logo-32.png');
const MURAL = asset('assinaturas-mural.png');

const SITE = 'turma-32-site.vercel.app';
const QR = await QRCode.toString(`https://${SITE}`, {
  type: 'svg',
  margin: 0,
  errorCorrectionLevel: 'M',
  color: { dark: '#000000', light: '#ffffff' },
});

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { margin: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; background: #000; overflow: hidden; position: relative;
       font-family: "Inter Display", "Inter", Arial, sans-serif; color: #f5f5f7;
       -webkit-font-smoothing: antialiased; }
.mural { position: absolute; inset: -40px; background: url(${MURAL}) center/1500px;
         opacity: .22; -webkit-mask-image: radial-gradient(ellipse 75% 60% at 50% 32%, #000 10%, transparent 78%); }
.brilho { position: absolute; left: 50%; top: 420px; width: 900px; height: 900px; margin: -450px 0 0 -450px;
          border-radius: 50%; background: radial-gradient(circle, rgba(169,211,232,.28), rgba(169,211,232,0) 62%); }
.tudo { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
        text-align: center; padding: 120px 90px 100px; }
.sobre { font-size: 34px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: #a9d3e8; }
.logo { height: 380px; margin: 44px 0 30px; filter: drop-shadow(0 0 60px rgba(169,211,232,.35)); }
h1 { font-size: 150px; font-weight: 800; line-height: .95; letter-spacing: -.045em; padding-bottom: .06em;
     background: linear-gradient(180deg, #fff 40%, #a1a1a6 100%); -webkit-background-clip: text; color: transparent; }
.frase { margin-top: 30px; font-size: 38px; line-height: 1.35; color: #a1a1a6; max-width: 820px; text-wrap: balance; }
.regua { width: 120px; height: 2px; background: #a9d3e8; opacity: .6; margin: 56px 0; }
.dados { display: flex; flex-direction: column; gap: 38px; }
.rotulo { font-size: 26px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: #a9d3e8; margin-bottom: 10px; }
.valor { font-size: 54px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.nota { font-size: 30px; color: #a1a1a6; margin-top: 8px; }
.rodape { margin-top: auto; display: flex; align-items: center; gap: 40px; text-align: left;
          padding: 30px 40px 30px 30px; border-radius: 32px; background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.12); }
.qr { width: 200px; height: 200px; padding: 16px; background: #fff; border-radius: 18px; flex: none; }
.qr svg { width: 100%; height: 100%; display: block; }
.rodape .valor { font-size: 36px; }
.rodape .nota { font-size: 27px; line-height: 1.35; max-width: 520px; }
</style></head><body>
<div class="mural"></div><div class="brilho"></div>
<div class="tudo">
  <div class="sobre">Convite · Baile de formatura</div>
  <img class="logo" src="${LOGO}">
  <h1>Turma 32</h1>
  <p class="frase">Esperamos você para comemorar essa noite com a gente.</p>
  <div class="regua"></div>
  <div class="dados">
    <div><div class="rotulo">Quando</div><div class="valor">Quinta, 10 de dezembro de 2026</div><div class="nota">às 19h</div></div>
    <div><div class="rotulo">Onde</div><div class="valor">Ballroom Casa de Festas</div><div class="nota">Nova Iguaçu</div></div>
    <div><div class="rotulo">Traje</div><div class="valor">Passeio completo</div></div>
  </div>
  <div class="rodape">
    <div class="qr">${QR}</div>
    <div>
      <div class="valor">${SITE}</div>
      <div class="nota">Mapa, traje e perguntas frequentes. Para confirmar presença, fale com o formando que te convidou.</div>
    </div>
  </div>
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
