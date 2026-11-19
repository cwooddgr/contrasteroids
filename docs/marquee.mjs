import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
// Draws arcade/linux/marquee.png, the Linux cabinet's 1080x240 marquee: a
// 1980s-style color sign, so it reads apart from the black-and-white game
// below it. Run `node docs/marquee.mjs [out.png]` (needs puppeteer-core).
const out = process.argv[2] || 'arcade/linux/marquee.png';
const font = path.resolve('node_modules/@fontsource/audiowide/files/audiowide-latin-400-normal.woff2');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => console.log(m.text()));
await p.goto('file://' + path.resolve('docs') + '/');
const data = await p.evaluate(async (fontUrl) => {
  const f = new FontFace('Audiowide', `url(${fontUrl})`); await f.load(); document.fonts.add(f);
  const W = 1080, H = 240;
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const x = c.getContext('2d'); x.scale(2, 2);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Space: deep blue into violet, a magenta nebula band, star dust.
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#060a3a'); g.addColorStop(0.6, '#1d0b5c'); g.addColorStop(1, '#3a0a5e');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [cx, cy, r, col] of [[300, 200, 260, 'rgba(255,40,160,0.35)'], [780, 40, 240, 'rgba(0,200,255,0.25)'], [560, 150, 200, 'rgba(160,60,255,0.3)']]) {
    g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 420; i++) {
    const s = rnd() < 0.9 ? 0.8 : 1.8;
    x.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`; x.fillRect(rnd() * W, rnd() * H, s, s);
  }

  // Rocks: black outline, hard terminator. Lit side hot orange (light from the
  // upper left, like the game's sun), shadow side violet, craters on the lit side.
  const rock = (cx, cy, r, rot = 0) => {
    const n = 11, pts = [];
    for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; const rr = r * (0.78 + rnd() * 0.3); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    const shape = () => { x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); };
    x.save(); shape(); x.fillStyle = '#4b1f8c'; x.fill(); x.clip();
    const lg = x.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
    lg.addColorStop(0, '#fff0a0'); lg.addColorStop(0.45, '#ffb030'); lg.addColorStop(1, '#ff5a1f');
    x.beginPath(); x.arc(cx - r * 0.42, cy - r * 0.42, r * 1.05, 0, Math.PI * 2); x.fillStyle = lg; x.fill();
    for (let i = 0; i < 3; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * r * 0.5, cr = r * (0.12 + rnd() * 0.12);
      const kx = cx - r * 0.25 + Math.cos(a) * d, ky = cy - r * 0.25 + Math.sin(a) * d;
      x.beginPath(); x.ellipse(kx, ky, cr, cr * 0.8, 0.5, 0, Math.PI * 2); x.fillStyle = '#c4400f'; x.fill();
      x.beginPath(); x.ellipse(kx + cr * 0.25, ky + cr * 0.2, cr * 0.75, cr * 0.6, 0.5, 0, Math.PI * 2); x.fillStyle = '#ffcf6a'; x.fill();
    }
    x.restore();
    shape(); x.lineWidth = Math.max(2.5, r * 0.09); x.lineJoin = 'round'; x.strokeStyle = '#000'; x.stroke();
  };
  const sparkle = (cx, cy, r, col = '#fff') => {
    g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 0.9); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r * 0.9, 0, Math.PI * 2); x.fill();
    x.fillStyle = col;
    for (const [a, l] of [[0, r], [Math.PI / 2, r], [Math.PI / 4, r * 0.45], [-Math.PI / 4, r * 0.45]]) {
      x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath();
      x.moveTo(-l, 0); x.lineTo(0, -l * 0.07); x.lineTo(l, 0); x.lineTo(0, l * 0.07); x.closePath(); x.fill(); x.restore();
    }
  };
  // Fragments flying off the hit rock.
  const chip = (cx, cy, r) => rock(cx, cy, r, rnd() * 6);

  rock(1000, 70, 74, 0.3);
  rock(70, 175, 70, 1.1);
  rock(905, 205, 34);
  rock(290, 34, 22);
  rock(610, 26, 16); rock(420, 220, 14); rock(760, 222, 12);

  // Our ship (the game's arrowhead), firing at the right-hand rock.
  const sx = 205, sy = 196, ang = Math.atan2(34 - 196, 822 - 205); // at the burst
  x.save(); x.strokeStyle = '#ff3fb4'; x.lineWidth = 4; x.shadowColor = '#ff3fb4'; x.shadowBlur = 14;
  for (const t of [0, 0.36, 0.62]) { const a = 50 + t * 470, l = 80; x.beginPath(); x.moveTo(sx + Math.cos(ang) * a, sy + Math.sin(ang) * a); x.lineTo(sx + Math.cos(ang) * (a + l), sy + Math.sin(ang) * (a + l)); x.stroke(); }
  x.restore();
  x.save(); x.translate(sx, sy); x.rotate(ang + Math.PI / 2);
  x.beginPath(); x.moveTo(0, -30); x.lineTo(18, 22); x.lineTo(0, 12); x.lineTo(-18, 22); x.closePath();
  x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3.5; x.strokeStyle = '#000'; x.stroke();
  x.beginPath(); x.moveTo(-7, 18); x.lineTo(0, 40); x.lineTo(7, 18); x.fillStyle = '#ffd23a'; x.fill();
  x.restore();
  chip(846, 18, 9); chip(872, 50, 7);
  sparkle(822, 34, 46, '#fff');
  sparkle(560, 196, 18); sparkle(205, 60, 14); sparkle(1050, 200, 16);

  // Title: yellow-to-red fill, black extrusion and outline, white highlight.
  const t = 'CONTRASTEROIDS';
  x.font = '80px Audiowide'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '4px';
  const tx = W / 2 + 6, ty = H / 2 + 4;
  x.lineJoin = 'round';
  for (let i = 9; i > 0; i--) { x.fillStyle = i > 1 ? '#5a0a2a' : '#000'; x.fillText(t, tx + i, ty + i); x.strokeStyle = '#000'; x.lineWidth = 10; x.strokeText(t, tx + i, ty + i); }
  x.lineWidth = 12; x.strokeStyle = '#000'; x.strokeText(t, tx, ty);
  x.lineWidth = 5; x.strokeStyle = '#ff2a6d'; x.strokeText(t, tx, ty);
  g = x.createLinearGradient(0, ty - 34, 0, ty + 34);
  g.addColorStop(0, '#fffbd0'); g.addColorStop(0.3, '#ffe23a'); g.addColorStop(0.62, '#ff9a1a'); g.addColorStop(1, '#ff3d1a');
  x.fillStyle = g; x.fillText(t, tx, ty);
  x.save(); x.beginPath(); x.rect(0, ty - 40, W, 22); x.clip(); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillText(t, tx, ty); x.restore();

  // Maker's badge, as the old marquees have.
  x.font = '17px Audiowide'; x.letterSpacing = '3px'; x.textAlign = 'left';
  x.lineWidth = 5; x.strokeStyle = '#000'; x.strokeText('DGR LABS', 24, 30); x.fillStyle = '#7ff6ff'; x.fillText('DGR LABS', 24, 30);

  // Trim: cyan outer line, magenta inner line.
  x.lineWidth = 6; x.strokeStyle = '#000'; x.strokeRect(3, 3, W - 6, H - 6);
  x.lineWidth = 4; x.strokeStyle = '#25e0ff'; x.strokeRect(7, 7, W - 14, H - 14);
  x.lineWidth = 2; x.strokeStyle = '#ff3fb4'; x.strokeRect(13, 13, W - 26, H - 26);

  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, W, H);
  return o.toDataURL('image/png');
}, 'file://' + font);
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await b.close();
