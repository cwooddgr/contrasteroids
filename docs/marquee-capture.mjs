import puppeteer from 'puppeteer-core';
import fs from 'fs';
// Renders the Linux cabinet's marquee (arcade/linux/marquee.png is marquee-b) at
// 1080x240 from the game's own scene: run `npx vite --port 5191`, then
// `node docs/marquee-capture.mjs <dir>` (needs puppeteer-core). a is plain,
// b adds the backlit glow, c adds a trim line. Rock shapes are random each run.
const out = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal','--enable-gpu'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('pageerror', e.message));
await p.setViewport({ width: 1080, height: 240, deviceScaleFactor: 2 });
await p.goto('http://localhost:5191/', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 1500));
const raw = await p.evaluate(() => {
  const g = window.__game;
  g.clearAll();
  // Zoom the camera 2.5x so the rocks read at marquee size; the view is then
  // 180 x 40 world units. [size, x, y]
  g.r.camera.zoom = 2.5; g.r.camera.updateProjectionMatrix();
  const layout = [
    [3, -82, 3], [3, 83, -5], [2, -58, -14], [1, -42, 14], [2, 58, 14],
    [1, 41, -15], [1, -21, -16], [1, 22, 16], [2, 4, -16], [1, -6, 16],
  ];
  for (const [s, x, y] of layout) { const r = g.spawnRock(s, x, y, 0, 0); r.spin = 0; }
  g.update(1 / 120);
  g.drawHud = function () {
    const c = this.r.hud, w = this.r.pxW, h = this.r.pxH, k = h / 100;
    c.clearRect(0, 0, w, h); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.font = `${Math.round(k * 27)}px Audiowide, sans-serif`; c.letterSpacing = `${Math.round(k * 3)}px`;
    c.fillText('CONTRASTEROIDS', w / 2, h * 0.53);
    this.r.hudTexture.needsUpdate = true;
  };
  g.drawHud(); g.r.render();
  return g.r.renderer.domElement.toDataURL('image/png');
});
fs.writeFileSync(`${out}/raw.png`, Buffer.from(raw.split(',')[1], 'base64'));
// Post: downscale to 1080x240 and make variants.
const variants = await p.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const make = (fn) => { const c = document.createElement('canvas'); c.width = 1080; c.height = 240; const x = c.getContext('2d'); fn(x); return c.toDataURL('image/png'); };
  const base = (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 1080, 240); x.drawImage(img, 0, 0, 1080, 240); };
  const glow = (x, strength) => {
    for (const [blur, a] of [[18, 0.55 * strength], [6, 0.6 * strength]]) {
      x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; x.filter = `blur(${blur}px)`;
      x.drawImage(img, 0, 0, 1080, 240); x.restore();
    }
  };
  // Light falling off toward the sign's ends, as from one tube behind it.
  const tube = (x) => {
    const gr = x.createLinearGradient(0, 0, 1080, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.15)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.15)');
    x.fillStyle = gr; x.fillRect(0, 0, 1080, 240);
  };
  const trim = (x) => { x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(10, 10, 1060, 220); };
  return {
    a: make((x) => base(x)),
    b: make((x) => { base(x); glow(x, 1); tube(x); }),
    c: make((x) => { base(x); trim(x); glow(x, 1); tube(x); }),
  };
}, 'data:image/png;base64,' + fs.readFileSync(`${out}/raw.png`).toString('base64'));
for (const [k, v] of Object.entries(variants)) fs.writeFileSync(`${out}/marquee-${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
await b.close();
