# Status history

> **Author:** Claude Code (coder)
> **Date:** 2026-11-15
> **Status:** proposed-by-agent

- 2026-11-15 (earlier): live at https://dgrlabs.co/contrasteroids/. Sun angle still being tuned; keyboard only (no touch controls).
- 2026-11-15: touch controls added, plus iPhone fixes for silent audio and double-tap zoom. Confirmed on Charlie's iPhone.

> **Author:** Claude Code (coder)
> **Date:** 2026-11-16
> **Status:** proposed-by-agent

- 2026-11-15 (last): live with touch confirmed on Charlie's iPhone; sun angle still being tuned.
- 2026-11-16: ship-light lighting built locally (spotlight, halo, bullet lights, greyscale falloff), then split into Easy (sun, 1-bit) and Hard (ship lights) modes; twinkling stars and slow sparkly shots in both; Audiowide font. Published with a new banner, site card, og.png, and README.
- 2026-11-16: mines glow in Hard; published.

## 2026-11-17

Added online daily and all-time top tens per mode, with arcade initials. The Worker and D1 database are deployed at scores.dgrlabs.co and checked from curl (fake scores rejected, session reuse rejected, admin delete works). The game side was checked in headless Chrome against a local server, in landscape and in portrait with touch. The site isn't republished yet.
Published the same day (dgrlabs_co 9ca8051); the live page loads both boards.

## 2026-11-18

> **Author:** Claude Code (coder)
> **Date:** 2026-11-18
> **Status:** proposed-by-agent

Contrasteroids runs on the house arcade iMac (2015, Intel HD 6000, macOS 12) from ES-DE's Arcade list, through the `arcade/` WKWebView wrapper, which the house session installed. Getting there took three fixes: a Safari 15 build target (the iMac's WebKit can't parse class static blocks), a reduced-quality default (`shadow=2048&msaa=0&scale=0.75`, picked from a `?bench` run on the iMac), and Charlie's button map from his MAME Asteroids. Charlie played both modes and said it "felt smooth". The iMac's log showed 59 to 60 fps in play after a 52 to 53 warm-up sample. Sound, the red-button quit, and the button layout were confirmed at the cabinet.

Later on 2026-11-18 (status line before this entry: on the arcade iMac at 60 fps; web game live with online boards):

- Fixed new rocks and aliens drawing for one frame at the origin, beside a freshly spawned ship (f01f677; published as dgrlabs_co d493c0b). Checked in headless Chrome: mesh positions were (0, 0) before the fix and matched the logical position after.
- Rocks now pass in front of the title text, and in Hard a short spotlight fan shows at the ship's nose (b5c4e4f, shortened in c3300ed). Published as dgrlabs_co d26b57a; the live page serves the new bundle.
- puppeteer-core is now a dev dependency (075fcaa).

## 2026-11-18 (later)

> **Author:** Claude Code (coder)
> **Date:** 2026-11-18
> **Status:** decided-by-user

Previous status line: "2026-11-18: live at https://dgrlabs.co/contrasteroids/ (dgrlabs_co d26b57a) with online boards, rocks over the title text, and the Hard spotlight fan; also on the house arcade iMac via `arcade/`."

Initials blocklist cut from 24 entries to 7 slurs and hate initials (FAG, KKK, KYK, NAZ, NGA, NGR, NIG), so rude initials like ASS are allowed. Charlie: "don't reject any initials", then chose to keep blocking just those seven. Worker redeployed (version b066fd4c) and site published (dgrlabs_co 20bfcff).
