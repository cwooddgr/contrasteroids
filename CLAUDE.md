# Contrasteroids

A rock-shooting arcade game in black, white, and grey: solid white 3D objects lit only by the ship's spotlight and halo, bullets, and explosions; no ambient light, hard shadows. (Until 2026-11-16 it was strict 1-bit under one offscreen sun.) `SPEC.md` is the source of truth for design decisions, and `docs/decisions.md` records publishing choices. Tier 2, listed in "Also from the Labs" on dgrlabs.co (decided-by-user 2026-11-15). Public repo: https://github.com/cwooddgr/contrasteroids.

## Commands

- `npm run dev`: dev server (Vite)
- `npm run build`: static build to `dist/` with relative paths
- `npm run publish:site`: build and replace `../dgrlabs_co/contrasteroids/` with `dist/`; then commit and push dgrlabs_co too. Never hand-edit the site copy.

There are no tests. Check changes by running the game and taking a screenshot; `window.__game` exposes the game object in the console.

## Things that aren't obvious

- `binaryLambert` in `src/geometry.js` makes each face either facing a light or not, so the only grey comes from distance falloff (three's windowed falloff with `decay = 0`), never from surface angle. Detail on the rocks comes from the terminator and cast shadows, so rock relief (crater depth versus radius) must stay steep. Light intensities are multiplied by PI so a fully lit surface renders at 1.0.
- The ship can't be lit by its own lights, so its material (`shipKey`) shades it from a fixed key direction in the shader instead.
- The HUD is a 2D canvas kept pure black and white by the post pass, and it is uploaded only when its content key changes (`Game.drawHud`).
- `index.html` links `/assets/a11y.css` and `/assets/a11y.js` from dgrlabs.co; they 404 harmlessly in dev.
- `docs/banner.jpg` and `dgrlabs_co/assets/contrasteroids.jpg` are the title screen read straight from the canvas (`toDataURL` right after `__game.r.render()`); regenerate them if the look changes.
- `public/og.png` is the 1200x630 link-preview card, captured from the canvas with a title-and-URL HUD by `docs/og-capture.mjs`; regenerate it with them.
- Public text (README, site card, in-game copy) follows the workspace no-AI-tells rule.
- iOS touch quirks in `src/touch.js` (see `docs/decisions.md`): the overlay cancels touchstart/touchmove/touchend because Safari double-tap zooms despite `touch-action: none` (WebKit bug 218015), and audio unlocks on pointerup/touchend, never pointerdown. `src/audio.js` sets the audio session to playback so the silent switch doesn't mute it.
- Backtick toggles dev mode: J/L cone width, I/K spotlight range, U/O halo range.

## Status

2026-11-16: ship-light version (spotlight, halo, bullet lights, greyscale falloff) built locally, not yet published; the live site still has the sun version. Banner and og.png still show the sun look.
