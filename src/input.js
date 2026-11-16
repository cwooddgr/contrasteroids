// Keyboard state with edge detection ("pressed this frame").
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class Input {
  constructor(onFirstKey) {
    this.down = new Set();
    this.hits = new Set();
    window.addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      onFirstKey?.();
      if (!e.repeat) this.hits.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
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
