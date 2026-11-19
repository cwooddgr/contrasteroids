import puppeteer from 'puppeteer-core';
// ES-DE media for the arcade cabinets (arcade/media/): a title still, a
// gameplay still, and an attract video from the ?arcade build. mame-pc
// (portrait) uses 3:4 like its MAME games; the iMac uses 16:9.
// Run `npx vite --port 5191`, then
// `node docs/cabinet-media.mjs <dir> [720x960 | 1280x720]` (needs puppeteer-core
// and ffmpeg). It writes title-N.png and play-N.png candidates at 1.5x the
// viewport, to pick from, and raw.webm; encode that with
// `ffmpeg -i raw.webm -t 31 -r 30 -c:v libx264 -crf 20 -pix_fmt yuv420p -an -movflags +faststart video.mp4`.
// A bot plays Easy. Writes to the score server are blocked, so it never opens
// a session or posts a score; the title shows the real boards, and HI shows
// their top score. Lives are topped up so the clip never reaches game over.
const out = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.setRequestInterception(true);
p.on('request', (r) => (r.method() !== 'GET' && !r.url().startsWith('http://localhost') ? r.abort() : r.continue()));
const [vw, vh] = (process.argv[3] || '720x960').split('x').map(Number);
await p.setViewport({ width: vw, height: vh, deviceScaleFactor: 1.5 });
await p.goto('http://localhost:5191/?arcade', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (fn, ...a) => p.evaluate(fn, ...a);

// Title still with the boards panel showing.
// Rocks drift over the text, so take several and pick the clearest.
// HI is the local best, empty in a fresh browser; show the board's top instead.
const top = () => g(() => { const G = window.__game; for (const d of ['easy', 'hard']) G.his[d] = G.net.boards[d]?.allTime?.[0]?.score ?? G.his[d]; });
await top();
await g(() => { window.__game.time = 0; });
await wait(8500);
for (let i = 0; i < 8; i++) { await p.screenshot({ path: `${out}/title-${i}.png` }); await wait(800); }

// Video: a few seconds of title, then play.
await g(() => { window.__game.time = 0; }); // controls panel first
const rec = await p.screencast({ path: `${out}/raw.webm` });
await wait(5000);
await p.keyboard.press('Digit1');
await wait(300);
await top(); // starting a game reloads the local best
const held = new Set();
const set = async (key, on) => {
  if (on && !held.has(key)) { held.add(key); await p.keyboard.down(key); }
  if (!on && held.has(key)) { held.delete(key); await p.keyboard.up(key); }
};
const t0 = Date.now();
let shot = 0;
while (Date.now() - t0 < 26000) {
  const s = await g(() => {
    const G = window.__game, P = G.player;
    if (G.lives < 3) G.lives = 3;
    let best = null, bd = Infinity;
    for (const r of G.rocks) { const d = Math.hypot(r.x - P.x, r.y - P.y) - r.r; if (d < bd) { bd = d; best = r; } }
    if (!best || !P.alive) return { idle: true };
    const want = Math.atan2(best.y - P.y, best.x - P.x);
    let diff = want - P.angle; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return { diff, dist: bd, alive: P.alive, n: G.rocks.length, score: G.score };
  });
  if (s.idle) { for (const k of [...held]) await set(k, false); await wait(60); continue; }
  await set('ArrowLeft', s.diff > 0.08);
  await set('ArrowRight', s.diff < -0.08);
  await set('KeyX', Math.abs(s.diff) < 0.3);
  await set('KeyZ', s.dist > 30 && Math.abs(s.diff) < 0.4);
  if (shot < 10 && Date.now() - t0 > 2000 + shot * 1000 && s.score > 0) { await p.screenshot({ path: `${out}/play-${shot}.png` }); shot++; }
  await wait(40);
}
for (const k of [...held]) await set(k, false);
await rec.stop();
console.log('final score', await g(() => window.__game.score));
await b.close();
