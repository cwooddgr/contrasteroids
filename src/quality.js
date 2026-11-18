// URL quality settings and the ?bench run, for slow GPUs like the arcade
// iMac's. ?bench steps through settings in both modes on the title screen and
// reports frames per second for each, to the arcade wrapper's log when it's
// there and to the console otherwise.

const params = new URLSearchParams(location.search);
const num = (k) => (params.has(k) ? Number(params.get(k)) : undefined);

export function urlQuality() {
  const q = { shadowSize: num('shadow'), msaa: num('msaa'), scale: num('scale') };
  if (params.get('shadows') === '0') q.shadows = false;
  return q;
}

const report = (msg) => {
  try { window.webkit.messageHandlers.arcade.postMessage({ log: msg }); } catch { /* not in the wrapper */ }
  console.log(msg);
};

const CONFIGS = [
  ['base 4096/msaa4/1x', { shadowSize: 4096, msaa: 4, scale: 1, shadows: true }],
  ['shadow 2048', { shadowSize: 2048, msaa: 4, scale: 1, shadows: true }],
  ['msaa 0', { shadowSize: 4096, msaa: 0, scale: 1, shadows: true }],
  ['scale 0.75', { shadowSize: 4096, msaa: 4, scale: 0.75, shadows: true }],
  ['scale 0.5', { shadowSize: 4096, msaa: 4, scale: 0.5, shadows: true }],
  ['2048/msaa0/0.75', { shadowSize: 2048, msaa: 0, scale: 0.75, shadows: true }],
  ['1024/msaa0/0.5', { shadowSize: 1024, msaa: 0, scale: 0.5, shadows: true }],
  ['no shadows', { shadowSize: 4096, msaa: 4, scale: 1, shadows: false }],
];

export function maybeBench(game, renderer) {
  if (!params.has('bench')) return;
  const frames = (ms) => new Promise((done) => {
    let n = 0; const t0 = performance.now();
    const tick = (now) => { n++; if (now - t0 >= ms) done(Math.round(n * 1000 / (now - t0))); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  (async () => {
    const start = game.difficulty;
    report(`bench start ${innerWidth}x${innerHeight} dpr ${devicePixelRatio}`);
    for (const mode of ['easy', 'hard']) {
      game.setDifficulty(mode);
      for (const [name, q] of CONFIGS) {
        renderer.setQuality(q);
        await frames(2000); // shader compiles and warm-up
        report(`bench ${mode} ${name}: ${await frames(4000)} fps`);
      }
    }
    renderer.setQuality(CONFIGS[0][1]);
    renderer.setQuality(urlQuality());
    game.setDifficulty(start);
    report('bench done');
  })();
}
