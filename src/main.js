import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Touch } from './touch.js';

const STEP = 1 / 120;

const renderer = new Renderer(document.getElementById('app'));
const sound = new Sound();
const input = new Input(() => sound.unlock());
const game = new Game(renderer, sound, input);
const touch = new Touch(input, () => sound.unlock());

window.addEventListener('blur', () => game.pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  let stepped = false;
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
    if (!stepped) { input.endFrame(); stepped = true; }
  }
  touch.frame(game);
  game.touch = touch.enabled;
  game.drawHud();
  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For debugging from the console.
window.__game = game;
