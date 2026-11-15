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

  held(...codes) { return codes.some((c) => this.down.has(c)); }
  pressed(...codes) { return codes.some((c) => this.hits.has(c)); }
  endFrame() { this.hits.clear(); }
}
