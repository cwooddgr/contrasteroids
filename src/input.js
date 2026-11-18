// Keyboard state with edge detection ("pressed this frame").
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

// ?arcade is set by the cabinet wrapper (arcade/). The panel's encoder sends
// LCtrl for button 1, LAlt for button 2, and 1 for P1 Start, so those stand in
// for fire, hyperspace, and Enter. Charlie's button-only layout matches the
// cabinet's MAME Asteroids: C and 5 (bottom pair) rotate, Z (middle) thrusts,
// X (middle right) fires, Space (top right) is hyperspace. Left off on the
// web, where Ctrl and Alt are browser shortcuts and Space fires.
export const ARCADE = new URLSearchParams(location.search).has('arcade');
const ALIAS = ARCADE ? {
  ControlLeft: 'Space', AltLeft: 'ShiftLeft', Digit1: 'Enter',
  KeyC: 'ArrowLeft', Digit5: 'ArrowRight', KeyZ: 'ArrowUp', KeyX: 'Space', Space: 'ShiftLeft',
} : {};
const code = (e) => ALIAS[e.code] || e.code;

export class Input {
  constructor(onFirstKey) {
    this.down = new Set();
    this.hits = new Set();
    window.addEventListener('keydown', (e) => {
      const c = code(e);
      if (BLOCK.has(c) || c !== e.code) e.preventDefault();
      onFirstKey?.();
      if (!e.repeat) this.hits.add(c);
      this.down.add(c);
    });
    window.addEventListener('keyup', (e) => this.down.delete(code(e)));
    window.addEventListener('blur', () => this.down.clear());
  }

  // Virtual keys from the touch controls share the same state as the keyboard.
  press(code) { if (!this.down.has(code)) this.hits.add(code); this.down.add(code); }
  release(code) { this.down.delete(code); }
  tap(code) { this.hits.add(code); }

  held(...codes) { return codes.some((c) => this.down.has(c)); }
  pressed(...codes) { return codes.some((c) => this.hits.has(c)); }
  endFrame() { this.hits.clear(); }
}
