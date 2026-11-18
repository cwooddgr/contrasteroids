# Contrasteroids

A rock-shooting arcade game with solid white 3D objects, no ambient light, and hard shadows, in two modes: Easy is strict 1-bit under one offscreen sun; Hard has no sun, only the ships' own lights, bullets, and explosions, with grey distance falloff. `Renderer.setMode` and `styleShip` switch between them. `SPEC.md` is the source of truth for design decisions, and `docs/decisions.md` records publishing choices. Tier 2, listed in "Also from the Labs" on dgrlabs.co (decided-by-user 2026-11-15). Public repo: https://github.com/cwooddgr/contrasteroids.

## Commands

- `npm run dev`: dev server (Vite)
- `npm run build`: static build to `dist/` with relative paths
- `npm run publish:site`: build and replace `../dgrlabs_co/contrasteroids/` with `dist/`; then commit and push dgrlabs_co too. Never hand-edit the site copy.
- `cd server && npm test`: rule checks for the score server. `npm run deploy` there ships the Worker (`scores.dgrlabs.co`); schema changes go in `server/migrations/` and `npm run migrate`.

Check game changes by running it and taking a screenshot; `window.__game` exposes the game object in the console. Without the Chrome extension, drive headless Chrome with puppeteer-core as `docs/og-capture.mjs` does.

## Things that aren't obvious

- `binaryLambert` in `src/geometry.js` makes each face either facing a light or not, so the only grey comes from distance falloff (three's windowed falloff with `decay = 0`), never from surface angle. Detail on the rocks comes from the terminator and cast shadows, so rock relief (crater depth versus radius) must stay steep. Light intensities are multiplied by PI so a fully lit surface renders at 1.0.
- In Hard, ships light themselves and take no shadows: ours is pure white (`SELF_LIT`), and the aliens are shaded from a fixed key direction in the shader (`shipKey`). Every light exists in both modes at intensity 0 when unused, so light counts never change; switching modes only recompiles for shadow casting.
- The HUD is a 2D canvas kept pure black and white by the post pass, and it is uploaded only when its content key changes (`Game.drawHud`).
- `index.html` links `/assets/a11y.css` and `/assets/a11y.js` from dgrlabs.co; they 404 harmlessly in dev.
- `docs/banner.jpg` and `dgrlabs_co/assets/contrasteroids.jpg` are the Easy title screen read straight from the canvas (`toDataURL` right after `__game.r.render()`, at 800x431@2x and 600x600@1x); regenerate them if the look or font changes. The Hard title is too dark to work as a thumbnail.
- All text is Audiowide, bundled from `@fontsource/audiowide`. The HUD canvas redraws once the font loads (`main.js`); captures should wait for `document.fonts.ready`.
- `public/og.png` is the 1200x630 link-preview card, captured from the canvas with a title-and-URL HUD by `docs/og-capture.mjs`; regenerate it with them.
- Public text (README, site card, in-game copy) follows the workspace no-AI-tells rule.
- iOS touch quirks in `src/touch.js` (see `docs/decisions.md`): the overlay cancels touchstart/touchmove/touchend because Safari double-tap zooms despite `touch-action: none` (WebKit bug 218015), and audio unlocks on pointerup/touchend, never pointerdown. `src/audio.js` sets the audio session to playback so the silent switch doesn't mute it.
- Online scores: point values live in `src/scoring.js`, shared with the Worker, so change points or wave sizes there and redeploy the server too, or real games get rejected. Game time must never run ahead of wall time, since the server's limits rely on it. `npm run dev` talks to the production score server unless `VITE_SCORES_API` is set. Delete a score: `curl -X DELETE -H "Authorization: Bearer $(security find-generic-password -s contrasteroids-scores-admin -w)" https://scores.dgrlabs.co/scores/<id>`.
- `arcade/` is the cabinet wrapper for the house arcade iMac (`arcade/build.sh`; installed by the house project). It loads the live site with `?arcade`, so the panel bindings in `src/input.js` ship with `npm run publish:site`.
- Backtick toggles dev mode. Easy: J/L sun azimuth, I/K elevation. Hard: J/L cone width, I/K spotlight range, U/O halo range.

## Status

2026-11-17: online daily and all-time boards (scores.dgrlabs.co) are live at https://dgrlabs.co/contrasteroids/, with plausibility checks only. History: `docs/status.md`.
