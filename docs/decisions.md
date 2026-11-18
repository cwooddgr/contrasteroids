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

> **Author:** Claude Code (coder)
> **Date:** 2026-11-17
> **Status:** decided-by-user

- Charlie asked for "an internet high score server with daily and all time scores", made "somewhat unhackable, since this is open source". From multiple-choice questions he chose plausibility checks over server-side replay, three-letter initials, a midnight UTC reset, and keeping the screen-shaped playfield.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-17
> **Status:** proposed-by-agent

- I hosted it as a Worker with D1 at `scores.dgrlabs.co`, like backfence and milliways, and deployed it without asking separately, since the request was for an internet server.
- The admin token is in the macOS Keychain (service `contrasteroids-scores-admin`), not in any file. The IP salt is a Worker secret only.
- I put the point values and the check in one shared file (`src/scoring.js`) so the server can't drift from the game.
- The title screen alternates every 8 s between the controls and the boards. Game over shows both boards with our new entry bracketed. Not confirmed.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-17
> **Status:** decided-by-user

- Charlie asked whether submissions could be limited to dgrlabs.co. I explained that an Origin check can be faked with one header and that Cloudflare Turnstile would be the real version. He chose to leave it as it is (no Origin enforcement, no Turnstile) and to publish.

## Arcade cabinet build

> **Author:** Claude Code (coder)
> **Date:** 2026-11-18
> **Status:** decided-by-user

- Charlie asked how feasible a MAME version would be for the house arcade iMac. I said a real MAME ROM would mean a rewrite for old hardware that can't draw the look, and proposed a wrapper app launched from the cabinet's frontend instead. He chose to build the wrapper here and hand installation to the house session, with the red (exit) button quitting back to the frontend.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-18
> **Status:** proposed-by-agent

- `arcade/` is a Swift WKWebView app (system WebKit, universal, macOS 12+), not Electron, to stay small on the iMac's hard drive. It loads the live site with `?arcade` rather than bundling a build, so game updates reach the cabinet with each site publish and online scores keep the dgrlabs.co origin. Without a network it retries on a black screen.
- `?arcade` maps LCtrl to fire, LAlt to hyperspace, and `1` to Enter, and swaps the on-screen hints for panel wording. It is off on the web, where Ctrl and Alt are browser shortcuts.
- The app quits on the middle mouse button (the X-Arcade's red button) and after five minutes without input, so the frontend's attract mode returns. It logs the frame rate every 10 s for tuning.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-18
> **Status:** proposed-by-agent

- The iMac's system WebKit (macOS 12) can't parse class static blocks, which three.js uses, so the site now builds for `['es2020', 'safari15']`. The house session found this.
- The cabinet runs at `shadow=2048&msaa=0&scale=0.75`, the wrapper's default URL. In the iMac's `?bench` run with ES-DE behind it, full quality managed 33 fps in Easy and 39 in Hard on the title screen. MSAA was the largest single cost, and this cut held 60 in both modes. I picked it over `scale=0.5` because that also held 60 but looks blockier. Headroom during play is unmeasured.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-18
> **Status:** decided-by-user

- Cabinet buttons (`?arcade`), relayed from the cabinet by the house session as Charlie's final map, matching his MAME Asteroids: bottom two buttons (C, 5) rotate, middle center (Z) thrusts, middle right (X) fires, top right (Space) is hyperspace. The stick stays as it was. He asked that it not collide with the web keys, and it doesn't: the remap applies only with `?arcade`.
- I kept LCtrl as fire and LAlt/LShift as hyperspace, as harmless extras on buttons he didn't assign (proposed-by-agent).
