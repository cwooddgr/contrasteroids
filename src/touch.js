// On-screen controls for phones and tablets. They feed virtual key codes into
// Input, so the game reads touch and keyboard the same way. Drawn in pure
// black and white to match the 1-bit look.

const CSS = `
#touch { position: fixed; inset: 0; z-index: 10; touch-action: none; user-select: none;
  -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
#touch .pad { position: absolute; display: none; gap: 14px;
  bottom: calc(16px + env(safe-area-inset-bottom)); }
#touch.play .pad { display: flex; }
#touch .left { left: calc(16px + env(safe-area-inset-left)); }
#touch .right { right: calc(16px + env(safe-area-inset-right)); align-items: flex-end; }
#touch .top { top: calc(12px + env(safe-area-inset-top)); right: calc(12px + env(safe-area-inset-right));
  bottom: auto; gap: 10px; }
#touch.title .top, #touch.gameover .top { display: flex; }
#touch:not(.play) [data-pause] { display: none; }
#touch button { all: unset; box-sizing: border-box; width: 68px; height: 68px; border: 2px solid #fff;
  border-radius: 50%; color: #fff; background: #000; display: flex; align-items: center;
  justify-content: center; font: 700 13px "Courier New", ui-monospace, monospace; letter-spacing: 1px; }
#touch button.big { width: 84px; height: 84px; }
#touch button.small { width: 42px; height: 42px; font-size: 16px; }
#touch button.on { background: #fff; color: #000; }
#touch button svg { width: 26px; height: 26px; fill: currentColor; }
#touch .stack { display: flex; flex-direction: column; gap: 14px; align-items: center; }
`;

const tri = (rot) => `<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${rot}deg)"><path d="M12 3 21 20H3z"/></svg>`;

export class Touch {
  constructor(input, onFirstTouch) {
    this.input = input;
    this.onFirstTouch = onFirstTouch;
    this.enabled = false;
    this.pointers = new Map(); // pointerId -> button element or null
    this.held = new Set();

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const el = (this.el = document.createElement('div'));
    el.id = 'touch';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="pad left">
        <button data-code="ArrowLeft">${tri(-90)}</button>
        <button data-code="ArrowRight">${tri(90)}</button>
      </div>
      <div class="pad right">
        <div class="stack">
          <button class="small" data-code="ShiftLeft" data-edge>H</button>
          <button data-code="ArrowUp">${tri(0)}</button>
        </div>
        <button class="big" data-code="Space">FIRE</button>
      </div>
      <div class="pad top">
        <button class="small" data-code="KeyM" data-edge>&#9834;</button>
        <button class="small" data-code="Escape" data-edge data-pause>II</button>
      </div>`;
    el.style.display = 'none';
    document.body.appendChild(el);

    const update = (e) => this.onPointer(e);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      el.addEventListener(type, update);
    }
    // iOS starts audio reliably from touchend, so unlock there too.
    el.addEventListener('touchend', () => this.onFirstTouch?.(), { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // Show the controls on touch-first devices, or as soon as anyone touches the screen.
    if (window.matchMedia('(pointer: coarse)').matches) this.enable();
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.enable(); }, true);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.el.style.display = '';
  }

  onPointer(e) {
    if (e.pointerType === 'mouse' && !this.enabled) return;
    e.preventDefault();
    this.onFirstTouch?.();
    const id = e.pointerId;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      const was = this.pointers.get(id);
      this.pointers.delete(id);
      // A tap on open screen starts the game, or resumes it from pause.
      if (e.type === 'pointerup' && was === null) this.input.tap('Tap');
    } else {
      if (e.type === 'pointermove' && !this.pointers.has(id)) return;
      // Sliding a thumb from one button to the next switches between them.
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('#touch button') ?? null;
      const prev = this.pointers.get(id);
      if (e.type === 'pointerdown' || hit !== prev) {
        if (hit && 'edge' in hit.dataset && hit !== prev) this.input.tap(hit.dataset.code);
        this.pointers.set(id, e.type === 'pointermove' && prev === null ? null : hit);
      }
    }
    this.sync();
  }

  sync() {
    const now = new Set();
    for (const b of this.pointers.values()) {
      if (b && !('edge' in b.dataset)) now.add(b.dataset.code);
    }
    for (const c of this.held) if (!now.has(c)) this.input.release(c);
    for (const c of now) if (!this.held.has(c)) this.input.press(c);
    this.held = now;
    for (const b of this.el.querySelectorAll('button')) {
      b.classList.toggle('on', [...this.pointers.values()].includes(b));
    }
  }

  // Called every frame: shows the right controls for the game's state.
  frame(game) {
    if (!this.enabled) return;
    const mode = game.mode === 'play' && game.paused ? 'paused' : game.mode;
    if (this.mode !== mode) {
      this.mode = mode;
      this.el.className = mode;
      if (mode !== 'play') {
        this.pointers.clear();
        this.sync();
      }
    }
  }
}
