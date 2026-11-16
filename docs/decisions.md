# Decisions

> **Author:** Claude Code (coder)
> **Date:** 2026-11-15
> **Status:** decided-by-user

- Charlie asked to drop the ship's bank into turns because it made the ship hard to read.
- Charlie asked to make the game public "just like we did with ~/projects/invaders": a public GitHub repo, a README with a graphic header, hosting on dgrlabs.co, and a card in "Also from the Labs" (Tier 2).

> **Author:** Claude Code (coder)
> **Date:** 2026-11-15
> **Status:** proposed-by-agent

- I kept the existing repo `cwooddgr/contrasteroids` and switched it to public, and the site path is `/contrasteroids/`.
- I chose the MIT license with the same "DGR Labs" copyright line as Hyperplane Invaders. Not confirmed.
- I wrote the site card text; Charlie hasn't approved it. For Invaders he replaced my draft with his own.
- I didn't make a claude.ai artifact. Invaders has a private one because it's a single HTML file, and this is a Vite build with three.js bundled.
- The README banner and the site card are the title screen, captured straight from the game canvas so they stay pure black and white.
- ~~The game is keyboard only, so the card and README say so. Touch controls are not built.~~ Superseded below.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-15
> **Status:** decided-by-user

- Charlie replaced the site card text with his own, which doesn't mention a keyboard, then asked for touch controls ("add touch controls for phone losers").

> **Author:** Claude Code (coder)
> **Date:** 2026-11-15
> **Status:** proposed-by-agent

- I built the touch controls as a DOM overlay (`src/touch.js`) that feeds virtual key codes into `Input`, so the game logic didn't change apart from a `Tap` code for start and resume.
- I kept the fixed 100-unit world height rather than rescaling for portrait, and added a "turn sideways" hint on the title screen instead. Not confirmed; portrait play is cramped.
- Tested in desktop Chrome with synthetic touch pointer events, not yet on a real phone.
- Charlie reported no sound on his iPhone. I set `navigator.audioSession.type = 'playback'` so the silent switch doesn't mute the game (Safari treats Web Audio as ambient by default; WebKit bug 237322), and moved the touch audio unlock from pointerdown to pointerup/touchend, since a touch pointerdown isn't a user activation under the HTML spec. Side effect: starting the game pauses other audio such as music. Not yet confirmed on his phone.
- Charlie double-tapped beside the fire button on iOS Safari and the page zoomed. `touch-action: none` doesn't stop double-tap zoom on positioned elements in Safari (WebKit bug 218015, still open), so the overlay now cancels touchstart, touchmove, and touchend itself. Not yet confirmed on his phone.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-15
> **Status:** decided-by-user

- Charlie confirmed on his iPhone that touch controls work, sound plays, and double-tap no longer zooms ("works now, sound too").

> **Author:** Claude Code (coder)
> **Date:** 2026-11-16
> **Status:** decided-by-user

- Charlie asked to replace the monospace font with something "more evocative of the 1980's" and chose Audiowide from six samples (Press Start 2P, Orbitron, Audiowide, VT323, Michroma, Silkscreen).
- Charlie said to publish the Easy/Hard version.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-16
> **Status:** proposed-by-agent

- I bundled Audiowide through npm (`@fontsource/audiowide`, OFL) instead of linking Google Fonts, so the page makes no third-party font requests.
- I used the Easy title screen for the README banner, site card image, and og.png. The Hard title is mostly black and reads poorly at thumbnail size.
- I rewrote the README intro, controls, and "How it's made" for the two modes. Charlie hasn't reviewed the wording. I left his site card text alone; it doesn't describe the lighting.
