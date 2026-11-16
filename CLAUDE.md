# Contrasteroids

A rock-shooting arcade game in strict 1-bit black and white: solid white 3D objects, one offscreen sun, no ambient light, hard shadows. `SPEC.md` is the source of truth for design decisions, and `docs/decisions.md` records publishing choices. Tier 2, listed in "Also from the Labs" on dgrlabs.co (decided-by-user 2026-11-15). Public repo: https://github.com/cwooddgr/contrasteroids.

## Commands

- `npm run dev`: dev server (Vite)
- `npm run build`: static build to `dist/` with relative paths
- `npm run publish:site`: build and replace `../dgrlabs_co/contrasteroids/` with `dist/`; then commit and push dgrlabs_co too. Never hand-edit the site copy.

There are no tests. Check changes by running the game and taking a screenshot; `window.__game` exposes the game object in the console.

## Things that aren't obvious

- The 1-bit look comes from a threshold pass in `src/render.js`: any lit pixel goes white. Lambert shading is never seen as grey, so detail on the rocks comes only from the terminator and cast shadows. Rock relief (crater depth versus radius in `src/geometry.js`) must stay steep, or the rocks turn into white blobs.
- The HUD is a 2D canvas thresholded in the same pass, and it is uploaded only when its content key changes (`Game.drawHud`).
- `index.html` links `/assets/a11y.css` and `/assets/a11y.js` from dgrlabs.co; they 404 harmlessly in dev.
- `docs/banner.jpg` and `dgrlabs_co/assets/contrasteroids.jpg` are the title screen read straight from the canvas (`toDataURL` right after `__game.r.render()`); regenerate them if the look changes.
- Public text (README, site card, in-game copy) follows the workspace no-AI-tells rule.
- Backtick toggles dev mode: J/L turn the sun's azimuth, I/K its elevation.

## Status

2026-11-15: live at https://dgrlabs.co/contrasteroids/. Sun angle still being tuned; touch controls (`src/touch.js`) confirmed working on Charlie's iPhone, including sound and no double-tap zoom.
