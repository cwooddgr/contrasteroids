import puppeteer from 'puppeteer-core';
import fs from 'fs';
// Regenerates public/og.png: run `npx vite --port 5199`, then `node docs/og-capture.mjs <dir>` (needs puppeteer-core) and pick a frame.
const out = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal','--enable-gpu'] });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready); // the HUD font (Audiowide) must be loaded
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => {
  const g = window.__game;
  g.drawHud = function () {
    const c = this.r.hud, w = this.r.pxW, h = this.r.pxH, k = h / 100;
    c.clearRect(0, 0, w, h); c.fillStyle = '#fff'; c.textBaseline = 'top'; c.textAlign = 'center';
    c.font = `${Math.round(k*11)}px Audiowide, sans-serif`; c.letterSpacing = `${Math.round(k*1.6)}px`;
    c.fillText('CONTRASTEROIDS', w/2, h*0.40);
    c.font = `${Math.round(k*3.4)}px Audiowide, sans-serif`; c.letterSpacing = `${Math.round(k*0.6)}px`;
    c.fillText('DGRLABS.CO/CONTRASTEROIDS', w/2, h*0.86);
    this.r.hudTexture.needsUpdate = true;
  };
});
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 1700));
  const d = await p.evaluate(() => { const g = window.__game; g.drawHud(); g.r.render(); return g.r.renderer.domElement.toDataURL('image/png'); });
  fs.writeFileSync(`${out}/f${i}.png`, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close();
