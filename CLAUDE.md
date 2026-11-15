# Contrasteroids

A rock-shooting arcade game in strict 1-bit black and white: solid white 3D objects, one offscreen sun, no ambient light, hard shadows. `SPEC.md` is the source of truth for design decisions. Tier: unplaced (not on dgrlabs.co).

## Commands

- `npm run dev`: dev server (Vite)
- `npm run build`: static build to `dist/` with relative paths

There are no tests. Check changes by running the game and taking a screenshot; `window.__game` exposes the game object in the console.

## Things that aren't obvious

- The 1-bit look comes from a threshold pass in `src/render.js`: any lit pixel goes white. Lambert shading is never seen as grey, so detail on the rocks comes only from the terminator and cast shadows. Rock relief (crater depth versus radius in `src/geometry.js`) must stay steep, or the rocks turn into white blobs.
- The HUD is a 2D canvas thresholded in the same pass, and it is uploaded only when its content key changes (`Game.drawHud`).
- Backtick toggles dev mode: J/L turn the sun's azimuth, I/K its elevation.

## Status

2026-11-15: first full playable build (title, waves, three aliens, mines, sound). Sun angle still being tuned. Local only, no remote, not hosted.
